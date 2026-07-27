export type StudySourceTypeCommandHint =
  | "animal-study"
  | "case-report"
  | "clinical-trial-record"
  | "in-vitro-mechanistic"
  | "meta-analysis"
  | "observational-cohort"
  | "randomized-controlled-trial"
  | "regulatory-safety-warning"
  | "systematic-review";

export function formatStudySourceTypeCommandHints(
  sourceTypes: Array<string | null | undefined>
) {
  const hints = Array.from(
    new Set(
      sourceTypes
        .map((sourceType) => studySourceTypeCommandHintFromText(sourceType))
        .filter((hint): hint is StudySourceTypeCommandHint => Boolean(hint))
    )
  ).sort((left, right) => left.localeCompare(right));

  return hints.length > 0 ? hints.join("; ") : "verify-source-type";
}

export function studySourceTypeCommandHintFromText(
  sourceType: string | null | undefined
): StudySourceTypeCommandHint | undefined {
  const normalized = sourceType?.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (normalized.includes("meta-analysis")) {
    return "meta-analysis";
  }

  if (normalized.includes("systematic")) {
    return "systematic-review";
  }

  if (
    normalized.includes("trial record") ||
    normalized.includes("clinical trial record") ||
    normalized.includes("registry")
  ) {
    return "clinical-trial-record";
  }

  // Randomization has to be stated. A bare "clinical trial" covers
  // non-randomized designs too, so it resolves to the registry-record hint
  // below rather than telling a curator the source is an RCT.
  if (
    normalized.includes("randomized") ||
    normalized.includes("randomised") ||
    normalized.includes("placebo-controlled") ||
    /\brct\b/.test(normalized)
  ) {
    return "randomized-controlled-trial";
  }

  if (normalized.includes("clinical trial")) {
    return "clinical-trial-record";
  }

  if (normalized.includes("observational") || normalized.includes("cohort")) {
    return "observational-cohort";
  }

  if (normalized.includes("case report")) {
    return "case-report";
  }

  if (normalized.includes("animal")) {
    return "animal-study";
  }

  if (normalized.includes("in vitro")) {
    return "in-vitro-mechanistic";
  }

  if (normalized.includes("regulatory")) {
    return "regulatory-safety-warning";
  }

  return undefined;
}
