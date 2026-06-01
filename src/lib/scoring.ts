import type { Claim, EvidenceLabel, SafetyAlert, ScoreSet } from "@/lib/types";

export function compositeScore(scores: ScoreSet) {
  const weighted =
    scores.evidenceDirectness * 0.22 +
    scores.evidenceRigor * 0.22 +
    scores.effectSize * 0.18 +
    scores.safety * 0.14 +
    (10 - scores.regulatoryRisk) * 0.1 +
    (10 - scores.hypePenalty) * 0.08 +
    scores.measurability * 0.06;

  return Math.round(weighted * 10) / 10;
}

export function labelTone(label: EvidenceLabel) {
  if (label === "Core Evidence-Based") {
    return "border-spruce/35 bg-teal-50 text-spruce";
  }

  if (label === "Safety Concern" || label === "Avoid / Not Recommended") {
    return "border-danger/35 bg-red-50 text-danger";
  }

  if (
    label === "Regulatory Concern" ||
    label === "Requires Clinician Oversight" ||
    label === "Speculative Watchlist"
  ) {
    return "border-amberline/35 bg-amber-50 text-amberline";
  }

  if (label === "Insufficient Evidence") {
    return "border-slate-300 bg-slate-50 text-slate-700";
  }

  return "border-signal/30 bg-blue-50 text-signal";
}

export function severityTone(severity: SafetyAlert["severity"]) {
  if (severity === "High" || severity === "Avoid") {
    return "bg-red-50 text-danger border-danger/30";
  }

  if (severity === "Clinician review recommended" || severity === "Moderate") {
    return "bg-amber-50 text-amberline border-amberline/30";
  }

  return "bg-teal-50 text-spruce border-spruce/30";
}

export function getClaimScoreRows(claim: Claim) {
  return [
    { label: "Directness", value: claim.scores.evidenceDirectness },
    { label: "Rigor", value: claim.scores.evidenceRigor },
    { label: "Impact", value: claim.scores.effectSize },
    { label: "Safety", value: claim.scores.safety },
    { label: "Measurable", value: claim.scores.measurability },
    { label: "Hype control", value: 10 - claim.scores.hypePenalty }
  ];
}

export function scoreBand(score: number) {
  if (score >= 8) {
    return "Strong";
  }

  if (score >= 6) {
    return "Moderate";
  }

  if (score >= 4) {
    return "Limited";
  }

  return "Weak";
}

export interface LabelFinding {
  id: string;
  level: "low" | "moderate" | "high";
  title: string;
  detail: string;
}

const peptidePattern =
  /\b(bpc[-\s]?157|tb[-\s]?500|thymosin|cjc[-\s]?1295|ipamorelin|tesamorelin|semaglutide|mots[-\s]?c|epitalon|aod[-\s]?9604)\b/i;

export function analyzeLabel(labelText: string): LabelFinding[] {
  const text = labelText.trim();

  if (!text) {
    return [];
  }

  const findings: LabelFinding[] = [];

  const mentionsProprietaryBlend = /proprietary blend/i.test(text);
  const negatesProprietaryBlend = /\b(no|not|without)\s+(?:a\s+)?proprietary blends?\b/i.test(text);

  if (mentionsProprietaryBlend && !negatesProprietaryBlend) {
    findings.push({
      id: "proprietary-blend",
      level: "moderate",
      title: "Proprietary blend",
      detail: "Dose transparency is limited, so ingredient-level evidence matching is weaker."
    });
  }

  if (peptidePattern.test(text)) {
    findings.push({
      id: "peptide-guardrail",
      level: "high",
      title: "Therapeutic peptide detected",
      detail:
        "Route, sourcing, reconstitution, cycling, and self-administration guidance are out of scope; regulatory and clinician-review checks are required."
    });
  }

  if (/\b(vitamin\s*d|cholecalciferol)\b/i.test(text) && /\b(10000|10,000|20000|20,000)\s*(iu|i\.u\.)\b/i.test(text)) {
    findings.push({
      id: "high-vitamin-d",
      level: "moderate",
      title: "High vitamin D amount",
      detail:
        "High-dose vitamin D should be interpreted against deficiency status, total intake, and safety limits."
    });
  }

  if (/\b(no side effects|reverses aging|detox|cures|repairs dna|extends lifespan)\b/i.test(text)) {
    findings.push({
      id: "hype-language",
      level: "high",
      title: "Hype language",
      detail: "Marketing claims should be matched against human clinical evidence and citations."
    });
  }

  if (/\b(nsf certified for sport|informed sport|usp verified|hasta)\b/i.test(text)) {
    findings.push({
      id: "certification",
      level: "low",
      title: "Quality signal",
      detail: "A recognized certification can improve product-quality confidence when verified."
    });
  }

  return findings;
}
