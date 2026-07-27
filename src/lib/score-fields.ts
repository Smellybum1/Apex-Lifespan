import type { EvidenceLabel, ScoreSet } from "@/lib/types";

export const CLAIM_SCORE_FIELD_DEFINITIONS: Array<{
  key: keyof ScoreSet;
  label: string;
}> = [
  { key: "evidenceDirectness", label: "Directness" },
  { key: "evidenceRigor", label: "Rigor" },
  { key: "effectSize", label: "Effect size" },
  { key: "safety", label: "Safety" },
  { key: "regulatoryRisk", label: "Regulatory risk" },
  { key: "productQuality", label: "Product quality" },
  { key: "hypePenalty", label: "Hype penalty" },
  { key: "measurability", label: "Measurability" }
];

export const EVIDENCE_LABEL_OPTIONS: EvidenceLabel[] = [
  "Core Evidence-Based",
  "Conditional / Biomarker-Gated",
  "Useful for Specific Use Case",
  "Reasonable N-of-1 Experiment",
  "Speculative Watchlist",
  "Safety Concern",
  "Avoid / Not Recommended",
  "Requires Clinician Oversight",
  "Regulatory Concern",
  "Insufficient Evidence"
];
