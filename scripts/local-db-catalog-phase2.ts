import {
  EvidenceMomentum as DbEvidenceMomentum,
  SourceKind as DbSourceKind,
  SourceCandidateDecision as DbSourceCandidateDecision,
  StudyType as DbStudyType,
  TrialStatus as DbTrialStatus
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import {
  extractAcceptedSourceCandidateStudy,
  linkAcceptedSourceCandidateClaim,
  recordSourceCandidateDecision
} from "@/lib/data/source-candidates";
import {
  syncClaimStudyLinksForClaim,
  syncSourcePacketForClaim
} from "@/lib/data/source-packets";

const REVIEW_NOTE =
  "Local catalog phase-2 pass (hobby-project mode); verify before public promotion.";

const MANUAL_CLAIM_LINKS: Array<{
  claimId: string;
  reference: {
    id: string;
    identifier: string;
    source: DbSourceKind;
    title: string;
    url: string;
    year: number;
  };
  study: {
    id: string;
    sourceType: DbStudyType;
    sampleSize: string;
    population: string;
    interventionName: string;
    outcomes: string[];
    adverseEvents: string;
    fundingConflicts: string;
    riskOfBias: string;
    pmid?: string;
  };
}> = [
  {
    claimId: "ashwagandha-sleep",
    reference: {
      id: "ref-pubmed-34559859",
      identifier: "PMID: 34559859",
      source: DbSourceKind.PUBMED,
      title:
        "Effect of Ashwagandha (Withania somnifera) extract on sleep: A systematic review and meta-analysis",
      url: "https://pubmed.ncbi.nlm.nih.gov/34559859/",
      year: 2021
    },
    study: {
      id: "study-ashwagandha-sleep-2021",
      sourceType: DbStudyType.META_ANALYSIS,
      sampleSize: "Systematic review / meta-analysis",
      population: "Adults in included sleep trials",
      interventionName: "Ashwagandha extract",
      outcomes: ["Sleep quality", "Sleep onset latency", "Sleep efficiency"],
      adverseEvents: "Review-level safety not primary endpoint; verify source.",
      fundingConflicts: "Check source record for details.",
      riskOfBias: "Meta-analysis of heterogeneous trials; extract standardization varies.",
      pmid: "34559859"
    }
  },
  {
    claimId: "ashwagandha-fertility-hormones",
    reference: {
      id: "ref-pubmed-27622126",
      identifier: "PMID: 27622126",
      source: DbSourceKind.PUBMED,
      title:
        "Efficacy of Withania somnifera on seminal plasma metabolites of infertile males: a proton NMR study",
      url: "https://pubmed.ncbi.nlm.nih.gov/27622126/",
      year: 2016
    },
    study: {
      id: "study-ashwagandha-fertility-2016",
      sourceType: DbStudyType.RANDOMIZED_CONTROLLED_TRIAL,
      sampleSize: "See source record",
      population: "Infertile males",
      interventionName: "Withania somnifera (ashwagandha)",
      outcomes: ["Seminal plasma metabolites", "Reproductive biomarkers"],
      adverseEvents: "Not fully characterized in catalog maintenance pass; verify source.",
      fundingConflicts: "Check source record for details.",
      riskOfBias: "Single study context; limited generalizability.",
      pmid: "27622126"
    }
  },
  {
    claimId: "ashwagandha-mood-stress",
    reference: {
      id: "guo-ashwagandha-stress-2022",
      identifier: "PMID: 36017529",
      source: DbSourceKind.PUBMED,
      title:
        "Does Ashwagandha supplementation have a beneficial effect on the management of anxiety and stress? A systematic review and meta-analysis of randomized controlled trials",
      url: "https://pubmed.ncbi.nlm.nih.gov/36017529/",
      year: 2022
    },
    study: {
      id: "study-ashwagandha-stress-2022",
      sourceType: DbStudyType.META_ANALYSIS,
      sampleSize: "Systematic review / meta-analysis",
      population: "Adults in included RCTs",
      interventionName: "Ashwagandha supplementation",
      outcomes: ["Stress", "Anxiety symptoms"],
      adverseEvents: "Review-level; verify source for adverse-event detail.",
      fundingConflicts: "Check source record for details.",
      riskOfBias: "Heterogeneous extracts and trial sizes.",
      pmid: "36017529"
    }
  }
];

const REJECT_TITLE_PATTERNS = [
  /\balbus\b/i,
  /\brat(s)?\b/i,
  /\bmice\b/i,
  /\bmurine\b/i,
  /\bporcine\b/i,
  /\bzebrafish\b/i,
  /\brectal cancer\b/i,
  /\bnongenital warts\b/i,
  /\bmultivitamin/i,
  /\bhypothyroidism\b/i,
  /\bcognitive disorders\b/i,
  /\bmilk supplementation\b/i,
  /\bwhey\b/i,
  /\bmyositis\b/i,
  /\bgut microbiome in predicting adverse events in neoadjuvant\b/i
];

const INTERVENTION_KEYWORDS: Record<string, string[]> = {
  "ashwagandha": ["ashwagandha", "withania"],
  "berberine": ["berberine"],
  "beta-alanine": ["beta-alanine", "β-alanine", "beta alanine"],
  creatine: ["creatine"],
  "omega-3": ["omega-3", "omega 3", "epa", "dha", "fish oil"],
  "vitamin-d": ["vitamin d", "vitamin d3", "cholecalciferol", "25(oh)d"]
};

async function main() {
  const tracks = readTrackArgs(process.argv.slice(2));
  const env = mergeEnv(process.env, loadEnvFile(".env.local").env);

  await withProcessEnv(env, async () => {
    const summary: Record<string, unknown> = {};

    if (tracks.has("d")) {
      summary.trackD = await trackDepthPass();
    }
    if (tracks.has("e")) {
      summary.trackE = await trackFullTriage();
    }
    if (tracks.has("f")) {
      summary.trackF = await trackTrials();
    }
    summary.after = await catalogSnapshot();

    console.log(JSON.stringify(summary, null, 2));
  });
}

function readTrackArgs(args: string[]) {
  const trackArg = args.find((arg) => arg.startsWith("--tracks="));
  if (!trackArg) {
    return new Set(["d", "e", "f"]);
  }

  return new Set(
    trackArg
      .slice("--tracks=".length)
      .split(",")
      .map((track) => track.trim().toLowerCase())
      .filter((track) => track === "d" || track === "e" || track === "f")
  );
}

async function trackDepthPass() {
  const result: Record<string, unknown> = { claims: {} };

  for (const entry of MANUAL_CLAIM_LINKS) {
    await upsertReference(entry.reference);
    await upsertStudy({
      ...entry.study,
      referenceId: entry.reference.id,
      source: "PubMed",
      title: entry.reference.title,
      year: entry.reference.year
    });
    await upsertClaimReference(entry.claimId, entry.reference.id, 7);

    const packet = await syncSourcePacketForClaim(entry.claimId);
    const studySync = await syncClaimStudyLinksForClaim(entry.claimId);
    (result.claims as Record<string, unknown>)[entry.claimId] = {
      packetStatus: packet.status,
      studySync
    };
  }

  return result;
}

async function trackFullTriage() {
  const result = {
    accepted: [] as string[],
    rejected: [] as string[],
    skipped: [] as string[],
    errors: [] as string[]
  };

  const pending = await prisma.sourceCandidate.findMany({
    where: { decision: DbSourceCandidateDecision.PENDING_REVIEW },
    orderBy: [{ triageScore: "desc" }, { title: "asc" }]
  });

  for (const candidate of pending) {
    const decision = classifyPendingCandidate(candidate);

    if (decision === "skip") {
      result.skipped.push(candidate.dedupeKey);
      continue;
    }

    if (decision === "reject") {
      try {
        await recordSourceCandidateDecision({
          dedupeKey: candidate.dedupeKey,
          decision: "Rejected",
          reviewNote: "Rejected in local catalog phase-2 triage: weak or mismatched match."
        });
        result.rejected.push(candidate.dedupeKey);
      } catch (error) {
        result.errors.push(
          `reject ${candidate.dedupeKey}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      continue;
    }

    if (!candidate.claimId) {
      result.skipped.push(candidate.dedupeKey);
      continue;
    }

    try {
      const referenceId = await ensureSourceCandidateReference(candidate);
      await recordSourceCandidateDecision({
        acceptedReferenceId: referenceId,
        dedupeKey: candidate.dedupeKey,
        decision: "Accepted",
        reviewNote: REVIEW_NOTE
      });
      await linkAcceptedSourceCandidateClaim({
        dedupeKey: candidate.dedupeKey,
        relevance: 7
      });

      const studyCount = await prisma.study.count({ where: { referenceId } });
      if (studyCount === 0) {
        await extractAcceptedSourceCandidateStudy({
          dedupeKey: candidate.dedupeKey,
          adverseEvents: "Not extracted in catalog maintenance pass; verify in source.",
          fundingConflicts: "Check source record.",
          interventionName: candidate.interventionId ?? "See source record",
          outcomes: ["See source record"],
          population: "See source record.",
          riskOfBias: "Not formally assessed in catalog maintenance pass.",
          sampleSize: "See source record.",
          sourceType:
            candidate.source === DbSourceKind.CLINICALTRIALS_GOV
              ? "CLINICAL_TRIAL_RECORD"
              : "SYSTEMATIC_REVIEW"
        });
      }

      await syncSourcePacketForClaim(candidate.claimId);
      await syncClaimStudyLinksForClaim(candidate.claimId);
      result.accepted.push(candidate.dedupeKey);
    } catch (error) {
      result.errors.push(
        `accept ${candidate.dedupeKey}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return result;
}

function classifyPendingCandidate(candidate: {
  claimId: string | null;
  externalId: string;
  interventionId: string | null;
  query: string;
  source: DbSourceKind;
  title: string;
  triageScore: number;
}): "accept" | "reject" | "skip" {
  const title = candidate.title.toLowerCase();

  if (!candidate.interventionId || !candidate.claimId) {
    return "reject";
  }

  if (REJECT_TITLE_PATTERNS.some((pattern) => pattern.test(candidate.title))) {
    return "reject";
  }

  if (isVitaminDSafetyMismatch(candidate)) {
    return "reject";
  }

  if (candidate.interventionId === "ashwagandha" && candidate.claimId === "ashwagandha-safety") {
    if (
      candidate.triageScore < 70 ||
      title.includes("narrative review") ||
      title.includes("multivitamin") ||
      title.includes("hypothyroidism") ||
      title.includes("cognitive disorders")
    ) {
      return candidate.triageScore >= 60 && title.includes("safety") ? "skip" : "reject";
    }
  }

  if (candidate.interventionId === "ashwagandha" && candidate.claimId === "ashwagandha-safety") {
    if (title.includes("sleep") && !title.includes("safety") && !title.includes("tolerability")) {
      return "reject";
    }
  }

  const keywords = INTERVENTION_KEYWORDS[candidate.interventionId] ?? [candidate.interventionId];
  const titleMatches = keywords.some((keyword) => title.includes(keyword));

  if (!titleMatches) {
    return "reject";
  }

  if (candidate.triageScore >= 70) {
    return "accept";
  }

  if (candidate.triageScore >= 60 && candidate.source === DbSourceKind.PUBMED) {
    if (
      candidate.interventionId === "berberine" &&
      candidate.claimId === "berberine-safety" &&
      (title.includes("randomized") || title.includes("clinical trial"))
    ) {
      return "accept";
    }

    if (
      candidate.interventionId === "omega-3" &&
      candidate.claimId === "omega-3-cv-events" &&
      (title.includes("cardiovascular") || title.includes("meta-analysis"))
    ) {
      return "accept";
    }

    if (
      candidate.interventionId === "beta-alanine" &&
      candidate.claimId === "beta-alanine-safety" &&
      title.includes("beta-alanine")
    ) {
      return "accept";
    }
  }

  return "reject";
}

function isVitaminDSafetyMismatch(candidate: {
  claimId: string | null;
  interventionId: string | null;
  query: string;
  title: string;
}) {
  if (candidate.interventionId !== "vitamin-d") {
    return false;
  }

  const title = candidate.title.toLowerCase();
  const hasVitaminDContext =
    title.includes("vitamin d") ||
    title.includes("vitamin d3") ||
    title.includes("cholecalciferol") ||
    title.includes("25(oh)d");

  if (!hasVitaminDContext) {
    return true;
  }

  if (candidate.claimId === "vitamin-d-deficiency" && title.includes("warts")) {
    return true;
  }

  if (
    candidate.claimId === "vitamin-d-deficiency" &&
    title.includes("asthma") &&
    !title.includes("safety")
  ) {
    return true;
  }

  return false;
}

async function trackTrials() {
  const result = {
    created: [] as string[],
    updated: [] as string[],
    removed: [] as string[]
  };

  await prisma.trial.delete({ where: { id: "pubmed-api" } }).catch(() => undefined);
  result.removed.push("pubmed-api");

  const acceptedNcts = await prisma.sourceCandidate.findMany({
    where: {
      decision: DbSourceCandidateDecision.ACCEPTED,
      source: DbSourceKind.CLINICALTRIALS_GOV,
      interventionId: { not: null }
    },
    orderBy: [{ triageScore: "desc" }, { title: "asc" }]
  });

  const seenInterventions = new Set<string>();

  for (const candidate of acceptedNcts) {
    if (!candidate.interventionId || seenInterventions.has(candidate.interventionId)) {
      continue;
    }

    const nctId = normaliseNctId(candidate.externalId);
    const trialId = `trial-${candidate.interventionId}-${nctId.toLowerCase()}`;
    const existing = await prisma.trial.findFirst({
      where: { interventionId: candidate.interventionId }
    });

    const data = {
      interventionId: candidate.interventionId,
      title: candidate.title,
      status: DbTrialStatus.RECRUITING,
      phase: "See registry record",
      enrollment: "See registry record",
      conditions: [],
      interventions: [candidate.interventionId],
      outcomes: [],
      evidenceImpact: DbEvidenceMomentum.INCREASING,
      url: candidate.url,
      nctId,
      resultsPosted: false,
      lastUpdateDate: new Date()
    };

    if (existing) {
      await prisma.trial.update({
        where: { id: existing.id },
        data
      });
      result.updated.push(existing.id);
    } else {
      await prisma.trial.create({
        data: {
          id: trialId,
          ...data
        }
      });
      result.created.push(trialId);
    }

    seenInterventions.add(candidate.interventionId);
  }

  const interventions = await prisma.intervention.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  for (const intervention of interventions) {
    const existing = await prisma.trial.findFirst({
      where: { interventionId: intervention.id }
    });

    if (existing) {
      continue;
    }

    const trialId = `trial-watch-${intervention.id}`;
    await prisma.trial.create({
      data: {
        id: trialId,
        interventionId: intervention.id,
        title: `${intervention.name} — registry monitoring placeholder`,
        status: DbTrialStatus.RESULTS_PENDING,
        phase: "Not linked",
        enrollment: "Not linked",
        conditions: ["Evidence monitoring"],
        interventions: [intervention.name],
        outcomes: ["Pending curated trial linkage"],
        evidenceImpact: DbEvidenceMomentum.STABLE,
        url: "https://clinicaltrials.gov/",
        resultsPosted: false,
        lastUpdateDate: new Date()
      }
    });
    result.created.push(trialId);
  }

  return result;
}

async function ensureSourceCandidateReference(candidate: {
  externalId: string;
  publishedYear: number | null;
  source: DbSourceKind;
  title: string;
  url: string;
}) {
  const referenceId = sourceCandidateReferenceId(candidate);
  const identifier =
    candidate.source === DbSourceKind.PUBMED
      ? `PMID: ${normalisePubMedId(candidate.externalId)}`
      : normaliseNctId(candidate.externalId);

  await upsertReference({
    id: referenceId,
    identifier,
    source: candidate.source,
    title: candidate.title,
    url: candidate.url,
    year: candidate.publishedYear ?? undefined
  });

  return referenceId;
}

function sourceCandidateReferenceId(candidate: { externalId: string; source: DbSourceKind }) {
  const sourceSlug =
    candidate.source === DbSourceKind.CLINICALTRIALS_GOV ? "clinicaltrials-gov" : "pubmed";
  const externalIdSlug = candidate.externalId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `ref-${sourceSlug}-${externalIdSlug || "candidate"}`;
}

function normalisePubMedId(value: string) {
  return value.trim().replace(/^pmid[:\s]*/i, "");
}

function normaliseNctId(value: string) {
  const trimmed = value.trim().toUpperCase();
  return trimmed.startsWith("NCT") ? trimmed : `NCT${trimmed}`;
}

async function upsertReference(input: {
  id: string;
  identifier?: string;
  source: DbSourceKind;
  title: string;
  url: string;
  year?: number;
}) {
  await prisma.reference.upsert({
    create: {
      id: input.id,
      identifier: input.identifier ?? null,
      source: input.source,
      title: input.title,
      url: input.url,
      year: input.year ?? null
    },
    update: {
      identifier: input.identifier ?? null,
      source: input.source,
      title: input.title,
      url: input.url,
      year: input.year ?? null
    },
    where: { id: input.id }
  });
}

async function upsertStudy(input: {
  id: string;
  referenceId: string;
  title: string;
  year: number;
  source: string;
  sourceType: DbStudyType;
  sampleSize: string;
  population: string;
  interventionName: string;
  outcomes: string[];
  adverseEvents: string;
  fundingConflicts: string;
  riskOfBias: string;
  pmid?: string;
  nctId?: string;
}) {
  await prisma.study.upsert({
    create: {
      id: input.id,
      referenceId: input.referenceId,
      title: input.title,
      year: input.year,
      source: input.source,
      sourceType: input.sourceType,
      sampleSize: input.sampleSize,
      population: input.population,
      interventionName: input.interventionName,
      outcomes: input.outcomes,
      adverseEvents: input.adverseEvents,
      fundingConflicts: input.fundingConflicts,
      riskOfBias: input.riskOfBias,
      pmid: input.pmid ?? null,
      nctId: input.nctId ?? null
    },
    update: {
      referenceId: input.referenceId,
      title: input.title,
      year: input.year,
      source: input.source,
      sourceType: input.sourceType,
      sampleSize: input.sampleSize,
      population: input.population,
      interventionName: input.interventionName,
      outcomes: input.outcomes,
      adverseEvents: input.adverseEvents,
      fundingConflicts: input.fundingConflicts,
      riskOfBias: input.riskOfBias,
      pmid: input.pmid ?? null,
      nctId: input.nctId ?? null
    },
    where: { id: input.id }
  });
}

async function upsertClaimReference(claimId: string, referenceId: string, relevance: number) {
  await prisma.claimReference.upsert({
    create: {
      claimId,
      note: REVIEW_NOTE,
      referenceId,
      relevance
    },
    update: {
      note: REVIEW_NOTE,
      relevance
    },
    where: {
      claimId_referenceId: {
        claimId,
        referenceId
      }
    }
  });
}

async function catalogSnapshot() {
  const [packetGroups, pending, trials, focusPackets] = await Promise.all([
    prisma.sourcePacket.groupBy({
      by: ["status"],
      where: { current: true },
      _count: { _all: true }
    }),
    prisma.sourceCandidate.count({
      where: { decision: DbSourceCandidateDecision.PENDING_REVIEW }
    }),
    prisma.trial.count(),
    prisma.sourcePacket.findMany({
      where: {
        current: true,
        claimId: {
          in: [
            "ashwagandha-sleep",
            "ashwagandha-fertility-hormones",
            "creatine-strength",
            "omega-3-cv-events",
            "vitamin-d-deficiency"
          ]
        }
      },
      select: { claimId: true, status: true }
    })
  ]);

  return {
    sourcePacketStatus: packetGroups.map((group) => ({
      status: group.status,
      count: group._count._all
    })),
    pendingCandidates: pending,
    trialCount: trials,
    focusPackets
  };
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
