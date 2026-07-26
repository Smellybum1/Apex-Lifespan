import type { Claim } from "@/lib/types";

const ADVERSE_DIRECTION_PATTERN =
  /\b(adverse(?:ly)?|impair(?:s|ed|ing|ment|ments)?|disrupt(?:s|ed|ing|ion|ions|ive)?|worsen(?:s|ed|ing)?|harm(?:s|ed|ing|ful)?)\b/;

export function claimEvidenceDirectionLabel(
  claim: Pick<Claim, "summary" | "uncertainty">
) {
  return isAdverseDirectionClaim(claim) ? "Caution/adverse signal" : null;
}

export function isAdverseDirectionClaim(claim: Pick<Claim, "summary" | "uncertainty">) {
  const text = `${claim.summary ?? ""} ${claim.uncertainty ?? ""}`.toLowerCase();

  return (
    ADVERSE_DIRECTION_PATTERN.test(text) ||
    text.includes("not frame this as a sleep benefit")
  );
}
