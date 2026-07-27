import {
  Prisma,
  SourceCandidateDecision as DbSourceCandidateDecision,
  SourceKind as DbSourceKind,
  StudyType as DbStudyType,
  type SourceCandidate as DbSourceCandidate
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { syncSourcePacketForClaim } from "@/lib/data/source-packets";
import { searchPubMed } from "@/lib/integrations/pubmed";
import { buildScoreWorklistReport } from "@/lib/score-worklist";

const LOCAL_SOURCE_WORK_REPAIR_LIMIT_DEFAULT = 5000;
const LOCAL_SOURCE_WORK_REPAIR_LIMIT_MAX = 5000;
const AI_DRAFT_NOTE =
  "AI-draft extraction from captured abstract/registry metadata; verify the source packet before promotion or human review.";

export type LocalSourceWorkRepairInput = {
  apply?: boolean;
  limit?: number;
  // When provided, extraction is restricted to these reference IDs. Lets an
  // operator draft extraction for a specific vetted set instead of the whole
  // clean-pending queue (which may include weak/off-target matches).
  referenceIds?: string[];
};

export type LocalSourceWorkRepairDecision = {
  action: "draft-extraction" | "hold";
  applied: boolean;
  claimCount: number;
  error?: string;
  reason?: string;
  referenceId: string;
  referenceLabel: string;
  sourceType?: keyof typeof DbStudyType;
  title: string;
};

export type LocalSourceWorkRepairResponse = {
  action: "repair-source-work";
  applied: boolean;
  counts: {
    draftedExtractions: number;
    errors: number;
    heldExistingMultiStudy: number;
    heldIdentityWarnings: number;
    heldNoCandidate: number;
    heldNoSourceText: number;
    identityWarningsCovered: number;
    scannedReferences: number;
    sourceBlockedAfter: number;
    sourceBlockedBefore: number;
    syncedClaims: number;
  };
  decisions: LocalSourceWorkRepairDecision[];
  limit: number;
  message: string;
  updatedAt: string;
};

export async function runLocalSourceWorkRepair(
  input: LocalSourceWorkRepairInput = {}
): Promise<LocalSourceWorkRepairResponse> {
  const limit = normaliseSourceWorkRepairLimit(input.limit);
  const applied = input.apply === true;
  const beforeData = await getEvidenceDashboardData();
  const beforeReport = buildScoreWorklistReport(beforeData, {
    limit: Math.max(beforeData.claims.length, 1),
    state: "work"
  });
  const referenceIdFilter =
    input.referenceIds && input.referenceIds.length > 0
      ? new Set(input.referenceIds)
      : undefined;
  const pendingGroups = referenceIdFilter
    ? beforeReport.repairSummary.pendingReferenceGroups.filter((group) =>
        referenceIdFilter.has(group.reference.id)
      )
    : beforeReport.repairSummary.pendingReferenceGroups;
  const targetGroups = pendingGroups.slice(0, limit);
  const candidatesByReferenceId = await acceptedCandidatesByReferenceId(
    targetGroups.map((group) => group.reference.id)
  );
  const decisions: LocalSourceWorkRepairDecision[] = [];
  const syncedClaimIds = new Set<string>();

  for (const group of targetGroups) {
    const baseDecision = {
      claimCount: group.claimCount,
      referenceId: group.reference.id,
      referenceLabel: group.reference.label,
      title: group.reference.title
    };

    const candidates = candidatesByReferenceId.get(group.reference.id) ?? [];
    const localCandidate = bestExtractionCandidate(candidates);

    if (
      group.identityWarnings.length > 0 &&
      !identityWarningsCoveredByAcceptedCandidates(candidates, group.interventions)
    ) {
      decisions.push({
        ...baseDecision,
        action: "hold",
        applied: false,
        reason: "Identity warning remains; resolve supplement/reference match before extraction."
      });
      continue;
    }

    const candidate = localCandidate ?? (await bestLiveExtractionCandidate(candidates));

    if (!candidate) {
      decisions.push({
        ...baseDecision,
        action: "hold",
        applied: false,
        reason: "No accepted source candidate with captured source text was found."
      });
      continue;
    }

    try {
      const studies = await prisma.study.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        where: { referenceId: group.reference.id }
      });

      if (studies.length > 1) {
        decisions.push({
          ...baseDecision,
          action: "hold",
          applied: false,
          reason: "Multiple study rows already exist; inspect manually before updating extraction."
        });
        continue;
      }

      const studyInput = sourceWorkRepairStudyInput(candidate, {
        outcomes: group.outcomes,
        targetInterventions: group.interventions.map((intervention) => intervention.name)
      });

      if (applied) {
        if (studies[0]) {
          await prisma.study.update({
            data: studyInput,
            where: { id: studies[0].id }
          });
        } else {
          await prisma.study.create({ data: studyInput });
        }

        for (const sampleClaim of group.sampleClaims) {
          syncedClaimIds.add(sampleClaim.claimId);
        }
      }

      decisions.push({
        ...baseDecision,
        action: "draft-extraction",
        applied,
        reason:
          group.identityWarnings.length > 0
            ? "Accepted candidate identity coverage cleared the title-only identity warning for local AI-draft extraction."
            : undefined,
        sourceType: studyInput.sourceType
      });
    } catch (error) {
      decisions.push({
        ...baseDecision,
        action: "hold",
        applied: false,
        error:
          error instanceof Error
            ? error.message
            : "Source-work extraction repair failed for this reference."
      });
    }
  }

  if (applied) {
    for (const claimId of syncedClaimIds) {
      await syncSourcePacketForClaim(claimId);
    }
  }

  const afterData = await getEvidenceDashboardData();
  const afterReport = buildScoreWorklistReport(afterData, {
    limit: Math.max(afterData.claims.length, 1),
    state: "work"
  });
  const counts = sourceWorkRepairCounts({
    decisions,
    sourceBlockedAfter: afterReport.repairSummary.sourceBlockedRows,
    sourceBlockedBefore: beforeReport.repairSummary.sourceBlockedRows,
    syncedClaims: syncedClaimIds.size
  });

  return {
    action: "repair-source-work",
    applied,
    counts,
    decisions,
    limit,
    message: sourceWorkRepairMessage(counts, applied),
    updatedAt: new Date().toISOString()
  };
}

async function acceptedCandidatesByReferenceId(referenceIds: string[]) {
  const candidates = await prisma.sourceCandidate.findMany({
    orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
    where: {
      acceptedReferenceId: { in: referenceIds },
      decision: DbSourceCandidateDecision.ACCEPTED
    }
  });
  const groups = new Map<string, DbSourceCandidate[]>();

  for (const candidate of candidates) {
    if (!candidate.acceptedReferenceId) {
      continue;
    }

    groups.set(candidate.acceptedReferenceId, [
      ...(groups.get(candidate.acceptedReferenceId) ?? []),
      candidate
    ]);
  }

  return groups;
}

function bestExtractionCandidate(candidates: DbSourceCandidate[]) {
  return candidates.find((candidate) => Boolean(sourceText(candidate)));
}

async function bestLiveExtractionCandidate(candidates: DbSourceCandidate[]) {
  for (const candidate of candidates) {
    const candidateWithLiveText = await candidateWithPubMedAbstract(candidate);

    if (candidateWithLiveText && sourceText(candidateWithLiveText)) {
      return candidateWithLiveText;
    }
  }

  return undefined;
}

async function candidateWithPubMedAbstract(candidate: DbSourceCandidate) {
  if (candidate.source !== DbSourceKind.PUBMED) {
    return undefined;
  }

  const pmid = normalisePubMedId(candidate.externalId);

  if (!pmid) {
    return undefined;
  }

  try {
    const result = await searchPubMed(`${pmid}[uid]`, 1, {
      includeAbstractText: true
    });
    const article = result.articles.find((item) => item.pmid === pmid) ?? result.articles[0];

    if (!article?.abstractText) {
      return undefined;
    }

    const metadata = metadataRecord(candidate.metadata);
    const liveMetadata: Record<string, unknown> = {
      ...metadata,
      abstractText: article.abstractText,
      doi: article.doi ?? metadata.doi,
      hasAbstract: article.hasAbstract ?? true,
      journal: article.journal ?? metadata.journal,
      publicationDate: article.publicationDate ?? metadata.publicationDate,
      publicationTypes:
        article.publicationTypes.length > 0
          ? article.publicationTypes
          : metadata.publicationTypes,
      publicationYear: article.publicationYear ?? metadata.publicationYear
    };

    return {
      ...candidate,
      metadata: liveMetadata as Prisma.JsonValue,
      publishedYear: candidate.publishedYear ?? articlePublicationYear(article.publicationYear)
    } satisfies DbSourceCandidate;
  } catch {
    return undefined;
  }
}

function identityWarningsCoveredByAcceptedCandidates(
  candidates: DbSourceCandidate[],
  interventions: Array<{ id: string; name: string }>
) {
  if (interventions.length === 0) {
    return false;
  }

  return interventions.every((intervention) =>
    candidates.some(
      (candidate) =>
        candidate.interventionId === intervention.id &&
        Boolean(sourceText(candidate)) &&
        candidateIdentityMentionsIntervention(candidate, intervention.name)
    )
  );
}

function candidateIdentityMentionsIntervention(candidate: DbSourceCandidate, interventionName: string) {
  const metadata = metadataRecord(candidate.metadata);
  const sourceIdentityText = identityText(
    [
      candidate.query,
      candidate.title,
      candidate.sourceType,
      metadataString(metadata, "abstractText"),
      metadataString(metadata, "briefSummary"),
      ...metadataStringArray(metadata, "conditions"),
      ...metadataStringArray(metadata, "interventions"),
      ...metadataStringArray(metadata, "primaryOutcomes")
    ]
      .filter(Boolean)
      .join(" ")
  );
  const interventionText = identityText(interventionName);

  return interventionText.length >= 3 && sourceIdentityText.includes(interventionText);
}

function sourceWorkRepairStudyInput(
  candidate: DbSourceCandidate,
  context: {
    outcomes: string[];
    targetInterventions: string[];
  }
): Prisma.StudyUncheckedCreateInput {
  const metadata = metadataRecord(candidate.metadata);
  const sourceType = studyTypeFromCandidate(candidate);
  const abstract = sourceText(candidate);
  const outcomeText = metadataStringArray(metadata, "primaryOutcomes");
  const outcomes = outcomeText.length > 0 ? outcomeText : context.outcomes;
  const targetIntervention =
    metadataStringArray(metadata, "interventions").join("; ") ||
    context.targetInterventions.join("; ") ||
    candidate.query;

  return {
    abstract,
    adverseEvents: adverseEventsText(candidate, abstract),
    doi: metadataString(metadata, "doi"),
    duration: durationText(metadata, abstract),
    extractedAbstract: abstract ? `${AI_DRAFT_NOTE}\n\n${abstract}` : undefined,
    fundingConflicts: fundingConflictText(candidate),
    interventionName: `Target intervention/context: ${targetIntervention}. Verify exact form, dose, comparator, and co-interventions.`,
    mainResults: mainResultsText(candidate, abstract),
    nctId:
      candidate.source === DbSourceKind.CLINICALTRIALS_GOV
        ? normaliseNctId(candidate.externalId)
        : undefined,
    outcomes: outcomes.length > 0 ? outcomes : ["Claim-relevant outcomes require source verification"],
    pmid:
      candidate.source === DbSourceKind.PUBMED
        ? normalisePubMedId(candidate.externalId)
        : undefined,
    population: populationText(candidate, abstract),
    referenceId: candidate.acceptedReferenceId,
    relevanceScore: 4,
    riskOfBias:
      `${AI_DRAFT_NOTE} Risk of bias has not been fully assessed; verify design, comparator, randomization/blinding or review methods, attrition, selective reporting, and conflicts.`,
    sampleSize: sampleSizeText(candidate, abstract, sourceType),
    source: sourceLabel(candidate.source),
    sourceType,
    title: candidate.title,
    url: candidate.url,
    year: candidate.publishedYear
  };
}

function sourceText(candidate: DbSourceCandidate) {
  const metadata = metadataRecord(candidate.metadata);
  const abstractText = metadataString(metadata, "abstractText");

  if (abstractText) {
    return `PubMed abstract: ${abstractText}`;
  }

  const briefSummary = metadataString(metadata, "briefSummary");

  if (briefSummary) {
    return `ClinicalTrials.gov registry summary: ${briefSummary}`;
  }

  return undefined;
}

// Exported for unit tests: this classifier feeds the `sourceType` of drafted
// study extractions, which in turn drives the evidence-rigor score, so its
// mapping needs direct coverage.
export function studyTypeFromCandidate(candidate: DbSourceCandidate) {
  const metadata = metadataRecord(candidate.metadata);
  const text = [
    candidate.sourceType,
    candidate.title,
    ...metadataStringArray(metadata, "publicationTypes")
  ]
    .join(" ")
    .toLowerCase();

  if (candidate.source === DbSourceKind.CLINICALTRIALS_GOV) {
    return DbStudyType.CLINICAL_TRIAL_RECORD;
  }

  if (text.includes("meta-analysis")) {
    return DbStudyType.META_ANALYSIS;
  }

  if (text.includes("systematic")) {
    return DbStudyType.SYSTEMATIC_REVIEW;
  }

  // Only claim randomization when the metadata actually says so. PubMed's
  // "Clinical Trial" publication type covers non-randomized trials too, so a
  // bare clinical-trial signal must not be promoted to RCT rigor.
  if (
    text.includes("randomized") ||
    text.includes("randomised") ||
    text.includes("placebo-controlled") ||
    /\brct\b/.test(text)
  ) {
    return DbStudyType.RANDOMIZED_CONTROLLED_TRIAL;
  }

  if (text.includes("clinical trial")) {
    return DbStudyType.CLINICAL_TRIAL_RECORD;
  }

  if (text.includes("observational") || text.includes("cohort")) {
    return DbStudyType.OBSERVATIONAL_COHORT;
  }

  if (text.includes("case report")) {
    return DbStudyType.CASE_REPORT;
  }

  if (text.includes("animal")) {
    return DbStudyType.ANIMAL_STUDY;
  }

  if (text.includes("in vitro")) {
    return DbStudyType.IN_VITRO_MECHANISTIC;
  }

  // Nothing in the title/publication types establishes a design. Say exactly
  // that rather than borrowing a real design as a stand-in: UNCLASSIFIED
  // carries rigor 0, is excluded from the "direct human evidence" set, and
  // renders to readers as "study of unclear design". The earlier stopgaps both
  // reached the public page as false statements of fact — SYSTEMATIC_REVIEW
  // (rigor 8) inflated evidenceRigor, and CASE_REPORT asserted "a single,
  // unreplicated observation" about a source we had not classified at all.
  return DbStudyType.UNCLASSIFIED;
}

function sampleSizeText(
  candidate: DbSourceCandidate,
  abstract: string | undefined,
  sourceType: DbStudyType
) {
  const metadata = metadataRecord(candidate.metadata);
  const enrollment =
    metadataString(metadata, "enrollmentCount") || metadataString(metadata, "enrollment");

  if (enrollment) {
    return `Registry enrollment/sample-size field: ${enrollment}. Verify analyzed sample before promotion.`;
  }

  const abstractSample = abstractSampleCue(abstract);

  if (abstractSample) {
    return `Captured abstract mentions ${abstractSample}; verify analyzed sample before promotion.`;
  }

  if (sourceType === DbStudyType.META_ANALYSIS || sourceType === DbStudyType.SYSTEMATIC_REVIEW) {
    return "Review-level source; included-study count and participant total require source verification.";
  }

  return "Sample size not captured in local metadata; verify source before promotion or human review.";
}

function populationText(candidate: DbSourceCandidate, abstract: string | undefined) {
  const metadata = metadataRecord(candidate.metadata);
  const conditions = metadataStringArray(metadata, "conditions");

  if (conditions.length > 0) {
    return `Registry condition/population context: ${conditions.join("; ")}. Verify inclusion criteria and baseline health status.`;
  }

  const populationSentence = usefulSentence(abstract, [
    "participants",
    "patients",
    "adults",
    "subjects",
    "volunteers",
    "men",
    "women"
  ]);

  if (populationSentence) {
    return `Captured abstract population cue: ${populationSentence}`;
  }

  return `Population not cleanly captured in local metadata for ${candidate.title}; verify source before promotion.`;
}

function mainResultsText(candidate: DbSourceCandidate, abstract: string | undefined) {
  const metadata = metadataRecord(candidate.metadata);
  const hasResults = metadataString(metadata, "hasResults");
  const resultsFirstPostDate = metadataString(metadata, "resultsFirstPostDate");
  const resultSentence = preferredResultSentence(abstract);

  if (resultSentence) {
    return `${AI_DRAFT_NOTE} Result cue from captured source text: ${resultSentence}`;
  }

  if (hasResults === "true") {
    return resultsFirstPostDate
      ? `${AI_DRAFT_NOTE} Registry results are posted (${resultsFirstPostDate}); extract effect direction from the registry before promotion.`
      : `${AI_DRAFT_NOTE} Registry results are posted; extract effect direction before promotion.`;
  }

  return `${AI_DRAFT_NOTE} Captured metadata did not provide a clean effect-direction sentence; treat as source context until reviewed.`;
}

function adverseEventsText(candidate: DbSourceCandidate, abstract: string | undefined) {
  const safetySentence = preferredResultSentence(abstract, [
    "adverse",
    "safety",
    "tolerability",
    "tolerated",
    "laboratory",
    "side effect",
    "withdrawal"
  ]);

  if (safetySentence) {
    return `${AI_DRAFT_NOTE} Safety cue from captured source text: ${safetySentence}`;
  }

  const metadata = metadataRecord(candidate.metadata);
  const hasResults = metadataString(metadata, "hasResults");

  if (hasResults === "true") {
    return `${AI_DRAFT_NOTE} Registry results are posted; adverse-event table requires source verification.`;
  }

  return `${AI_DRAFT_NOTE} Adverse-event details were not captured in local metadata; verify source before promotion.`;
}

function fundingConflictText(candidate: DbSourceCandidate) {
  const metadata = metadataRecord(candidate.metadata);
  const sponsor = metadataString(metadata, "sponsor");

  if (sponsor) {
    return `${AI_DRAFT_NOTE} Registry sponsor: ${sponsor}. This is not a full funding/conflict assessment.`;
  }

  return `${AI_DRAFT_NOTE} Funding/conflict details were not captured in local metadata; verify full source before promotion.`;
}

function durationText(metadata: Record<string, unknown>, abstract: string | undefined) {
  const startDate = metadataString(metadata, "startDate");
  const completionDate = metadataString(metadata, "completionDate");

  if (startDate && completionDate) {
    return `Registry dates: ${startDate} to ${completionDate}; verify actual intervention and follow-up duration.`;
  }

  const duration = abstract?.match(/\b(\d+\s*(?:day|days|week|weeks|month|months|year|years))\b/i);

  return duration ? `Captured duration cue: ${duration[1]}; verify source.` : undefined;
}

function usefulSentence(value: string | undefined, keywords: string[]) {
  return sourceSentences(value).find((sentence) =>
    keywords.some((keyword) => sentence.toLowerCase().includes(keyword))
  );
}

function preferredResultSentence(value: string | undefined, keywords?: string[]) {
  const resultKeywords = keywords ?? [
    "significant",
    "improved",
    "reduced",
    "increased",
    "decreased",
    "effect",
    "no difference",
    "no significant",
    "associated",
    "superior",
    "lower",
    "higher"
  ];
  const excludedCues = [
    "aimed to",
    "objective:",
    "objectives:",
    "methods:",
    "background:",
    "however, the systematic reviews",
    "to evaluate",
    "this study aimed",
    "this systematic review"
  ];
  const scored = sourceSentences(value)
    .filter((sentence) => {
      const lower = sentence.toLowerCase();

      return (
        resultKeywords.some((keyword) => lower.includes(keyword)) &&
        !excludedCues.some((cue) => lower.startsWith(cue))
      );
    })
    .map((sentence) => ({
      score: resultSentenceScore(sentence),
      sentence
    }))
    .sort((left, right) => right.score - left.score);

  return scored[0]?.sentence;
}

function resultSentenceScore(sentence: string) {
  const lower = sentence.toLowerCase();
  let score = 0;

  if (lower.includes("results:")) score += 4;
  if (lower.includes("conclusions:")) score += 3;
  if (lower.includes("significant")) score += 3;
  if (lower.includes("no group difference") || lower.includes("no difference")) score += 3;
  if (lower.includes("reduced") || lower.includes("improved")) score += 2;
  if (lower.includes("safety") || lower.includes("tolerability")) score += 2;
  if (lower.includes("compared with") || lower.includes("versus placebo")) score += 2;
  if (lower.includes("aimed") || lower.includes("objective")) score -= 4;
  if (lower.includes("method")) score -= 2;

  return score;
}

function abstractSampleCue(value: string | undefined) {
  const sentences = sourceSentences(value);
  const numericSample = sentences
    .join(" ")
    .match(
      /\b(?:n\s*=\s*)?(\d{2,6})\s+(participants|adults|patients|subjects|volunteers|individuals|people|men|women)\b/i
    );

  if (numericSample) {
    return `${numericSample[1]} ${numericSample[2]}`;
  }

  const wordNumberSample = sentences
    .join(" ")
    .match(
      /\b((?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s](?:one|two|three|four|five|six|seven|eight|nine))?)\s+(participants|adults|patients|subjects|volunteers|individuals|people|males|men|women)\b/i
    );

  return wordNumberSample ? `${wordNumberSample[1]} ${wordNumberSample[2]}` : undefined;
}

function sourceSentences(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .replace(/^PubMed abstract:\s*/i, "")
    .replace(/^ClinicalTrials\.gov registry summary:\s*/i, "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 30 && sentence.length <= 360);
}

function sourceWorkRepairCounts({
  decisions,
  sourceBlockedAfter,
  sourceBlockedBefore,
  syncedClaims
}: {
  decisions: LocalSourceWorkRepairDecision[];
  sourceBlockedAfter: number;
  sourceBlockedBefore: number;
  syncedClaims: number;
}): LocalSourceWorkRepairResponse["counts"] {
  return {
    draftedExtractions: decisions.filter((decision) => decision.action === "draft-extraction")
      .length,
    errors: decisions.filter((decision) => decision.error).length,
    heldExistingMultiStudy: decisions.filter((decision) =>
      decision.reason?.startsWith("Multiple study rows")
    ).length,
    heldIdentityWarnings: decisions.filter((decision) =>
      decision.reason?.startsWith("Identity warning")
    ).length,
    heldNoCandidate: decisions.filter((decision) =>
      decision.reason?.startsWith("No accepted source candidate")
    ).length,
    heldNoSourceText: decisions.filter((decision) =>
      decision.reason?.startsWith("No accepted source candidate with captured source text")
    ).length,
    identityWarningsCovered: decisions.filter((decision) =>
      decision.reason?.startsWith("Accepted candidate identity coverage")
    ).length,
    scannedReferences: decisions.length,
    sourceBlockedAfter,
    sourceBlockedBefore,
    syncedClaims
  };
}

function sourceWorkRepairMessage(
  counts: LocalSourceWorkRepairResponse["counts"],
  applied: boolean
) {
  const verb = applied ? "Drafted" : "Previewed";

  return `${verb} ${counts.draftedExtractions.toLocaleString()} source extraction row(s) from ${counts.scannedReferences.toLocaleString()} clean pending reference(s); synced ${counts.syncedClaims.toLocaleString()} claim packet(s). Source-work rows: ${counts.sourceBlockedBefore.toLocaleString()} before, ${counts.sourceBlockedAfter.toLocaleString()} after.`;
}

function normaliseSourceWorkRepairLimit(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return LOCAL_SOURCE_WORK_REPAIR_LIMIT_DEFAULT;
  }

  return Math.min(
    LOCAL_SOURCE_WORK_REPAIR_LIMIT_MAX,
    Math.max(1, Math.floor(value ?? LOCAL_SOURCE_WORK_REPAIR_LIMIT_DEFAULT))
  );
}

function normalisePubMedId(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && /^\d+$/.test(trimmed) ? trimmed : undefined;
}

function articlePublicationYear(value: string | null) {
  if (!value || !/^\d{4}$/.test(value)) {
    return null;
  }

  return Number(value);
}

function normaliseNctId(value: string | null) {
  const trimmed = value?.trim().toUpperCase();
  return trimmed && /^NCT\d{8}$/.test(trimmed) ? trimmed : undefined;
}

function sourceLabel(source: DbSourceKind) {
  return source === DbSourceKind.CLINICALTRIALS_GOV ? "ClinicalTrials.gov" : "PubMed";
}

function metadataRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function identityText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function metadataStringArray(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}
