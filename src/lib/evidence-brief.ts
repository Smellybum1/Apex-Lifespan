import { isAdverseDirectionClaim } from "@/lib/claim-direction";
import { compositeScore } from "@/lib/scoring";
import type { ClaimSourcePacket } from "@/lib/source-packet";
import type {
  Claim,
  ConfidenceLevel,
  Intervention,
  OutcomeArea,
  SafetyAlert,
  Study
} from "@/lib/types";

/**
 * Reader-facing evidence model.
 *
 * The catalog mixes three very different kinds of row under one `Claim` type:
 *
 *  - real conclusions somebody actually wrote ("strength, power and lean mass ..."),
 *  - safety/tolerability context rows attached to every intervention,
 *  - pipeline scaffolding created when sources were queued but never reviewed
 *    ("X has accepted source leads for cognition that need structured evidence review").
 *
 * The scaffolding rows carry placeholder subscores that still produce a
 * respectable-looking composite, so rendering them like conclusions is what makes
 * the supplement pages unreadable. Everything here exists to keep those three
 * kinds apart and to translate what survives into plain English.
 */

export type ClaimKind = "conclusion" | "safety-context" | "pipeline" | "watchlist";

export type EvidenceTier = "strong" | "good" | "early" | "unclear" | "caution";

export interface OutcomeVerdict {
  claimId: string;
  outcome: OutcomeArea;
  /** Plain-language outcome name, e.g. "Muscle and strength". */
  topic: string;
  tier: EvidenceTier;
  tierLabel: string;
  /** 0-4, for the strength meter. */
  strength: number;
  /** One or two sentences on what the evidence actually says. */
  finding: string;
  /** The claim-specific limit, with generic boilerplate stripped. */
  caveat: string | null;
  humanReviewed: boolean;
  studyCount: number;
  referenceCount: number;
  /** e.g. "23 meta-analyses, 7 trials" — null when nothing is extracted. */
  studyMix: string | null;
  /** Only set when the underlying scores were actually curated. */
  score: number | null;
}

export interface PendingOutcome {
  outcome: OutcomeArea;
  topic: string;
  referenceCount: number;
}

export interface SupplementBrief {
  intervention: Intervention;
  /** Headline verdict for the whole supplement. */
  verdict: {
    tier: EvidenceTier;
    label: string;
    /** Two or three sentences of plain English. */
    summary: string;
  };
  /** Verdicts good enough to lead with. */
  supported: OutcomeVerdict[];
  /** Real conclusions that are early, mixed or inconclusive. */
  emerging: OutcomeVerdict[];
  /** Adverse-direction or safety/regulatory-flagged conclusions. */
  cautions: OutcomeVerdict[];
  /** Outcomes with sources queued but no reviewed conclusion yet. */
  pending: PendingOutcome[];
  doesNotProve: string[];
  safety: {
    summary: string;
    interactions: string | null;
    /** Claim-level safety findings, cleaned of pipeline bookkeeping. */
    notes: string[];
    alerts: SafetyAlert[];
    /** True for peptides and prescription-only / regulatory-flagged entries. */
    clinicianTerritory: boolean;
    /** Topics the catalog watches for a regulated entry, with no conclusion drawn. */
    trackedTopics: string[];
  };
  evidenceBase: {
    referenceCount: number;
    studyCount: number;
    studyMix: string | null;
    humanReviewedOutcomes: number;
    totalOutcomes: number;
  };
  lastReviewed: string;
}

const TOPIC_NAMES: Record<OutcomeArea, string> = {
  "Mortality/lifespan": "Living longer",
  "Cardiovascular events": "Heart attack and stroke",
  "LDL/ApoB/lipids": "Cholesterol",
  "Blood pressure": "Blood pressure",
  "Glucose/insulin/HbA1c": "Blood sugar",
  Inflammation: "Inflammation",
  Cognition: "Memory and thinking",
  Sleep: "Sleep",
  "Mood/stress": "Mood and stress",
  "Muscle/strength": "Muscle and strength",
  "VO2 max/endurance": "Endurance and fitness",
  "Joint/tendon/skin": "Joints, tendons and skin",
  "Eye health": "Eye health",
  "Immune/respiratory": "Immunity, colds and flu",
  "Fertility/hormones": "Fertility and hormones",
  "Biological aging clocks": "Biological age markers",
  "Safety/adverse effects": "Side effects"
};

const TIER_LABELS: Record<EvidenceTier, string> = {
  strong: "Solid evidence",
  good: "Decent evidence, with conditions",
  early: "Early evidence",
  unclear: "Too early to say",
  caution: "Reason for caution"
};

const TIER_STRENGTH: Record<EvidenceTier, number> = {
  strong: 4,
  good: 3,
  early: 2,
  unclear: 1,
  caution: 0
};

/**
 * Trailing sentences the ingestion pipeline appends to almost every summary.
 * They describe the pipeline, not the supplement, so they never reach a reader.
 */
const SUMMARY_NOISE_PREFIXES = [
  "This is based on ",
  "Representative extracted text:",
  "Keep the conclusion scoped to",
  "Safety evidence is kept separate from efficacy",
  "The current claim should be treated as low-certainty",
  "Local abstract/source metadata reports:"
];

/** Same idea, for boilerplate that embeds the intervention name. */
const SUMMARY_NOISE_PATTERNS = [
  /^.{1,60} has local safety and tolerability context attached to this claim\.?$/i,
  /^The local (?:source set|record) includes .{0,80}material, but the captured conclusion text is still too thin/i
];

const UNCERTAINTY_NOISE_PREFIXES = [
  "Uncertainty remains because current local confidence is",
  "What would change the score:",
  "population, dose/form, duration, comparator, product quality",
  "Keep population, endpoint,"
];

const GENERIC_CAVEAT_FRAGMENTS = [
  "remain claim-specific boundaries",
  "does not prove product-level safety",
  "this row remains an unreviewed AI draft"
];

/** Sentences addressed to the pipeline rather than to a reader. */
const INTERNAL_VOICE_PATTERN =
  /\bthe dashboard should\b|\bthis row (?:is|remains)\b|\bkeep this as source-led\b|source packets? (?:are|is) curated|\buntil the linked\b|\bextract(?:ed)? (?:actual )?(?:effect )?results after review\b/i;

const PIPELINE_CLAIM_PATTERN =
  /accepted source leads|need structured evidence review|needs structured evidence review/i;

const SAFETY_CONTEXT_PATTERN =
  /tolerability, interaction, and product[- ]quality profile/i;

/**
 * Placeholder rows generated for prescription-only and peptide entries. Every
 * one repeats the same regulatory boilerplate, so they are collapsed into a
 * single list of tracked topics instead of being rendered as findings.
 */
const WATCHLIST_CLAIM_PATTERN =
  /is tracked for .+ as a regulatory, safety, or therapeutic-watchlist evidence row/i;

/**
 * Findings that report an absence of evidence. They are useful, but they belong
 * in "what it will not do" rather than in a list of things it might help with.
 */
const NULL_FINDING_PATTERN =
  /does not (?:yet )?(?:show|support|establish|demonstrate|contain)|no (?:direct )?(?:human )?evidence|not yet support a settled|remains unproven|is not established/i;

const CAUTION_LABELS = new Set([
  "Safety Concern",
  "Avoid / Not Recommended",
  "Requires Clinician Oversight"
]);

export function outcomeTopic(outcome: OutcomeArea) {
  return TOPIC_NAMES[outcome] ?? outcome;
}

export function tierLabel(tier: EvidenceTier) {
  return TIER_LABELS[tier];
}

/**
 * Which of the three row kinds this claim is. Detection is text-based on purpose:
 * the `evidenceGrade` sentinel only marks about an eighth of the scaffolding.
 */
export function classifyClaim(claim: Claim): ClaimKind {
  if (PIPELINE_CLAIM_PATTERN.test(claim.claimText)) {
    return "pipeline";
  }

  if (claim.populationStudied === "Manual review required") {
    return "pipeline";
  }

  if (WATCHLIST_CLAIM_PATTERN.test(claim.summary ?? claim.claimText)) {
    return "watchlist";
  }

  // Everything filed under the safety outcome reads as safety context, whatever
  // the claim text happens to say. Readers expect it in one place.
  if (claim.outcome === "Safety/adverse effects" || SAFETY_CONTEXT_PATTERN.test(claim.claimText)) {
    return "safety-context";
  }

  return "conclusion";
}

/**
 * True when the conclusion is "we found nothing", which is a limit, not a benefit.
 * Only the opening sentence counts: plenty of genuinely positive findings end with
 * a "does not establish ..." qualifier, and those are still findings.
 */
export function isNullFinding(claim: Claim) {
  const sentences = splitSentences(readableFinding(claim));
  const [opening] = sentences;

  if (!opening || !NULL_FINDING_PATTERN.test(opening)) {
    return false;
  }

  // "Nothing settled yet, but reviewers noted X" still tells the reader something.
  return sentences.length === 1 || claim.reviewStatus !== "Human reviewed";
}

/**
 * A composite is only meaningful when the dimension scores were curated for this
 * claim. Scaffolded rows ship with high directness/rigor defaults that would
 * otherwise render as a confident-looking 7.5.
 */
export function readerScore(claim: Claim, kind: ClaimKind) {
  if (kind !== "conclusion") {
    return null;
  }

  if (claim.confidenceLevel === "Very low" && claim.reviewStatus !== "Human reviewed") {
    return null;
  }

  if (!isInformativeDetail(claim.effectSize)) {
    return null;
  }

  return compositeScore(claim.scores);
}

/**
 * Depth signals that survive both packet shapes. The dashboard overview builds
 * packets from snapshots, which carry reference counts but no study rows, so
 * tiering has to fall back to those counts or the same supplement would rank
 * differently on the index and on its own page.
 */
function packetDepth(packet: ClaimSourcePacket | undefined) {
  if (!packet) {
    return { depthKnown: true, extracted: 0, hasHumanTrials: false };
  }

  const { evidenceDepth, completeness } = packet;
  // Snapshot packets carry reference counts but no study rows. Study design is
  // simply unknown there, so the design-based demotion is skipped rather than
  // guessed either way — guessing would make the index and the detail page
  // disagree about the same supplement.
  const depthKnown = evidenceDepth.totalExtractedStudies > 0 || completeness.extractedReferences === 0;

  return {
    depthKnown,
    extracted: evidenceDepth.totalExtractedStudies || completeness.extractedReferences,
    hasHumanTrials:
      evidenceDepth.randomizedControlledTrials +
        evidenceDepth.metaAnalyses +
        evidenceDepth.systematicReviews >
      0
  };
}

export function claimTier(claim: Claim, packet: ClaimSourcePacket | undefined): EvidenceTier {
  if (isAdverseDirectionClaim(claim) || CAUTION_LABELS.has(claim.finalLabel)) {
    return "caution";
  }

  const reviewed = claim.reviewStatus === "Human reviewed";
  const { depthKnown, extracted, hasHumanTrials } = packetDepth(packet);

  if (claim.finalLabel === "Insufficient Evidence") {
    return "unclear";
  }

  if (claim.finalLabel === "Core Evidence-Based" && reviewed && (hasHumanTrials || !depthKnown)) {
    return "strong";
  }

  const byConfidence: Record<ConfidenceLevel, EvidenceTier> = {
    High: reviewed ? "strong" : "good",
    Moderate: "good",
    Low: "early",
    "Very low": "unclear"
  };

  const tier = byConfidence[claim.confidenceLevel];

  // Never promote a claim above "early" when nothing has actually been extracted.
  if (extracted === 0 && (tier === "strong" || tier === "good")) {
    return "early";
  }

  if (tier === "strong" && depthKnown && !hasHumanTrials) {
    return "good";
  }

  return tier;
}

/** Strips pipeline bookkeeping out of a stored summary. */
export function readableFinding(claim: Claim) {
  const source = claim.summary?.trim() ? claim.summary : claim.claimText;
  const kept = splitSentences(source).filter((sentence) => {
    if (startsWithAny(sentence, SUMMARY_NOISE_PREFIXES)) {
      return false;
    }

    return !SUMMARY_NOISE_PATTERNS.some((pattern) => pattern.test(sentence));
  })
    .map(stripInternalClauses)
    .filter(Boolean);

  let text = kept.join(" ").trim() || claim.claimText.trim();

  // Several summaries are only the claim's headline noun phrase once the
  // bookkeeping is stripped ("Cardiovascular prevention."). Those need the
  // effect or relevance note to become a sentence a reader can use.
  if (text.length < 90) {
    const addition = [claim.effectSize, claim.clinicalRelevance].find(isInformativeDetail);

    if (addition && !text.includes(addition)) {
      text = `${punctuate(text)} ${punctuate(addition)}`;
    }
  }

  return punctuate(text);
}

/**
 * Instructions to the pipeline are often tacked onto the end of an otherwise
 * useful sentence, after a semicolon. Drop the clause, keep the sentence.
 */
function stripInternalClauses(sentence: string) {
  const clauses = sentence
    .split(/;\s+/)
    .filter((clause) => !INTERNAL_VOICE_PATTERN.test(clause));

  if (clauses.length === 0) {
    return "";
  }

  return punctuate(clauses.join("; ").replace(/[;,]\s*$/, ""));
}

/**
 * Several safety summaries are pipeline to-do notes. A reader needs to know the
 * record is empty, not be handed the internal instruction.
 */
export function readableSafetySummary(summary: string) {
  if (/not reviewed yet|until source packets are curated|require safety, adverse-event/i.test(summary)) {
    return "Nobody has reviewed the safety evidence for this one yet. Treat that as a gap in this record, not as reassurance that it is safe.";
  }

  return summary.replace(/\bin the seed data\b/gi, "in this record");
}

function isInformativeDetail(value: string | undefined) {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();

  if (trimmed.length < 12) {
    return false;
  }

  // Pipeline to-do notes masquerading as content.
  if (/not reviewed yet|before public claims|require(?:s)? source-backed review/i.test(trimmed)) {
    return false;
  }

  return !/^(unknown|not established|not reviewed|manual review)/i.test(trimmed);
}

/** Keeps the claim-specific part of `uncertainty`, drops the generated recitals. */
export function readableCaveat(claim: Claim) {
  if (!claim.uncertainty) {
    return null;
  }

  const kept = splitSentences(claim.uncertainty).filter((sentence) => {
    if (startsWithAny(sentence, UNCERTAINTY_NOISE_PREFIXES)) {
      return false;
    }

    return !GENERIC_CAVEAT_FRAGMENTS.some((fragment) => sentence.includes(fragment));
  })
    .map(stripInternalClauses)
    .filter(Boolean);

  const text = kept.join(" ").trim();

  return text ? truncateAtWord(punctuate(text), 260) : null;
}

export function summarizeStudyMix(studies: Study[]) {
  if (studies.length === 0) {
    return null;
  }

  const counts = new Map<string, number>();

  for (const study of studies) {
    const label = readerStudyType(study);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => `${count} ${count === 1 ? label : pluralizeStudyType(label)}`)
    .join(", ");
}

export function buildSupplementBrief({
  intervention,
  claims,
  packets,
  safetyAlerts
}: {
  intervention: Intervention;
  claims: Claim[];
  packets: Map<string, ClaimSourcePacket>;
  safetyAlerts: SafetyAlert[];
}): SupplementBrief {
  const conclusions: OutcomeVerdict[] = [];
  const nullFindings: OutcomeVerdict[] = [];
  const safetyContext: Claim[] = [];
  const watchlistTopics: string[] = [];
  const pending: PendingOutcome[] = [];
  const seenPendingOutcomes = new Set<OutcomeArea>();

  for (const claim of claims) {
    const kind = classifyClaim(claim);
    const packet = packets.get(claim.id);

    if (kind === "pipeline") {
      if (!seenPendingOutcomes.has(claim.outcome)) {
        seenPendingOutcomes.add(claim.outcome);
        pending.push({
          outcome: claim.outcome,
          topic: outcomeTopic(claim.outcome),
          referenceCount: packet?.references.length ?? claim.keyReferenceIds.length
        });
      }

      continue;
    }

    if (kind === "watchlist") {
      watchlistTopics.push(outcomeTopic(claim.outcome));
      continue;
    }

    if (kind === "safety-context") {
      safetyContext.push(claim);
      continue;
    }

    const verdict = buildOutcomeVerdict(claim, packet);

    if (isNullFinding(claim) && verdict.tier !== "caution") {
      nullFindings.push(verdict);
      continue;
    }

    conclusions.push(verdict);
  }

  // A pipeline row is only worth mentioning when nothing else covers that outcome.
  const coveredOutcomes = new Set(
    [...conclusions, ...nullFindings].map((verdict) => verdict.outcome)
  );
  const trackedTopics = [...new Set(watchlistTopics)];
  const remainingPending = pending.filter((row) => !coveredOutcomes.has(row.outcome));

  const cautions = conclusions.filter((verdict) => verdict.tier === "caution");
  const supported = conclusions
    .filter((verdict) => verdict.tier === "strong" || verdict.tier === "good")
    .sort(byStrengthThenEvidence);
  const emerging = conclusions
    .filter((verdict) => verdict.tier === "early" || verdict.tier === "unclear")
    .sort(byStrengthThenEvidence);

  const allStudies = dedupeStudies(claims.flatMap((claim) => packets.get(claim.id)?.studies ?? []));
  // Snapshot-built packets carry ids but no hydrated reference rows, so fall
  // back to the id list rather than reporting zero sources.
  const allReferenceIds = new Set(
    claims.flatMap((claim) => packets.get(claim.id)?.referenceIds ?? claim.keyReferenceIds)
  );

  // A single "Regulatory Concern" claim is not enough — omega-3 carries one
  // because a prescription-strength form exists, and branding the whole entry
  // prescription-only over that would be wrong. Peptides always qualify;
  // watchlist drugs qualify when the regulatory flag is actually present.
  const clinicianTerritory =
    intervention.category === "Peptide/biologic" ||
    (intervention.category === "Drug/geroprotector watchlist" &&
      claims.some((claim) => claim.finalLabel === "Regulatory Concern")) ||
    claims.some((claim) => claim.finalLabel === "Requires Clinician Oversight");

  return {
    intervention,
    verdict: buildHeadlineVerdict({
      intervention,
      supported,
      emerging,
      cautions,
      pending: remainingPending,
      clinicianTerritory
    }),
    supported,
    emerging,
    cautions: cautions.sort(byStrengthThenEvidence),
    pending: remainingPending.sort((a, b) => b.referenceCount - a.referenceCount),
    doesNotProve: buildDoesNotProve({ intervention, nullFindings, supported }),
    safety: {
      summary: readableSafetySummary(intervention.safetySummary),
      interactions: isInformativeDetail(intervention.interactionSummary)
        ? intervention.interactionSummary
        : null,
      notes: safetyContext
        .map((claim) => readableFinding(claim))
        .filter(isSubstantiveSafetyNote),
      alerts: safetyAlerts,
      clinicianTerritory,
      trackedTopics
    },
    evidenceBase: {
      referenceCount: allReferenceIds.size,
      studyCount: allStudies.length,
      studyMix: summarizeStudyMix(allStudies),
      humanReviewedOutcomes: conclusions.filter((verdict) => verdict.humanReviewed).length,
      totalOutcomes: conclusions.length
    },
    lastReviewed: intervention.lastReviewed
  };
}

export interface SupplementIndexEntry {
  intervention: Intervention;
  tier: EvidenceTier;
  label: string;
  /** One short line for a card, e.g. "Solid evidence for muscle and strength". */
  headline: string;
  topTopics: string[];
  cautionTopics: string[];
  reviewedOutcomes: number;
  pendingOutcomes: number;
  sourceCount: number;
}

const TIER_ORDER: Record<EvidenceTier, number> = {
  strong: 0,
  good: 1,
  early: 2,
  caution: 3,
  unclear: 4
};

/**
 * Compact per-supplement rollup for the dashboard index. Built from the same
 * brief the detail page renders, so a supplement cannot be described one way on
 * the index and another way on its own page.
 */
export function buildSupplementIndex({
  interventions,
  claims,
  packets,
  safetyAlerts
}: {
  interventions: Intervention[];
  claims: Claim[];
  packets: Map<string, ClaimSourcePacket>;
  safetyAlerts: SafetyAlert[];
}): SupplementIndexEntry[] {
  const claimsByIntervention = new Map<string, Claim[]>();

  for (const claim of claims) {
    const bucket = claimsByIntervention.get(claim.interventionId);

    if (bucket) {
      bucket.push(claim);
    } else {
      claimsByIntervention.set(claim.interventionId, [claim]);
    }
  }

  return interventions
    .map((intervention) => {
      const brief = buildSupplementBrief({
        intervention,
        claims: claimsByIntervention.get(intervention.id) ?? [],
        packets,
        safetyAlerts: safetyAlerts.filter((alert) => alert.interventionId === intervention.id)
      });
      const leading = [...brief.supported, ...brief.emerging].slice(0, 2);

      return {
        intervention,
        tier: brief.verdict.tier,
        label: brief.verdict.label,
        headline: indexHeadline(brief, leading),
        topTopics: leading.map((verdict) => verdict.topic),
        cautionTopics: brief.cautions.map((verdict) => verdict.topic),
        reviewedOutcomes: brief.evidenceBase.humanReviewedOutcomes,
        pendingOutcomes: brief.pending.length,
        sourceCount: brief.evidenceBase.referenceCount
      };
    })
    .sort(
      (a, b) =>
        TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
        b.reviewedOutcomes - a.reviewedOutcomes ||
        a.intervention.name.localeCompare(b.intervention.name)
    );
}

function indexHeadline(brief: SupplementBrief, leading: OutcomeVerdict[]) {
  if (brief.safety.clinicianTerritory) {
    return "Prescription or clinician territory — not a self-use supplement.";
  }

  const strong = brief.supported.filter((verdict) => verdict.tier === "strong");

  if (strong.length > 0) {
    return `Solid evidence for ${naturalJoin(strong.map((verdict) => verdict.topic.toLowerCase()))}.`;
  }

  if (brief.supported.length > 0) {
    return `Reasonable evidence for ${naturalJoin(
      brief.supported.slice(0, 2).map((verdict) => verdict.topic.toLowerCase())
    )}, with conditions.`;
  }

  if (leading.length > 0) {
    return `Early or mixed signals for ${naturalJoin(
      leading.map((verdict) => verdict.topic.toLowerCase())
    )}.`;
  }

  if (brief.cautions.length > 0) {
    return `Flagged for caution on ${naturalJoin(
      brief.cautions.slice(0, 2).map((verdict) => verdict.topic.toLowerCase())
    )}.`;
  }

  return "No reviewed conclusion yet — sources collected but not read.";
}

function buildOutcomeVerdict(claim: Claim, packet: ClaimSourcePacket | undefined): OutcomeVerdict {
  const kind = classifyClaim(claim);
  const tier = claimTier(claim, packet);
  const studies = packet?.studies ?? [];

  return {
    claimId: claim.id,
    outcome: claim.outcome,
    topic: outcomeTopic(claim.outcome),
    tier,
    tierLabel: TIER_LABELS[tier],
    strength: TIER_STRENGTH[tier],
    finding: readableFinding(claim),
    caveat: readableCaveat(claim),
    humanReviewed: claim.reviewStatus === "Human reviewed",
    studyCount: studies.length,
    referenceCount: packet?.references.length ?? claim.keyReferenceIds.length,
    studyMix: summarizeStudyMix(studies),
    score: readerScore(claim, kind)
  };
}

function buildHeadlineVerdict({
  intervention,
  supported,
  emerging,
  cautions,
  pending,
  clinicianTerritory
}: {
  intervention: Intervention;
  supported: OutcomeVerdict[];
  emerging: OutcomeVerdict[];
  cautions: OutcomeVerdict[];
  pending: PendingOutcome[];
  clinicianTerritory: boolean;
}) {
  const name = intervention.name;
  const strong = supported.filter((verdict) => verdict.tier === "strong");
  const sentences: string[] = [];

  let tier: EvidenceTier;
  let label: string;

  if (clinicianTerritory) {
    tier = "caution";
    label = "Not a self-use supplement";
    sentences.push(
      `${name} sits in prescription or clinician-supervised territory in Australia, so the evidence below is background reading rather than a reason to try it.`
    );
  } else if (strong.length > 0) {
    tier = "strong";
    label = strong.length === 1 ? "Works for one specific thing" : "Genuinely useful";
    sentences.push(
      `${name} has solid evidence for ${naturalJoin(strong.map((verdict) => verdict.topic.toLowerCase()))}.`
    );
  } else if (supported.length > 0) {
    tier = "good";
    label = "May help, in the right situation";
    sentences.push(
      `${name} has reasonable evidence for ${naturalJoin(
        supported.slice(0, 3).map((verdict) => verdict.topic.toLowerCase())
      )}, but it depends on who you are and what you are taking it for.`
    );
  } else if (emerging.length > 0) {
    tier = "early";
    label = "Promising but unproven";
    sentences.push(
      `Nothing about ${name} is settled yet. The most-studied areas are ${naturalJoin(
        emerging.slice(0, 3).map((verdict) => verdict.topic.toLowerCase())
      )}, and the evidence there is early or mixed.`
    );
  } else if (cautions.length > 0) {
    tier = "caution";
    label = "Flagged for caution";
    sentences.push(
      `The only reviewed conclusions for ${name} are cautions rather than benefits, covering ${naturalJoin(
        cautions.slice(0, 3).map((verdict) => verdict.topic.toLowerCase())
      )}.`
    );
  } else {
    tier = "unclear";
    label = "Not enough evidence yet";
    sentences.push(
      `There is not yet enough reviewed evidence here to say whether ${name} does anything useful.`
    );
  }

  const others = [...supported, ...emerging].filter((verdict) => verdict.tier !== "strong");

  if (strong.length > 0 && others.length > 0) {
    sentences.push(
      `Other areas people take it for — ${naturalJoin(
        others.slice(0, 3).map((verdict) => verdict.topic.toLowerCase())
      )} — are not settled.`
    );
  }

  if (cautions.length > 0 && !clinicianTerritory) {
    sentences.push(
      `Worth knowing: the record flags ${naturalJoin(
        cautions.slice(0, 2).map((verdict) => verdict.topic.toLowerCase())
      )} as a caution rather than a benefit.`
    );
  }

  if (pending.length > 0) {
    sentences.push(
      `Research on ${pending.length} other ${pending.length === 1 ? "area" : "areas"} has been collected but not reviewed yet.`
    );
  }

  return { tier, label, summary: sentences.join(" ") };
}

function buildDoesNotProve({
  intervention,
  nullFindings,
  supported
}: {
  intervention: Intervention;
  nullFindings: OutcomeVerdict[];
  supported: OutcomeVerdict[];
}) {
  const rows: string[] = [];
  const lifespan = nullFindings.find((verdict) => verdict.outcome === "Mortality/lifespan");

  if (lifespan) {
    rows.push(lifespan.finding);
  } else {
    rows.push(
      `Nothing here shows that ${intervention.name} makes you live longer. No human lifespan or mortality evidence is on file.`
    );
  }

  for (const verdict of nullFindings) {
    if (verdict.outcome === "Mortality/lifespan") {
      continue;
    }

    rows.push(`${verdict.topic}: ${verdict.finding}`);
  }

  if (supported.length > 0) {
    rows.push(
      `Evidence for ${naturalJoin(
        supported.slice(0, 2).map((verdict) => verdict.topic.toLowerCase())
      )} does not carry over to other outcomes. Each one has to be shown on its own.`
    );
  }

  rows.push(
    "Results come from the specific doses, forms, durations and groups of people that were studied. A different product at a different dose may behave differently."
  );

  rows.push(
    "Nothing here confirms that any particular product on a shelf is safe, accurately labelled, or approved for sale in Australia."
  );

  return rows;
}

/**
 * Safety rows exist for almost every intervention and many say nothing beyond
 * "safety context is attached". Those add noise rather than protection.
 */
function isSubstantiveSafetyNote(note: string) {
  // Short notes can still matter ("Avoid with warfarin."), so filter on the
  // known boilerplate rather than on length alone.
  if (note.length < 16) {
    return false;
  }

  if (/^General safety, tolerability, interaction, and product-quality profile/i.test(note)) {
    return false;
  }

  return !/has local safety and tolerability context attached/i.test(note);
}

function byStrengthThenEvidence(a: OutcomeVerdict, b: OutcomeVerdict) {
  if (b.strength !== a.strength) {
    return b.strength - a.strength;
  }

  if (b.humanReviewed !== a.humanReviewed) {
    return b.humanReviewed ? 1 : -1;
  }

  return b.studyCount - a.studyCount;
}

function dedupeStudies(studies: Study[]) {
  const byId = new Map<string, Study>();

  for (const study of studies) {
    byId.set(study.id, study);
  }

  return [...byId.values()];
}

function readerStudyType(study: Study) {
  const taxonomy = study.sourceTypeTaxonomy;

  if (taxonomy === "meta-analysis") return "meta-analysis";
  if (taxonomy === "systematic review") return "systematic review";
  if (taxonomy === "RCT") return "randomised trial";
  if (taxonomy === "observational study") return "observational study";
  if (taxonomy === "animal study") return "animal study";
  if (taxonomy === "in vitro/mechanistic") return "lab study";
  if (taxonomy === "unclassified") return UNCLEAR_DESIGN_LABEL;

  switch (study.studyType) {
    case "Meta-analysis":
      return "meta-analysis";
    case "Systematic review":
      return "systematic review";
    case "Randomized controlled trial":
      return "randomised trial";
    case "Observational cohort":
      return "observational study";
    case "Animal study":
      return "animal study";
    case "In vitro/mechanistic":
      return "lab study";
    case "Clinical trial record":
      return "registered trial";
    case "Case report":
      return "case report";
    case "Regulatory safety warning":
      return "safety warning";
    case "Unclassified":
      return UNCLEAR_DESIGN_LABEL;
    default:
      return "study";
  }
}

/**
 * Reader-facing wording for a source whose design could not be established.
 * It must not name a design — the whole point of `StudyType.UNCLASSIFIED` is
 * that we do not know one, and the previous `CASE_REPORT` stopgap asserted
 * "a single unreplicated observation" to readers instead.
 */
const UNCLEAR_DESIGN_LABEL = "study of unclear design";

/** Labels whose plural the suffix rules below would mangle. */
const IRREGULAR_STUDY_TYPE_PLURALS: Record<string, string> = {
  [UNCLEAR_DESIGN_LABEL]: "studies of unclear design"
};

function pluralizeStudyType(label: string) {
  const irregular = IRREGULAR_STUDY_TYPE_PLURALS[label];

  if (irregular) {
    return irregular;
  }

  if (label.endsWith("sis")) {
    return `${label.slice(0, -3)}ses`;
  }

  if (label.endsWith("y")) {
    return `${label.slice(0, -1)}ies`;
  }

  return `${label}s`;
}

/** Case-insensitive so a capitalisation change upstream cannot silently disable a filter. */
function startsWithAny(sentence: string, prefixes: string[]) {
  const lowered = sentence.toLowerCase();

  return prefixes.some((prefix) => lowered.startsWith(prefix.toLowerCase()));
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function punctuate(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return trimmed;
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function truncateAtWord(text: string, limit: number) {
  if (text.length <= limit) {
    return text;
  }

  const clipped = text.slice(0, limit);
  const lastSpace = clipped.lastIndexOf(" ");

  return `${clipped.slice(0, lastSpace > 0 ? lastSpace : limit).replace(/[,;:]$/, "")}…`;
}

function naturalJoin(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];

  // Several topic names already contain "and" ("heart attack and stroke"), and
  // a second one turns the list into mush. Fall back to commas in that case.
  if (items.some((item) => item.includes(" and "))) {
    return items.join(", ");
  }

  if (items.length === 2) return `${items[0]} and ${items[1]}`;

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
