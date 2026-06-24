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

export function confidenceWeightFromAiScore(aiConfidenceScore: number) {
  return clampScorePercent(aiConfidenceScore) / 100;
}

export function confidenceWeightedScore(rawScore: number, aiConfidenceScore: number) {
  return Math.round(rawScore * confidenceWeightFromAiScore(aiConfidenceScore) * 10) / 10;
}

function clampScorePercent(score: number) {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, score));
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
    { label: "Measurability", value: claim.scores.measurability },
    { label: "Low regulatory risk", value: 10 - claim.scores.regulatoryRisk },
    { label: "Low hype risk", value: 10 - claim.scores.hypePenalty }
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
  sourceLabel?: string;
  sourceUrl?: string;
}

export interface ParsedLabelIngredient {
  amount?: string;
  amountConversion?: ParsedLabelAmountConversion;
  amountMg?: number;
  amountMetricUnit?: string;
  amountUnitLabel?: string;
  amountValue?: number;
  blendContext?: "Proprietary blend";
  displayName: string;
  normalizedName: string;
  unit?: string;
}

export interface ParsedLabelAmountConversion {
  basis: string;
  caveat: string;
  sourceLabel: string;
  sourceUrl: string;
}

export interface ParsedLabelProductIdentifier {
  identifier: string;
  kind: "AUST L" | "AUST L(A)" | "AUST R";
  label: string;
}

export interface ParsedLabelDoseCue {
  count?: number;
  dailyUnitCount?: number;
  id: string;
  kind: "daily-directions" | "per-unit-amount" | "serving-size";
  label: string;
  note: string;
  unit?: string;
}

export interface ParsedLabelCertification {
  id: string;
  label: string;
  note: string;
  signal: "Product-quality verification" | "Sport-contamination screening";
}

export type ParsedLabelProductQualitySignal =
  | "Higher quality signal"
  | "Mixed quality signal"
  | "Needs quality review";

export interface ParsedLabelProductQualityAssessment {
  caveats: string[];
  positiveSignals: string[];
  reviewFlags: string[];
  score: number;
  signal: ParsedLabelProductQualitySignal;
}

const peptidePattern =
  /\b(bpc[-\s]?157|tb[-\s]?500|thymosin|cjc[-\s]?1295|ipamorelin|tesamorelin|semaglutide|mots[-\s]?c|epitalon|aod[-\s]?9604)\b/i;
const austNumberPattern = /\bAUST\s+(?:L(?:\(A\))?|R)\s*\d{3,}\b/i;
const austNumberCapturePattern = /\bAUST\s+(L(?:\(A\))?|R)\s*(\d{3,})\b/gi;
const therapeuticClaimPattern =
  /\b(treats?|cures?|heals?|repairs?|prevents?|reverses?|regenerates?|therapeutic|medicine|clinical grade|prescription strength)\b/i;
const missingAustPattern =
  /\b(no\s+AUST|without\s+(?:an?\s+)?AUST|AUST\s+(?:number\s+)?pending|AUST\s+(?:number\s+)?not\s+(?:required|available|shown|listed|verified))\b/i;
const tgaApprovalOverclaimPattern =
  /\b(?:TGA|ARTG)\s+(?:approved|registered|listed|endorsed|certified)\b/i;
const tgaApprovalNegationPattern =
  /\b(?:not|isn(?:'|\u2019)?t|not\s+yet|never|no)\s+(?:TGA|ARTG)\s+(?:approved|registered|listed|endorsed|certified)\b/i;
const researchUsePeptidePattern =
  /\b(research\s+use\s+only|not\s+for\s+human\s+consumption|reconstitute|reconstitution|injectable|injection|vial|lyophili[sz]ed|sterile\s+water|bac\s+water|bacteriostatic)\b/i;
const ingredientAmountPattern =
  /\b(\d+(?:[,.]\d+)?)\s*(mcg|ug|\u00b5g|mg|g|iu|i\.u\.)\b/i;
const doseCueUnitPattern = "(?:capsules?|caps?|tablets?|tabs?|softgels?|soft-gels?|scoops?|servings?)";
const servingSizePattern = new RegExp(
  `\\bserving\\s+size\\s*:?\\s*(\\d+(?:[,.]\\d+)?)\\s*(${doseCueUnitPattern})\\b`,
  "gi"
);
const dailyDirectionsPattern = new RegExp(
  `\\b(?:take|use|consume)\\s+(\\d+(?:[,.]\\d+)?)\\s*(${doseCueUnitPattern})(?:\\s+(once|twice|three\\s+times|\\d+\\s+times))?\\s+(?:daily|per\\s+day|each\\s+day|a\\s+day)\\b`,
  "gi"
);
const perUnitAmountPattern = new RegExp(
  `\\bper\\s+(?:(\\d+(?:[,.]\\d+)?)\\s*)?(${doseCueUnitPattern})\\b`,
  "gi"
);
const ingredientLinePrefixPattern =
  /^\s*(?:active\s+ingredients?|ingredients?|supplement\s+facts?)\s*:?\s*/i;
const proprietaryBlendPrefixPattern = /^\s*proprietary\s+blend\s*:?\s*/i;
const negatedProprietaryBlendPattern =
  /\b(no|not|without)\s+(?:a\s+)?proprietary blends?\b/i;
const nonIngredientLabelLinePattern =
  /\b(?:aust\s+(?:l(?:\(a\))?|r)|artg|tga|nsf\s+certified|informed\s+(?:sport|choice)|usp\s+verified|hasta|serving\s+size|directions?)\b/i;

const tgaAustNumbersUrl =
  "https://www.tga.gov.au/how-we-regulate/labelling-and-packaging/medicines-and-biologicals/aust-numbers-medicine-labels";
const tgaPeptideSafetyUrl =
  "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts/tga-warning-risks-importing-unapproved-peptide-products";
const tgaVitaminB6SafetyUrl =
  "https://www.tga.gov.au/news/safety-updates/medicines-containing-vitamin-b6-pyridoxine-pyridoxal-or-pyridoxamine";
const nihOdsVitaminDUrl =
  "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/";
const nihOdsVitaminAUrl =
  "https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/";
const nihOdsVitaminEUrl =
  "https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/";
const nihOdsVitaminCUrl =
  "https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/";
const nihOdsFolateUrl =
  "https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/";
const nihOdsNiacinUrl =
  "https://ods.od.nih.gov/factsheets/Niacin-HealthProfessional/";
const nihOdsMagnesiumUrl =
  "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/";
const nihOdsZincUrl =
  "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/";
const nihOdsSeleniumUrl =
  "https://ods.od.nih.gov/factsheets/Selenium-HealthProfessional/";
const nihOdsCalciumUrl =
  "https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/";
const nihOdsIronUrl =
  "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/";
const nihOdsIodineUrl =
  "https://ods.od.nih.gov/factsheets/Iodine-HealthProfessional/";
const nihOdsCopperUrl =
  "https://ods.od.nih.gov/factsheets/Copper-HealthProfessional/";
const nihOdsManganeseUrl =
  "https://ods.od.nih.gov/factsheets/Manganese-HealthProfessional/";
const nihOdsMolybdenumUrl =
  "https://ods.od.nih.gov/factsheets/Molybdenum-HealthProfessional/";
const nihOdsPhosphorusUrl =
  "https://ods.od.nih.gov/factsheets/Phosphorus-HealthProfessional/";
const nihOdsCholineUrl =
  "https://ods.od.nih.gov/factsheets/Choline-HealthProfessional/";
const nihOdsDsidUnitConversionsUrl = "https://dsid.od.nih.gov/unit-conversions";
const heuristicSourceLabel = "Heuristic check";
const numericCommaPlaceholder = "__APEX_LABEL_NUMERIC_COMMA__";
const recognizedLabelCertifications = [
  {
    id: "nsf-certified-for-sport",
    label: "NSF Certified for Sport",
    note:
      "Treat as a product-quality and sport-contamination screening cue only after verifying the exact product certificate.",
    pattern: /\bNSF\s+Certified\s+for\s+Sport\b/i,
    signal: "Sport-contamination screening"
  },
  {
    id: "informed-sport",
    label: "Informed Sport",
    note:
      "Treat as a sport-contamination screening cue only after verifying the exact product certificate.",
    pattern: /\bInformed\s+Sport\b/i,
    signal: "Sport-contamination screening"
  },
  {
    id: "informed-choice",
    label: "Informed Choice",
    note:
      "Treat as a product-quality and sport-contamination screening cue only after verifying the exact product certificate.",
    pattern: /\bInformed\s+Choice\b/i,
    signal: "Sport-contamination screening"
  },
  {
    id: "usp-verified",
    label: "USP Verified",
    note:
      "Treat as a product-quality verification cue only after verifying the exact product listing.",
    pattern: /\bUSP\s+Verified\b/i,
    signal: "Product-quality verification"
  },
  {
    id: "hasta",
    label: "HASTA",
    note:
      "Treat as a sport-contamination screening cue only after verifying the exact product certificate.",
    pattern: /\bHASTA(?:\s+Certified)?\b/i,
    signal: "Sport-contamination screening"
  }
] satisfies Array<ParsedLabelCertification & { pattern: RegExp }>;

function isTgaApprovalNegation(text: string) {
  return tgaApprovalNegationPattern.test(text);
}

export function parseLabelIngredients(labelText: string): ParsedLabelIngredient[] {
  const safeText = labelText.replace(/(\d),(\d)/g, `$1${numericCommaPlaceholder}$2`);
  let activeBlendContext: ParsedLabelIngredient["blendContext"];

  return safeText
    .split(/[\n;,]+/)
    .map((line) => line.replaceAll(numericCommaPlaceholder, ","))
    .map((line) => {
      const startsBlend = proprietaryBlendPrefixPattern.test(line);
      const parsed = parseLabelIngredientLine(
        line,
        startsBlend ? "Proprietary blend" : activeBlendContext
      );

      if (startsBlend && !negatedProprietaryBlendPattern.test(line)) {
        activeBlendContext = "Proprietary blend";
      }

      return parsed;
    })
    .filter((ingredient): ingredient is ParsedLabelIngredient => Boolean(ingredient));
}

export function parseLabelProductIdentifiers(labelText: string): ParsedLabelProductIdentifier[] {
  return Array.from(labelText.matchAll(austNumberCapturePattern)).map((match) => {
    const kind = `AUST ${match[1]?.toUpperCase()}` as ParsedLabelProductIdentifier["kind"];
    const identifier = match[2] ?? "";

    return {
      identifier,
      kind,
      label: `${kind} ${identifier}`.trim()
    };
  });
}

export function parseLabelCertifications(labelText: string): ParsedLabelCertification[] {
  return recognizedLabelCertifications
    .filter((certification) => certification.pattern.test(labelText))
    .map(({ pattern, ...certification }) => certification);
}

export function parseLabelDoseCues(labelText: string): ParsedLabelDoseCue[] {
  const cues: ParsedLabelDoseCue[] = [];

  for (const match of labelText.matchAll(servingSizePattern)) {
    const count = parseLabelAmount(match[1] ?? "");
    const unit = normalizeDoseCueUnit(match[2] ?? "");

    cues.push({
      ...(count !== undefined ? { count } : {}),
      id: doseCueId("serving-size", match[0]),
      kind: "serving-size",
      label: normalizeDoseCueLabel(match[0]),
      note:
        "Serving-size text was parsed as a cue only; ingredient amounts still need label-basis review before daily-dose comparison.",
      ...(unit ? { unit } : {})
    });
  }

  for (const match of labelText.matchAll(dailyDirectionsPattern)) {
    const count = parseLabelAmount(match[1] ?? "");
    const unit = normalizeDoseCueUnit(match[2] ?? "");
    const frequency = parseDoseCueFrequency(match[3]);
    const dailyUnitCount =
      count !== undefined && frequency !== undefined
        ? roundDoseCueCount(count * frequency)
        : count;

    cues.push({
      ...(count !== undefined ? { count } : {}),
      ...(dailyUnitCount !== undefined ? { dailyUnitCount } : {}),
      id: doseCueId("daily-directions", match[0]),
      kind: "daily-directions",
      label: normalizeDoseCueLabel(match[0]),
      note:
        "Daily-use directions were parsed as a cue only; verify whether ingredient amounts are per unit, per serving, or per daily dose before safety or efficacy matching.",
      ...(unit ? { unit } : {})
    });
  }

  for (const match of labelText.matchAll(perUnitAmountPattern)) {
    const count = parseLabelAmount(match[1] ?? "") ?? 1;
    const unit = normalizeDoseCueUnit(match[2] ?? "");

    cues.push({
      count,
      id: doseCueId("per-unit-amount", match[0]),
      kind: "per-unit-amount",
      label: normalizeDoseCueLabel(match[0]),
      note:
        "Per-unit amount language was parsed as a cue only; combine with serving directions before daily-dose or upper-limit review.",
      ...(unit ? { unit } : {})
    });
  }

  return uniqueDoseCues(cues);
}

export function assessLabelProductQuality(
  labelText: string
): ParsedLabelProductQualityAssessment {
  const text = labelText.trim();
  const caveats = [
    "This heuristic product-quality score only summarizes parsed label cues; verify exact product certificates, batch testing, manufacturing records, and label source before relying on it.",
    "Product quality, efficacy evidence, and AU/TGA/ARTG status remain separate."
  ];

  if (!text) {
    return {
      caveats,
      positiveSignals: [],
      reviewFlags: ["No label text was provided for product-quality review."],
      score: 0,
      signal: "Needs quality review"
    };
  }

  const parsedIngredients = parseLabelIngredients(text);
  const parsedCertifications = parseLabelCertifications(text);
  const duplicateIngredients = duplicatedParsedIngredientNames(parsedIngredients);
  const missingAmountIngredients = parsedIngredients.filter(
    (ingredient) => !ingredient.amount || !ingredient.unit
  );
  const nonMetricIngredients = parsedIngredients.filter(
    (ingredient) => ingredient.amountValue !== undefined && ingredient.amountMg === undefined
  );
  const hasProprietaryBlend =
    /proprietary blend/i.test(text) && !negatedProprietaryBlendPattern.test(text);

  let score = 5;
  const positiveSignals: string[] = [];
  const reviewFlags: string[] = [];

  if (parsedCertifications.length > 0) {
    score += 2;
    positiveSignals.push(
      `Recognized certification signal captured: ${parsedCertifications
        .map((certification) => certification.label)
        .join(", ")}.`
    );
  }

  if (parsedIngredients.length === 0) {
    score -= 2;
    reviewFlags.push("No ingredient rows were parsed for product-quality review.");
  } else if (missingAmountIngredients.length === 0) {
    score += 1;
    positiveSignals.push("All parsed ingredient rows include captured amounts.");
  } else {
    score -= 1;
    reviewFlags.push(
      `${missingAmountIngredients.length} parsed ingredient row${
        missingAmountIngredients.length === 1 ? "" : "s"
      } lack captured amounts.`
    );
  }

  if (hasProprietaryBlend) {
    score -= 2;
    reviewFlags.push("Proprietary blend language can obscure ingredient-level exposure.");
  }

  if (duplicateIngredients.length > 0) {
    score -= 1;
    reviewFlags.push(
      `Duplicate ingredient rows need total-exposure review: ${duplicateIngredients.join(", ")}.`
    );
  }

  if (nonMetricIngredients.length > 0) {
    score -= 1;
    reviewFlags.push(
      `${nonMetricIngredients.length} parsed amount${
        nonMetricIngredients.length === 1 ? " uses" : "s use"
      } unsupported or unconverted non-metric units.`
    );
  }

  const boundedScore = Math.max(0, Math.min(10, score));

  return {
    caveats,
    positiveSignals:
      positiveSignals.length > 0
        ? positiveSignals
        : ["No positive product-quality cues were parsed from this label."],
    reviewFlags,
    score: boundedScore,
    signal: productQualitySignalFromScore(boundedScore)
  };
}

function parseLabelIngredientLine(
  line: string,
  blendContext?: ParsedLabelIngredient["blendContext"]
): ParsedLabelIngredient | null {
  const cleanedLine = line
    .replace(ingredientLinePrefixPattern, "")
    .replace(proprietaryBlendPrefixPattern, "")
    .trim();

  if (
    !cleanedLine ||
    negatedProprietaryBlendPattern.test(cleanedLine) ||
    (nonIngredientLabelLinePattern.test(cleanedLine) && !ingredientAmountPattern.test(cleanedLine))
  ) {
    return null;
  }

  const amountMatch = ingredientAmountPattern.exec(cleanedLine);
  const displayName = (amountMatch
    ? cleanedLine.slice(0, amountMatch.index)
    : cleanedLine
  )
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!displayName || displayName.length < 3) {
    return null;
  }

  const amount = amountMatch?.[1];
  const unit = amountMatch?.[2];
  const normalizedUnit = unit ? normalizeIngredientUnit(unit) : undefined;
  const amountValue = amount ? parseLabelAmount(amount) : undefined;
  const normalizedName = normalizeIngredientName(displayName);
  const normalizedMetricAmount =
    amountValue !== undefined && normalizedUnit
      ? normalizeAmountToMilligrams(amountValue, normalizedUnit)
      : undefined;
  const ingredientSpecificConversion =
    amountValue !== undefined && normalizedUnit
      ? ingredientSpecificAmountConversion({
          amountValue,
          normalizedName,
          sourceText: cleanedLine,
          unit: normalizedUnit
        })
      : undefined;
  const amountMg = normalizedMetricAmount ?? ingredientSpecificConversion?.amountMg;
  const amountMetricUnit = ingredientSpecificConversion?.amountMetricUnit;
  const amountUnitLabel = ingredientSpecificConversion?.amountUnitLabel;

  return {
    ...(amount ? { amount } : {}),
    ...(ingredientSpecificConversion
      ? { amountConversion: ingredientSpecificConversion.conversion }
      : {}),
    ...(amountMg !== undefined ? { amountMg } : {}),
    ...(amountMetricUnit ? { amountMetricUnit } : {}),
    ...(amountUnitLabel ? { amountUnitLabel } : {}),
    ...(amountValue !== undefined ? { amountValue } : {}),
    ...(blendContext ? { blendContext } : {}),
    displayName,
    normalizedName,
    ...(normalizedUnit ? { unit: normalizedUnit } : {})
  };
}

function normalizeIngredientName(name: string) {
  return name
    .toLowerCase()
    .replace(/\bvitamin\s+d3\b/g, "vitamin d")
    .replace(/\bcholecalciferol\b/g, "vitamin d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIngredientUnit(unit: string) {
  const normalized = unit.toLowerCase().replace(/\./g, "");

  if (normalized === "iu") {
    return "IU";
  }

  if (normalized === "ug" || normalized === "\u00b5g") {
    return "mcg";
  }

  return normalized;
}

function parseLabelAmount(amount: string) {
  if (!amount.trim()) {
    return undefined;
  }

  const parsed = Number(amount.replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDoseCueUnit(unit: string) {
  const normalized = unit.toLowerCase().replace(/-/g, " ");

  if (normalized === "caps") {
    return "capsules";
  }

  if (normalized === "tabs") {
    return "tablets";
  }

  if (normalized === "soft gel" || normalized === "soft gels") {
    return "softgels";
  }

  return normalized.endsWith("s") ? normalized : `${normalized}s`;
}

function normalizeDoseCueLabel(label: string) {
  return label.replace(/\s+/g, " ").trim();
}

function doseCueId(kind: ParsedLabelDoseCue["kind"], label: string) {
  return `${kind}:${normalizeDoseCueLabel(label).toLowerCase()}`;
}

function parseDoseCueFrequency(value?: string) {
  if (!value) {
    return 1;
  }

  const normalized = value.toLowerCase().trim();

  if (normalized === "once") {
    return 1;
  }

  if (normalized === "twice") {
    return 2;
  }

  if (normalized === "three times") {
    return 3;
  }

  const amount = parseLabelAmount(normalized.replace(/\s+times$/, ""));

  return amount ?? 1;
}

function roundDoseCueCount(count: number) {
  return Math.round(count * 100) / 100;
}

function uniqueDoseCues(cues: ParsedLabelDoseCue[]) {
  const cueById = new Map<string, ParsedLabelDoseCue>();

  cues.forEach((cue) => {
    if (!cueById.has(cue.id)) {
      cueById.set(cue.id, cue);
    }
  });

  return Array.from(cueById.values());
}

function normalizeAmountToMilligrams(amount: number, unit: string) {
  if (unit === "g") {
    return roundAmountMg(amount * 1000);
  }

  if (unit === "mg") {
    return roundAmountMg(amount);
  }

  if (unit === "mcg") {
    return roundAmountMg(amount / 1000);
  }

  return undefined;
}

function ingredientSpecificAmountConversion({
  amountValue,
  normalizedName,
  sourceText,
  unit
}: {
  amountValue: number;
  normalizedName: string;
  sourceText: string;
  unit: string;
}):
  | {
      amountMg: number;
      amountMetricUnit?: string;
      amountUnitLabel?: string;
      conversion: ParsedLabelAmountConversion;
    }
  | undefined {
  if (unit === "IU" && normalizedName === "vitamin d") {
    return {
      amountMg: roundAmountMg((amountValue * 0.025) / 1000),
      amountMetricUnit: "mg vitamin D",
      conversion: {
        basis: "Vitamin D IU converted using 1 IU = 0.025 mcg vitamin D.",
        caveat:
          "Use only for vitamin D label normalization; product efficacy and safety still require scoped evidence review.",
        sourceLabel: "NIH ODS/USDA DSID unit conversions",
        sourceUrl: nihOdsDsidUnitConversionsUrl
      }
    };
  }

  if (unit === "mcg" && normalizedName === "vitamin d") {
    return {
      amountMg: roundAmountMg(amountValue / 1000),
      amountMetricUnit: "mg vitamin D",
      conversion: {
        basis: "Vitamin D mcg preserved as vitamin D for normalized metric display.",
        caveat:
          "Use only for vitamin D label normalization; product efficacy and safety still require scoped evidence review.",
        sourceLabel: "NIH ODS Vitamin D fact sheet",
        sourceUrl: nihOdsVitaminDUrl
      }
    };
  }

  if (unit === "mcg" && isFolateDfeLine(normalizedName, sourceText)) {
    return {
      amountMg: roundAmountMg(amountValue / 1000),
      amountMetricUnit: "mg DFE",
      amountUnitLabel: "mcg DFE",
      conversion: {
        basis:
          "Folate DFE preserved as dietary folate equivalents; 1 mcg DFE = 1 mcg food folate or 0.6 mcg folic acid from fortified foods or supplements consumed with food.",
        caveat:
          "Use DFE only as an equivalent-unit label normalization; folic acid, food folate, and 5-MTHF comparisons still need form-specific review.",
        sourceLabel: "NIH ODS Folate fact sheet",
        sourceUrl: nihOdsFolateUrl
      }
    };
  }

  if (unit === "mg" && isNiacinNeLine(normalizedName, sourceText)) {
    return {
      amountMg: roundAmountMg(amountValue),
      amountMetricUnit: "mg NE",
      amountUnitLabel: "mg NE",
      conversion: {
        basis:
          "Niacin NE preserved as niacin equivalents; 1 NE = 1 mg niacin or 60 mg tryptophan.",
        caveat:
          "Use NE only as an equivalent-unit label normalization; product form, tolerability, and claim evidence still need scoped review.",
        sourceLabel: "NIH ODS Niacin fact sheet",
        sourceUrl: nihOdsNiacinUrl
      }
    };
  }

  if (unit === "mcg" && isVitaminARaeLine(normalizedName, sourceText)) {
    return {
      amountMg: roundAmountMg(amountValue / 1000),
      amountMetricUnit: "mg RAE",
      amountUnitLabel: "mcg RAE",
      conversion: {
        basis:
          "Vitamin A RAE preserved as retinol activity equivalents, the current vitamin A equivalent-unit label.",
        caveat:
          "Use RAE only as an equivalent-unit label normalization; source form, tolerability, and claim evidence still need scoped review.",
        sourceLabel: "NIH ODS Vitamin A fact sheet",
        sourceUrl: nihOdsVitaminAUrl
      }
    };
  }

  if (unit === "mg" && isVitaminEAlphaTocopherolLine(normalizedName, sourceText)) {
    return {
      amountMg: roundAmountMg(amountValue),
      amountMetricUnit: "mg alpha-tocopherol",
      amountUnitLabel: "mg alpha-tocopherol",
      conversion: {
        basis:
          "Vitamin E alpha-tocopherol preserved as the NIH ODS vitamin E amount basis.",
        caveat:
          "Use alpha-tocopherol only as a label-normalization qualifier; natural, synthetic, esterified, mixed tocopherol, and tocotrienol forms still need form-specific review.",
        sourceLabel: "NIH ODS Vitamin E fact sheet",
        sourceUrl: nihOdsVitaminEUrl
      }
    };
  }

  const vitaminAIuConversion = vitaminAIuToRaeConversion(normalizedName, sourceText);

  if (unit === "IU" && vitaminAIuConversion) {
    return {
      amountMg: roundAmountMg((amountValue * vitaminAIuConversion.factor) / 1000),
      amountMetricUnit: "mg RAE",
      conversion: {
        basis: vitaminAIuConversion.basis,
        caveat: vitaminAIuConversion.caveat,
        sourceLabel: "NIH ODS Vitamin A fact sheet",
        sourceUrl: nihOdsVitaminAUrl
      }
    };
  }

  const vitaminEConversion = vitaminEAlphaTocopherolConversion(sourceText);

  if (unit === "IU" && normalizedName === "vitamin e" && vitaminEConversion) {
    return {
      amountMg: roundAmountMg(amountValue * vitaminEConversion.factor),
      amountMetricUnit: "mg alpha-tocopherol",
      conversion: {
        basis: vitaminEConversion.basis,
        caveat:
          "Use only when the label source distinguishes natural/d-alpha or synthetic/dl-alpha/all-rac alpha-tocopherol; mixed tocopherols and tocotrienols need form-specific review.",
        sourceLabel: "NIH ODS Vitamin E fact sheet",
        sourceUrl: nihOdsVitaminEUrl
      }
    };
  }

  return undefined;
}

function isFolateDfeLine(normalizedName: string, sourceText: string) {
  const normalizedSource = sourceText.toLowerCase();
  const isFolateIngredient =
    normalizedName === "folate" ||
    normalizedName === "folic acid" ||
    normalizedName === "vitamin b9";

  return (
    isFolateIngredient &&
    /\b(?:dfe|dietary\s+folate\s+equivalents?)\b/i.test(normalizedSource)
  );
}

function isNiacinNeLine(normalizedName: string, sourceText: string) {
  const normalizedSource = sourceText.toLowerCase();

  return (
    isNiacinIngredientName(normalizedName) &&
    /\b(?:ne|niacin\s+equivalents?)\b/i.test(normalizedSource)
  );
}

function isNiacinIngredientName(normalizedName: string) {
  return (
    normalizedName === "niacin" ||
    normalizedName === "vitamin b3" ||
    normalizedName === "nicotinic acid" ||
    normalizedName === "niacinamide" ||
    normalizedName === "nicotinamide" ||
    normalizedName === "inositol hexanicotinate" ||
    /\bniacin\b/.test(normalizedName)
  );
}

function isVitaminEAlphaTocopherolLine(normalizedName: string, sourceText: string) {
  const normalizedSource = sourceText.toLowerCase();

  return (
    normalizedName === "vitamin e" &&
    /\balpha[-\s]?tocopher(?:ol|yl)\b/i.test(normalizedSource)
  );
}

function isVitaminARaeLine(normalizedName: string, sourceText: string) {
  const normalizedSource = sourceText.toLowerCase();
  const isVitaminAIngredient =
    normalizedName === "vitamin a" ||
    normalizedName === "retinol" ||
    normalizedName === "retinyl acetate" ||
    normalizedName === "retinyl palmitate" ||
    normalizedName === "beta carotene" ||
    normalizedName === "alpha carotene" ||
    normalizedName === "beta cryptoxanthin";

  return (
    isVitaminAIngredient &&
    /\b(?:rae|retinol\s+activity\s+equivalents?)\b/i.test(normalizedSource)
  );
}

function vitaminAIuToRaeConversion(normalizedName: string, sourceText: string) {
  const normalizedSource = sourceText.toLowerCase();
  const isVitaminAIngredient =
    normalizedName === "vitamin a" ||
    normalizedName === "retinol" ||
    normalizedName === "retinyl acetate" ||
    normalizedName === "retinyl palmitate" ||
    normalizedName === "beta carotene" ||
    normalizedName === "alpha carotene" ||
    normalizedName === "beta cryptoxanthin";

  if (!isVitaminAIngredient) {
    return null;
  }

  const hasRetinolSource =
    /\bretinol\b/.test(normalizedSource) ||
    /\bretinyl\s+(?:acetate|palmitate)\b/.test(normalizedSource) ||
    /\bpreformed\s+vitamin\s+a\b/.test(normalizedSource);
  const hasBetaCaroteneSource =
    normalizedName === "beta carotene" ||
    /\bbeta[-\s]?carotene\b/.test(normalizedSource);
  const hasAlphaCaroteneSource =
    normalizedName === "alpha carotene" ||
    /\balpha[-\s]?carotene\b/.test(normalizedSource);
  const hasBetaCryptoxanthinSource =
    normalizedName === "beta cryptoxanthin" ||
    /\bbeta[-\s]?cryptoxanthin\b/.test(normalizedSource);
  const hasFoodSourceCue =
    /\b(?:dietary|food[-\s]?(?:based|source)|from\s+foods?)\b/.test(normalizedSource);

  if (hasFoodSourceCue && hasBetaCaroteneSource) {
    return {
      basis:
        "Vitamin A IU converted using 1 IU dietary beta-carotene = 0.05 mcg RAE.",
      caveat:
        "Use only when the label source is dietary or food-source beta-carotene; supplement-source beta-carotene uses a different IU-to-RAE factor.",
      factor: 0.05
    };
  }

  if (hasFoodSourceCue && (hasAlphaCaroteneSource || hasBetaCryptoxanthinSource)) {
    return {
      basis:
        "Vitamin A IU converted using 1 IU dietary alpha-carotene or beta-cryptoxanthin = 0.025 mcg RAE.",
      caveat:
        "Use only when the label source is dietary or food-source alpha-carotene or beta-cryptoxanthin; other carotenoid sources still need source-form review.",
      factor: 0.025
    };
  }

  if (hasRetinolSource) {
    return {
      basis: "Vitamin A IU converted using 1 IU retinol = 0.3 mcg RAE.",
      caveat:
        "Use only when the label source is retinol, retinyl acetate, retinyl palmitate, or preformed vitamin A; generic vitamin A IU still needs source-form review.",
      factor: 0.3
    };
  }

  if (
    /\bsupplemental\s+beta[-\s]?carotene\b/.test(normalizedSource) ||
    normalizedName === "beta carotene" ||
    /\bvitamin\s+a\b.*\bbeta[-\s]?carotene\b/.test(normalizedSource) ||
    /\bbeta[-\s]?carotene\b.*\bvitamin\s+a\b/.test(normalizedSource)
  ) {
    return {
      basis:
        "Vitamin A IU converted using 1 IU supplemental beta-carotene = 0.3 mcg RAE.",
      caveat:
        "Use only when the label source is supplement-source beta-carotene; dietary or food-source beta-carotene uses a different IU-to-RAE factor.",
      factor: 0.3
    };
  }

  return null;
}

function vitaminEAlphaTocopherolConversion(sourceText: string) {
  const normalizedSource = sourceText.toLowerCase();

  if (
    /\bdl[-\s]?alpha[-\s]?tocopher(?:ol|yl)\b/.test(normalizedSource) ||
    /\ball[-\s]?rac[-\s]?alpha[-\s]?tocopher(?:ol|yl)\b/.test(normalizedSource) ||
    /\bsynthetic\s+vitamin\s+e\b/.test(normalizedSource)
  ) {
    return {
      basis:
        "Vitamin E IU converted using 1 IU synthetic vitamin E = 0.45 mg alpha-tocopherol.",
      factor: 0.45
    };
  }

  if (
    /\bd[-\s]?alpha[-\s]?tocopher(?:ol|yl)\b/.test(normalizedSource) ||
    /\brrr[-\s]?alpha[-\s]?tocopher(?:ol|yl)\b/.test(normalizedSource) ||
    /\bnatural(?:\s+source)?\s+vitamin\s+e\b/.test(normalizedSource)
  ) {
    return {
      basis:
        "Vitamin E IU converted using 1 IU natural vitamin E = 0.67 mg alpha-tocopherol.",
      factor: 0.67
    };
  }

  return null;
}

function roundAmountMg(amount: number) {
  return Math.round(amount * 1000) / 1000;
}

function productQualitySignalFromScore(score: number): ParsedLabelProductQualitySignal {
  if (score >= 7) {
    return "Higher quality signal";
  }

  if (score <= 4) {
    return "Needs quality review";
  }

  return "Mixed quality signal";
}

export function analyzeLabel(labelText: string): LabelFinding[] {
  const text = labelText.trim();

  if (!text) {
    return [];
  }

  const findings: LabelFinding[] = [];
  const parsedIngredients = parseLabelIngredients(text);
  const parsedCertifications = parseLabelCertifications(text);
  const parsedDoseCues = parseLabelDoseCues(text);
  const duplicateIngredients = duplicatedParsedIngredientNames(parsedIngredients);

  const mentionsProprietaryBlend = /proprietary blend/i.test(text);
  const negatesProprietaryBlend =
    /\b(no|not|without)\s+(?:a\s+)?proprietary blends?\b/i.test(text);

  if (mentionsProprietaryBlend && !negatesProprietaryBlend) {
    findings.push({
      id: "proprietary-blend",
      level: "moderate",
      title: "Proprietary blend",
      detail: "Dose transparency is limited, so ingredient-level evidence matching is weaker.",
      sourceLabel: heuristicSourceLabel
    });
  }

  if (duplicateIngredients.length > 0) {
    findings.push({
      id: "duplicate-ingredient",
      level: "moderate",
      title: "Duplicate ingredient listing",
      detail: `Repeated ingredient entries (${duplicateIngredients.join(", ")}) can obscure total exposure. Normalize the label and review total captured amounts before mapping the product to claim evidence.`,
      sourceLabel: heuristicSourceLabel
    });
  }

  if (
    parsedIngredients.some(
      (ingredient) => ingredient.amountValue !== undefined && ingredient.amountMg === undefined
    )
  ) {
    findings.push({
      id: "non-metric-unit",
      level: "low",
      title: "Non-metric amount captured",
      detail:
        "At least one ingredient amount uses a unit such as IU that is not directly comparable with mg/g without ingredient-specific conversion. Keep product amount matching separate from efficacy evidence.",
      sourceLabel: heuristicSourceLabel
    });
  }

  if (parsedIngredients.length > 0 && parsedDoseCues.some(doseCueNeedsDailyReview)) {
    findings.push({
      id: "serving-dose-review",
      level: "low",
      title: "Serving-to-daily dose review",
      detail:
        "Serving-size, per-unit, or daily-use text suggests ingredient amounts may need serving-basis or daily-dose review before comparing against upper limits or scoped claim doses.",
      sourceLabel: heuristicSourceLabel
    });
  }

  if (peptidePattern.test(text)) {
    findings.push({
      id: "peptide-guardrail",
      level: "high",
      title: "Therapeutic peptide detected",
      detail:
        "AU/TGA caution: peptide products promoted online may be unapproved therapeutic goods. Route, sourcing, reconstitution, cycling, and self-administration guidance are out of scope; regulatory and clinician-review checks are required.",
      sourceLabel: "TGA peptide warning",
      sourceUrl: tgaPeptideSafetyUrl
    });
  }

  if (peptidePattern.test(text) && researchUsePeptidePattern.test(text)) {
    findings.push({
      id: "research-use-or-injectable-peptide",
      level: "high",
      title: "Research-use or injectable peptide language",
      detail:
        "Labels mentioning research use, vials, injections, or reconstitution near peptides are major AU/TGA red flags. Treat as a regulatory/safety review item, not consumer self-use guidance.",
      sourceLabel: "TGA peptide warning",
      sourceUrl: tgaPeptideSafetyUrl
    });
  }

  if (tgaApprovalOverclaimPattern.test(text) && !isTgaApprovalNegation(text)) {
    findings.push({
      id: "tga-approval-overclaim",
      level: "high",
      title: "Possible TGA approval overclaim",
      detail:
        "Australian status is product-specific. Do not treat broad phrases like TGA approved as proof of efficacy or supply status without checking the exact AUST number and ARTG record.",
      sourceLabel: "TGA AUST numbers",
      sourceUrl: tgaAustNumbersUrl
    });
  }

  if (missingAustPattern.test(text)) {
    findings.push({
      id: "aust-number-unresolved",
      level: "moderate",
      title: "AUST number unresolved",
      detail:
        "A missing, pending, or unverified AUST number means Australian supply status is unresolved. Verify the product-level ARTG/AUST record before treating label claims as Australia-ready.",
      sourceLabel: "TGA AUST numbers",
      sourceUrl: tgaAustNumbersUrl
    });
  } else if (therapeuticClaimPattern.test(text) && !austNumberPattern.test(text)) {
    findings.push({
      id: "aust-number-not-visible",
      level: "moderate",
      title: "No AUST number visible",
      detail:
        "Therapeutic-style claims should be checked against product-level ARTG/AUST status. An intervention evidence score or quality certification is not Australian market authorisation.",
      sourceLabel: "TGA AUST numbers",
      sourceUrl: tgaAustNumbersUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isVitaminDIngredient, 0.1)) {
    findings.push({
      id: "high-vitamin-d",
      level: "moderate",
      title: "High vitamin D amount",
      detail:
        "Vitamin D amount is at or above the 100 mcg (4,000 IU) adult upper-limit threshold and needs review against total intake, age context, deficiency status, and safety limits.",
      sourceLabel: "NIH ODS vitamin D",
      sourceUrl: nihOdsVitaminDUrl
    });
  }

  if (hasHighVitaminATotal(parsedIngredients, text)) {
    findings.push({
      id: "high-vitamin-a",
      level: "moderate",
      title: "Vitamin A upper-limit review",
      detail:
        "Vitamin A amount is at or above the 3,000 mcg RAE adult upper-limit threshold for preformed vitamin A. Review the retinol/retinyl versus provitamin A split before treating the label as a safety match.",
      sourceLabel: "NIH ODS vitamin A",
      sourceUrl: nihOdsVitaminAUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isVitaminEIngredient, 1000)) {
    findings.push({
      id: "high-vitamin-e",
      level: "moderate",
      title: "Vitamin E upper-limit review",
      detail:
        "Vitamin E amount is at or above the 1,000 mg adult upper-limit threshold for supplemental alpha-tocopherol. Review the natural/synthetic, esterified, mixed tocopherol, and tocotrienol form before treating the label as a safety match.",
      sourceLabel: "NIH ODS vitamin E",
      sourceUrl: nihOdsVitaminEUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isVitaminCIngredient, 2000)) {
    findings.push({
      id: "high-vitamin-c",
      level: "moderate",
      title: "Vitamin C upper-limit review",
      detail:
        "Vitamin C amount is at or above the 2,000 mg adult upper-limit threshold. Review total supplemental exposure, gastrointestinal tolerability, kidney-stone or renal context, iron-overload context, and vitamin C form before treating the label as a safety match.",
      sourceLabel: "NIH ODS vitamin C",
      sourceUrl: nihOdsVitaminCUrl
    });
  }

  if (hasHighFolicAcidTotal(parsedIngredients, text)) {
    findings.push({
      id: "high-folic-acid",
      level: "moderate",
      title: "Folic acid upper-limit review",
      detail:
        "Folic acid amount is at or above the 1,000 mcg adult upper-limit threshold for synthetic folate from supplements or fortified foods. Review total folic-acid exposure, vitamin B12 context, age/pregnancy context, medical-supervision context, and folate form before treating the label as a safety match.",
      sourceLabel: "NIH ODS folate",
      sourceUrl: nihOdsFolateUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isNiacinIngredient, 35)) {
    findings.push({
      id: "high-niacin",
      level: "moderate",
      title: "Niacin upper-limit review",
      detail:
        "Niacin amount is at or above the 35 mg adult upper-limit threshold for supplemental niacin. Review nicotinic-acid versus niacinamide/nicotinamide form, extended-release or flush-free wording, medical-supervision context, and total intake before treating the label as a safety match.",
      sourceLabel: "NIH ODS niacin",
      sourceUrl: nihOdsNiacinUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isMagnesiumIngredient, 350)) {
    findings.push({
      id: "high-magnesium",
      level: "moderate",
      title: "Magnesium upper-limit review",
      detail:
        "Magnesium amount is at or above the 350 mg adult upper-limit threshold for supplemental magnesium from dietary supplements or medications. Review total supplemental exposure, laxative/antacid context, kidney-risk context, and magnesium form before treating the label as a safety match.",
      sourceLabel: "NIH ODS magnesium",
      sourceUrl: nihOdsMagnesiumUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isZincIngredient, 40)) {
    findings.push({
      id: "high-zinc",
      level: "moderate",
      title: "Zinc upper-limit review",
      detail:
        "Zinc amount is at or above the 40 mg adult upper-limit threshold. Review total zinc exposure, denture-cream or lozenge context, copper-status context, duration, and zinc form before treating the label as a safety match.",
      sourceLabel: "NIH ODS zinc",
      sourceUrl: nihOdsZincUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isSeleniumIngredient, 0.4)) {
    findings.push({
      id: "high-selenium",
      level: "moderate",
      title: "Selenium upper-limit review",
      detail:
        "Selenium amount is at or above the 400 mcg adult upper-limit threshold. Review total intake, chronic-exposure context, selenium form, and toxicity-signal context before treating the label as a safety match.",
      sourceLabel: "NIH ODS selenium",
      sourceUrl: nihOdsSeleniumUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isCalciumIngredient, 2000)) {
    findings.push({
      id: "high-calcium",
      level: "moderate",
      title: "Calcium upper-limit review",
      detail:
        "Calcium amount is at or above the 2,000 mg lower adult upper-limit threshold. Review total dietary plus supplemental calcium, age context, kidney-stone context, vitamin D co-exposure, and elemental-versus-compound amount before treating the label as a safety match.",
      sourceLabel: "NIH ODS calcium",
      sourceUrl: nihOdsCalciumUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isIronIngredient, 45)) {
    findings.push({
      id: "high-iron",
      level: "moderate",
      title: "Iron upper-limit review",
      detail:
        "Iron amount is at or above the 45 mg adult upper-limit threshold. Review elemental iron versus salt/compound amount, deficiency-treatment or medical-supervision context, iron-overload risk, medication interactions, and total intake before treating the label as a safety match.",
      sourceLabel: "NIH ODS iron",
      sourceUrl: nihOdsIronUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isCopperIngredient, 10)) {
    findings.push({
      id: "high-copper",
      level: "moderate",
      title: "Copper upper-limit review",
      detail:
        "Copper amount is at or above the 10 mg adult upper-limit threshold. Review total copper exposure, copper form, liver-risk context, zinc co-exposure, and medical-supervision context before treating the label as a safety match.",
      sourceLabel: "NIH ODS copper",
      sourceUrl: nihOdsCopperUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isManganeseIngredient, 11)) {
    findings.push({
      id: "high-manganese",
      level: "moderate",
      title: "Manganese upper-limit review",
      detail:
        "Manganese amount is at or above the 11 mg adult upper-limit threshold. Review total manganese exposure, liver-risk context, iron-status context, source form, and medical-supervision context before treating the label as a safety match.",
      sourceLabel: "NIH ODS manganese",
      sourceUrl: nihOdsManganeseUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isMolybdenumIngredient, 2)) {
    findings.push({
      id: "high-molybdenum",
      level: "moderate",
      title: "Molybdenum upper-limit review",
      detail:
        "Molybdenum amount is at or above the 2,000 mcg adult upper-limit threshold. Review total molybdenum exposure, supplement form such as molybdate, gout-like or uric-acid context, copper-status context, and medical-supervision context before treating the label as a safety match.",
      sourceLabel: "NIH ODS molybdenum",
      sourceUrl: nihOdsMolybdenumUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isPhosphorusIngredient, 3000)) {
    findings.push({
      id: "high-phosphorus",
      level: "moderate",
      title: "Phosphorus upper-limit review",
      detail:
        "Phosphorus or phosphate-source amount is at or above the 3,000 mg lower adult upper-limit threshold. Review total dietary plus supplemental phosphorus, phosphate salt or additive context, kidney-risk context, calcium balance, and medical-supervision context before treating the label as a safety match.",
      sourceLabel: "NIH ODS phosphorus",
      sourceUrl: nihOdsPhosphorusUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isCholineIngredient, 3500)) {
    findings.push({
      id: "high-choline",
      level: "moderate",
      title: "Choline upper-limit review",
      detail:
        "Choline or choline-source amount is at or above the 3,500 mg adult upper-limit threshold. Review total dietary plus supplemental choline, choline-equivalent versus compound amount, source form such as choline bitartrate, phosphatidylcholine, or lecithin, hypotension or liver-risk context, fishy-body-odor/TMAO context, and medical-supervision context before treating the label as a safety match.",
      sourceLabel: "NIH ODS choline",
      sourceUrl: nihOdsCholineUrl
    });
  }

  if (hasTotalAmountAbove(parsedIngredients, isVitaminB6Ingredient, 10)) {
    findings.push({
      id: "vitamin-b6-tga-warning-review",
      level: "moderate",
      title: "Vitamin B6 AU/TGA warning review",
      detail:
        "Vitamin B6 amount is above the 10 mg TGA daily-dose label-warning threshold. Review pyridoxine/pyridoxal/pyridoxamine forms, total multi-product exposure, serving-to-daily-dose directions, neuropathy warning language, and product-level ARTG/AUST context before treating the label as Australia-ready.",
      sourceLabel: "TGA vitamin B6 safety update",
      sourceUrl: tgaVitaminB6SafetyUrl
    });
  }

  if (hasTotalAmountAtOrAbove(parsedIngredients, isIodineIngredient, 1.1)) {
    findings.push({
      id: "high-iodine",
      level: "moderate",
      title: "Iodine upper-limit review",
      detail:
        "Parsed iodine or iodide-source amount is at or above the 1,100 mcg adult iodine upper-limit threshold. Verify elemental iodine when the label lists a salt, kelp, or seaweed source, then review total iodine exposure, thyroid context, pregnancy/lactation context, source variability, and medical-supervision context before treating the label as a safety match.",
      sourceLabel: "NIH ODS iodine",
      sourceUrl: nihOdsIodineUrl
    });
  }

  if (/\b(no side effects|reverses aging|detox|cures|repairs dna|extends lifespan)\b/i.test(text)) {
    findings.push({
      id: "hype-language",
      level: "high",
      title: "Hype language",
      detail: "Marketing claims should be matched against human clinical evidence and citations.",
      sourceLabel: heuristicSourceLabel
    });
  }

  if (parsedCertifications.length > 0) {
    findings.push({
      id: "certification",
      level: "low",
      title: "Quality signal",
      detail: `Recognized label certification signal captured (${parsedCertifications
        .map((certification) => certification.label)
        .join(", ")}). Verify the exact product certificate or listing before treating it as product-quality evidence; certification does not establish efficacy or AU/TGA authorization.`,
      sourceLabel: heuristicSourceLabel
    });
  }

  return findings;
}

function isVitaminDIngredient(ingredient: ParsedLabelIngredient) {
  return ingredient.normalizedName === "vitamin d";
}

function hasHighVitaminATotal(
  ingredients: ParsedLabelIngredient[],
  labelText: string
) {
  const normalizedSource = labelText.toLowerCase();
  const hasPreformedCue =
    /\bretinol\b/.test(normalizedSource) ||
    /\bretinyl\s+(?:acetate|palmitate)\b/.test(normalizedSource) ||
    /\bpreformed\s+vitamin\s+a\b/.test(normalizedSource);
  const hasRaeCue = /\b(?:rae|retinol\s+activity\s+equivalents?)\b/i.test(normalizedSource);
  const hasOnlyProvitaminCue =
    /\b(?:beta[-\s]?carotene|alpha[-\s]?carotene|beta[-\s]?cryptoxanthin)\b/.test(
      normalizedSource
    ) && !hasPreformedCue;

  if (!hasPreformedCue && (!hasRaeCue || hasOnlyProvitaminCue)) {
    return false;
  }

  return hasTotalAmountAtOrAbove(ingredients, isVitaminAPreformedOrRaeIngredient, 3);
}

function isVitaminAPreformedOrRaeIngredient(ingredient: ParsedLabelIngredient) {
  return (
    ingredient.normalizedName === "vitamin a" ||
    ingredient.normalizedName === "retinol" ||
    ingredient.normalizedName === "retinyl acetate" ||
    ingredient.normalizedName === "retinyl palmitate"
  );
}

function isVitaminEIngredient(ingredient: ParsedLabelIngredient) {
  return ingredient.normalizedName === "vitamin e";
}

function isVitaminCIngredient(ingredient: ParsedLabelIngredient) {
  return /\b(?:vitamin\s+c|ascorbic\s+acid|ascorbate)\b/.test(
    ingredient.normalizedName
  );
}

function hasHighFolicAcidTotal(
  ingredients: ParsedLabelIngredient[],
  labelText: string
) {
  const normalizedSource = labelText.toLowerCase();
  const hasFolicAcidCue = /\bfolic\s+acid\b/.test(normalizedSource);
  const hasMethylfolateOnlyCue =
    /\b(?:5[-\s]?mthf|methylfolate|l[-\s]?methylfolate|levomefolate)\b/.test(
      normalizedSource
    ) && !hasFolicAcidCue;
  if (!hasFolicAcidCue || hasMethylfolateOnlyCue) {
    return false;
  }

  return (
    hasTotalAmountAtOrAbove(ingredients, isDirectFolicAcidIngredient, 1) ||
    hasTotalAmountAtOrAbove(ingredients, isFolateDfeIngredient, 1.667)
  );
}

function isDirectFolicAcidIngredient(ingredient: ParsedLabelIngredient) {
  return ingredient.normalizedName === "folic acid";
}

function isFolateDfeIngredient(ingredient: ParsedLabelIngredient) {
  return (
    (ingredient.normalizedName === "folate" || ingredient.normalizedName === "vitamin b9") &&
    ingredient.amountMetricUnit === "mg DFE"
  );
}

function isNiacinIngredient(ingredient: ParsedLabelIngredient) {
  return isNiacinIngredientName(ingredient.normalizedName);
}

function isMagnesiumIngredient(ingredient: ParsedLabelIngredient) {
  return /\bmagnesium\b/.test(ingredient.normalizedName);
}

function isZincIngredient(ingredient: ParsedLabelIngredient) {
  return /\bzinc\b/.test(ingredient.normalizedName);
}

function isSeleniumIngredient(ingredient: ParsedLabelIngredient) {
  return /\b(?:selenium|selenomethionine|selenite|selenate)\b/.test(
    ingredient.normalizedName
  );
}

function isCalciumIngredient(ingredient: ParsedLabelIngredient) {
  return /\bcalcium\b/.test(ingredient.normalizedName);
}

function isIronIngredient(ingredient: ParsedLabelIngredient) {
  return /\b(?:iron|ferrous|ferric|carbonyl\s+iron|heme\s+iron)\b/.test(
    ingredient.normalizedName
  );
}

function isCopperIngredient(ingredient: ParsedLabelIngredient) {
  return /\b(?:copper|cupric|cuprous)\b/.test(ingredient.normalizedName);
}

function isManganeseIngredient(ingredient: ParsedLabelIngredient) {
  return /\b(?:manganese|manganous)\b/.test(ingredient.normalizedName);
}

function isMolybdenumIngredient(ingredient: ParsedLabelIngredient) {
  return /\b(?:molybdenum|molybdate)\b/.test(ingredient.normalizedName);
}

function isPhosphorusIngredient(ingredient: ParsedLabelIngredient) {
  return /\b(?:phosphorus|phosphate|phosphoric\s+acid|phosphatidyl\w*)\b/.test(
    ingredient.normalizedName
  );
}

function isCholineIngredient(ingredient: ParsedLabelIngredient) {
  return /\b(?:choline|phosphatidylcholine|phosphocholine|glycerophosphocholine|lecithin)\b/.test(
    ingredient.normalizedName
  );
}

function isVitaminB6Ingredient(ingredient: ParsedLabelIngredient) {
  return /\b(?:vitamin\s+b6|pyridoxine|pyridoxal|pyridoxamine)\b/.test(
    ingredient.normalizedName
  );
}

function isIodineIngredient(ingredient: ParsedLabelIngredient) {
  return /\b(?:iodine|iodide)\b/.test(ingredient.normalizedName);
}

function doseCueNeedsDailyReview(cue: ParsedLabelDoseCue) {
  if (cue.kind === "per-unit-amount") {
    return true;
  }

  return (cue.dailyUnitCount ?? cue.count ?? 0) > 1;
}

function hasTotalAmountAtOrAbove(
  ingredients: ParsedLabelIngredient[],
  isMatchingIngredient: (ingredient: ParsedLabelIngredient) => boolean,
  thresholdMg: number
) {
  const totalAmountMg = ingredients
    .filter(isMatchingIngredient)
    .reduce((total, ingredient) => total + (ingredient.amountMg ?? 0), 0);

  return totalAmountMg >= thresholdMg;
}

function hasTotalAmountAbove(
  ingredients: ParsedLabelIngredient[],
  isMatchingIngredient: (ingredient: ParsedLabelIngredient) => boolean,
  thresholdMg: number
) {
  const totalAmountMg = ingredients
    .filter(isMatchingIngredient)
    .reduce((total, ingredient) => total + (ingredient.amountMg ?? 0), 0);

  return totalAmountMg > thresholdMg;
}

function duplicatedParsedIngredientNames(ingredients: ParsedLabelIngredient[]) {
  const counts = new Map<string, { count: number; displayName: string }>();

  ingredients.forEach((ingredient) => {
    const current = counts.get(ingredient.normalizedName);

    counts.set(ingredient.normalizedName, {
      count: (current?.count ?? 0) + 1,
      displayName: current?.displayName ?? ingredient.displayName
    });
  });

  return Array.from(counts.values())
    .filter((item) => item.count > 1)
    .map((item) => item.displayName);
}
