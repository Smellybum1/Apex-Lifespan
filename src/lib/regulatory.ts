import type { AustraliaRegulatoryKind, AustraliaRegulatoryStatus } from "@/lib/types";

export function australiaRegulatoryKindDescription(kind: AustraliaRegulatoryKind) {
  switch (kind) {
    case "AUST L":
      return "Listed medicine: quality and safety requirements apply, but efficacy is not individually assessed before listing.";
    case "AUST L(A)":
      return "Assessed listed medicine: quality, safety, and efficacy for the health claims are assessed before listing.";
    case "AUST R":
      return "Registered medicine: quality, safety, and efficacy are assessed before registration.";
    case "Not in ARTG":
      return "No ARTG entry is recorded in this project data; legal supply may require another TGA pathway.";
    case "Unapproved":
      return "Unapproved therapeutic good concern; public guidance should stay regulatory and clinician-review focused.";
    case "Exempt":
      return "May be exempt from ARTG entry only under specific TGA rules.";
    case "Excluded":
      return "May be outside ARTG entry because it is excluded from therapeutic goods regulation.";
    case "Unknown":
      return "ARTG status has not been verified in this project data.";
  }
}

export function isTgaEfficacyAssessed(kind: AustraliaRegulatoryKind) {
  return kind === "AUST L(A)" || kind === "AUST R";
}

export function australiaRegulatoryTone(kind: AustraliaRegulatoryKind) {
  if (kind === "AUST L(A)" || kind === "AUST R") {
    return "border-spruce/30 bg-teal-50 text-spruce";
  }

  if (kind === "AUST L") {
    return "border-signal/30 bg-blue-50 text-signal";
  }

  if (kind === "Unapproved" || kind === "Not in ARTG") {
    return "border-danger/30 bg-red-50 text-danger";
  }

  return "border-amberline/30 bg-amber-50 text-amberline";
}

export function getPrimaryAustraliaStatus(
  statuses: AustraliaRegulatoryStatus[],
  interventionId: string
) {
  return statuses.find((status) => status.interventionId === interventionId);
}
