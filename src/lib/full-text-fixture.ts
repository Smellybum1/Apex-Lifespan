export type FullTextFixtureTargetConfidence =
  | "Strong"
  | "Inferred"
  | "Weak"
  | "Missing";

export interface FullTextFixtureDerivedExtractionTarget {
  confidence: FullTextFixtureTargetConfidence;
  field: string;
  note: string;
  quoteLocator: string;
  value: string;
}

export interface FullTextLocalFixture {
  capturedAt: string;
  derivedExtractionTargets: FullTextFixtureDerivedExtractionTarget[];
  reviewerNote: string;
  sourceId: string;
  sourceUrl: string;
  textExcerpt: string;
  title: string;
}

export interface FullTextFixtureReviewReportTarget {
  confidence: FullTextFixtureTargetConfidence;
  field: string;
  hasValue: boolean;
  note: string;
  quoteLocator: string;
  valueCharacters: number;
  valuePreview: string;
}

export interface FullTextFixtureReviewReport {
  blockers: string[];
  derivedOnly: true;
  generatedAt: string;
  localOnly: true;
  nextAction: string;
  noAutoApproval: true;
  noCandidateDecision: true;
  noConnectorApproval: true;
  noExtractionWrite: true;
  noLiveFetch: true;
  noNetworkFetch: true;
  noPublicRawTextExport: true;
  noPromotion: true;
  rawTextStored: false;
  readOnly: true;
  source: {
    capturedAt: string;
    sourceId: string;
    sourceUrl: string;
    textExcerptCharacters: number;
    title: string;
  };
  summary: {
    blockers: number;
    missingTargets: number;
    readyForDerivedReview: boolean;
    targets: number;
    warnings: number;
  };
  targets: FullTextFixtureReviewReportTarget[];
  warnings: string[];
}

export interface FullTextFixtureExtractionDraftOptions {
  candidateKey?: string;
  fixture: FullTextLocalFixture;
  generatedAt?: Date;
  studySourceType?: string;
}

export interface FullTextFixtureExtractionDraftField {
  confidence?: FullTextFixtureTargetConfidence;
  field: string;
  hasValue: boolean;
  note: string;
  quoteLocator?: string;
  required: boolean;
  sourceField?: string;
  status: "ready" | "missing";
  value?: string;
  valueCharacters: number;
  valuePreview?: string;
  writeFlag?: string;
}

export interface FullTextFixtureExtractionDraft {
  blockers: string[];
  commandTemplate: string;
  derivedOnly: true;
  generatedAt: string;
  localOnly: true;
  nextAction: string;
  noAutoApproval: true;
  noCandidateDecision: true;
  noConnectorApproval: true;
  noDbValidation: true;
  noExtractionWrite: true;
  noLiveFetch: true;
  noNetworkFetch: true;
  noPromotion: true;
  noPublicRawTextExport: true;
  optionalFields: FullTextFixtureExtractionDraftField[];
  rawTextStored: false;
  readOnly: true;
  requiredFields: FullTextFixtureExtractionDraftField[];
  reviewOnlyFields: FullTextFixtureExtractionDraftField[];
  source: FullTextFixtureReviewReport["source"];
  summary: {
    commandDraftReady: boolean;
    missingRequiredFields: number;
    optionalFields: number;
    requiredFields: number;
    reviewOnlyFields: number;
    warnings: number;
  };
  warnings: string[];
}

export interface FullTextFixtureTemplateOptions {
  capturedAt?: string;
  sourceId?: string;
  sourceUrl?: string;
  title?: string;
}

export type FullTextFixtureProgressStatus =
  | "blank"
  | "blocked"
  | "extraction-draft-ready"
  | "filled"
  | "missing"
  | "unparseable";

export interface FullTextFixtureProgressInput {
  content?: string;
  missing?: boolean;
  path: string;
}

export interface FullTextFixtureProgressRow {
  blockers: string[];
  extractionDraftReady: boolean;
  missingRequiredFields: number;
  missingTargets: number;
  nextAction: string;
  parseable: boolean;
  path: string;
  source?: FullTextFixtureReviewReport["source"];
  status: FullTextFixtureProgressStatus;
  warnings: string[];
}

export interface FullTextFixtureProgressReport {
  derivedOnly: true;
  generatedAt: string;
  localOnly: true;
  nextAction: string;
  noAutoApproval: true;
  noCandidateDecision: true;
  noConnectorApproval: true;
  noExtractionWrite: true;
  noLiveFetch: true;
  noNetworkFetch: true;
  noPromotion: true;
  noPublicRawTextExport: true;
  rawTextStored: false;
  readOnly: true;
  rows: FullTextFixtureProgressRow[];
  summary: {
    blank: number;
    blocked: number;
    extractionDraftReady: number;
    filled: number;
    files: number;
    missing: number;
    parseable: number;
    unparseable: number;
    warnings: number;
  };
}

const MAX_FIXTURE_EXCERPT_CHARACTERS = 1200;
const WARN_FIXTURE_EXCERPT_CHARACTERS = 600;
const DEFAULT_CANDIDATE_KEY_PLACEHOLDER = "<accepted-candidate-dedupe-key>";
const FIXTURE_PROGRESS_CANDIDATE_KEY = "fixture-progress-placeholder";

const ALLOWED_CONFIDENCE: FullTextFixtureTargetConfidence[] = [
  "Strong",
  "Inferred",
  "Weak",
  "Missing"
];

const REQUIRED_STUDY_EXTRACTION_FIELDS = [
  {
    aliases: ["sampleSize", "sample", "enrollment", "n"],
    fallback: "Human-reviewed sample size required.",
    field: "sampleSize",
    note: "Required Study extraction field; verify analyzed sample size before writing.",
    writeFlag: "--study-sample-size"
  },
  {
    aliases: ["population", "participants", "subjects"],
    fallback: "Human-reviewed population required.",
    field: "population",
    note: "Required Study extraction field; verify inclusion criteria and health status before writing.",
    writeFlag: "--study-population"
  },
  {
    aliases: ["interventionName", "intervention", "exposure"],
    fallback: "Human-reviewed intervention required.",
    field: "interventionName",
    note: "Required Study extraction field; verify formulation and exposure context before writing.",
    writeFlag: "--study-intervention-name"
  },
  {
    aliases: ["outcomes", "outcome", "primaryOutcome", "mainOutcome", "endpoint"],
    fallback: "Human-reviewed outcome required.",
    field: "outcomes",
    note: "Required Study extraction field; verify endpoint and claim relevance before writing.",
    writeFlag: "--study-outcome"
  },
  {
    aliases: ["adverseEvents", "safetyNotes", "safety", "harms", "sideEffects"],
    fallback: "Human-reviewed adverse event summary required.",
    field: "adverseEvents",
    note: "Required Study extraction field; do not infer safety from absence of local warnings.",
    writeFlag: "--study-adverse-events"
  },
  {
    aliases: ["fundingConflicts", "funding", "conflicts", "conflictOfInterest", "coi"],
    fallback: "Human-reviewed funding/conflict note required.",
    field: "fundingConflicts",
    note: "Required Study extraction field; verify funding and conflicts from the source packet.",
    writeFlag: "--study-funding-conflicts"
  },
  {
    aliases: ["riskOfBias", "bias", "studyQuality", "quality"],
    fallback: "Human-reviewed risk-of-bias assessment required.",
    field: "riskOfBias",
    note: "Required Study extraction field; verify design limitations before writing.",
    writeFlag: "--study-risk-of-bias"
  }
] as const;

const OPTIONAL_STUDY_EXTRACTION_FIELDS = [
  {
    aliases: ["abstract", "sourceSummary", "summary"],
    field: "abstract",
    note: "Optional Study extraction field; keep concise and source-reviewed.",
    writeFlag: "--study-abstract"
  },
  {
    aliases: ["dose", "dosage", "exposureDose"],
    field: "dose",
    note: "Optional Study extraction field; avoid individualized dosing guidance.",
    writeFlag: "--study-dose"
  },
  {
    aliases: ["duration", "followUp", "studyDuration"],
    field: "duration",
    note: "Optional Study extraction field; verify intervention and follow-up duration.",
    writeFlag: "--study-duration"
  },
  {
    aliases: ["mainResults", "results", "findings"],
    field: "mainResults",
    note: "Optional Study extraction field; retain uncertainty and avoid overclaiming.",
    writeFlag: "--study-main-results"
  }
] as const;

const REVIEW_ONLY_EXTRACTION_FIELDS = [
  {
    aliases: ["comparator", "control", "placebo"],
    field: "comparator",
    note: "Comparator is not a Study write flag yet; keep it as review context for claim wording."
  }
] as const;

export function buildFullTextLocalFixtureTemplate({
  capturedAt = new Date().toISOString(),
  sourceId = "operator-local-source-packet",
  sourceUrl = "https://example.test/reviewed-source",
  title = "Local full-text fixture starter"
}: FullTextFixtureTemplateOptions = {}): FullTextLocalFixture {
  return {
    capturedAt,
    derivedExtractionTargets: [
      fixtureTemplateTarget("population"),
      fixtureTemplateTarget("intervention"),
      fixtureTemplateTarget("comparator"),
      fixtureTemplateTarget("duration"),
      fixtureTemplateTarget("mainResults"),
      fixtureTemplateTarget("safetyNotes")
    ],
    reviewerNote:
      "Local operator-owned fixture starter. Replace placeholders after reviewing source rights and keep only the minimum short excerpt needed for parser-shape testing.",
    sourceId,
    sourceUrl,
    textExcerpt:
      "Replace this placeholder with a short reviewed local excerpt needed only for parser-shape testing. Do not paste full article text.",
    title
  };
}

export function parseFullTextLocalFixture(value: unknown): FullTextLocalFixture {
  const record = requireRecord(value, "fixture");

  return {
    capturedAt: requireString(record.capturedAt, "capturedAt"),
    derivedExtractionTargets: parseDerivedExtractionTargets(
      record.derivedExtractionTargets
    ),
    reviewerNote: readString(record.reviewerNote),
    sourceId: requireString(record.sourceId, "sourceId"),
    sourceUrl: requireString(record.sourceUrl, "sourceUrl"),
    textExcerpt: requireString(record.textExcerpt, "textExcerpt"),
    title: requireString(record.title, "title")
  };
}

export function buildFullTextFixtureReviewReport({
  fixture,
  generatedAt
}: {
  fixture: FullTextLocalFixture;
  generatedAt?: Date;
}): FullTextFixtureReviewReport {
  const targets = fixture.derivedExtractionTargets.map((target) => ({
    confidence: target.confidence,
    field: target.field,
    hasValue: Boolean(target.value),
    note: target.note,
    quoteLocator: target.quoteLocator,
    valueCharacters: target.value.length,
    valuePreview: truncatePreview(target.value)
  }));
  const blockers = fixtureBlockers(fixture, targets);
  const warnings = fixtureWarnings(fixture, targets);
  const readyForDerivedReview = blockers.length === 0;

  return {
    blockers,
    derivedOnly: true,
    generatedAt: (generatedAt ?? new Date()).toISOString(),
    localOnly: true,
    nextAction: readyForDerivedReview
      ? "Use this fixture only for local parser-shape tests and operator review of derived fields; do not store raw text or publish it."
      : "Fix fixture blockers before using it for local parser-shape tests.",
    noAutoApproval: true,
    noCandidateDecision: true,
    noConnectorApproval: true,
    noExtractionWrite: true,
    noLiveFetch: true,
    noNetworkFetch: true,
    noPublicRawTextExport: true,
    noPromotion: true,
    rawTextStored: false,
    readOnly: true,
    source: {
      capturedAt: fixture.capturedAt,
      sourceId: fixture.sourceId,
      sourceUrl: fixture.sourceUrl,
      textExcerptCharacters: fixture.textExcerpt.length,
      title: fixture.title
    },
    summary: {
      blockers: blockers.length,
      missingTargets: targets.filter((target) => !target.hasValue).length,
      readyForDerivedReview,
      targets: targets.length,
      warnings: warnings.length
    },
    targets,
    warnings
  };
}

export function summarizeFullTextFixtureReviewReport(
  report: FullTextFixtureReviewReport
) {
  return {
    blockers: report.blockers,
    derivedOnly: true,
    generatedAt: report.generatedAt,
    localOnly: true,
    nextAction: report.nextAction,
    noAutoApproval: true,
    noCandidateDecision: true,
    noConnectorApproval: true,
    noExtractionWrite: true,
    noLiveFetch: true,
    noNetworkFetch: true,
    noPublicRawTextExport: true,
    noPromotion: true,
    rawTextStored: false,
    readOnly: true,
    source: report.source,
    summary: report.summary,
    targets: report.targets.map((target) => ({
      confidence: target.confidence,
      field: target.field,
      hasValue: target.hasValue,
      valueCharacters: target.valueCharacters
    })),
    warnings: report.warnings
  };
}

export function buildFullTextFixtureExtractionDraft({
  candidateKey,
  fixture,
  generatedAt,
  studySourceType
}: FullTextFixtureExtractionDraftOptions): FullTextFixtureExtractionDraft {
  const report = buildFullTextFixtureReviewReport({ fixture, generatedAt });
  const requiredFields = REQUIRED_STUDY_EXTRACTION_FIELDS.map((spec) =>
    extractionDraftField(fixture, spec, true)
  );
  const optionalFields = OPTIONAL_STUDY_EXTRACTION_FIELDS.map((spec) =>
    extractionDraftField(fixture, spec, false)
  );
  const reviewOnlyFields = REVIEW_ONLY_EXTRACTION_FIELDS.map((spec) =>
    extractionDraftField(fixture, spec, false)
  ).filter((field) => field.hasValue);
  const missingRequiredFieldLabels = requiredFields
    .filter((field) => !field.hasValue)
    .map((field) => `${field.field} (${field.writeFlag})`);
  const commandCandidateKey = candidateKey?.trim() || DEFAULT_CANDIDATE_KEY_PLACEHOLDER;
  const blockers = unique([
    ...report.blockers,
    ...(candidateKey?.trim()
      ? []
      : [
          "candidateKey is required before the extraction command draft can be reviewed for a real accepted candidate."
        ]),
    ...missingRequiredFieldLabels.map(
      (field) => `Required extraction field is missing from reviewed fixture: ${field}.`
    )
  ]);
  const warnings = unique([
    ...report.warnings,
    ...requiredFields
      .filter((field) => field.hasValue && field.confidence === "Weak")
      .map(
        (field) =>
          `Required extraction field ${field.field} has Weak fixture confidence; verify before writing.`
      ),
    ...optionalFields
      .filter((field) => field.hasValue && field.confidence === "Weak")
      .map(
        (field) =>
          `Optional extraction field ${field.field} has Weak fixture confidence; verify before writing.`
      ),
    reviewOnlyFields.length > 0
      ? "Comparator/review-only fixture values are not included in the Study write command; carry them into claim wording review manually."
      : undefined,
    "This draft does not check candidate acceptance, claim link, reference match, or operator write controls; the ingest command still enforces those checks."
  ].filter((warning): warning is string => Boolean(warning)));
  const commandDraftReady = blockers.length === 0;

  return {
    blockers,
    commandTemplate: formatFixtureExtractionCommand({
      candidateKey: commandCandidateKey,
      optionalFields,
      requiredFields,
      studySourceType
    }),
    derivedOnly: true,
    generatedAt: report.generatedAt,
    localOnly: true,
    nextAction: commandDraftReady
      ? "Review the drafted command against the accepted, claim-linked source candidate before any operator write."
      : "Resolve fixture extraction blockers before using the drafted command for operator review.",
    noAutoApproval: true,
    noCandidateDecision: true,
    noConnectorApproval: true,
    noDbValidation: true,
    noExtractionWrite: true,
    noLiveFetch: true,
    noNetworkFetch: true,
    noPromotion: true,
    noPublicRawTextExport: true,
    optionalFields,
    rawTextStored: false,
    readOnly: true,
    requiredFields,
    reviewOnlyFields,
    source: report.source,
    summary: {
      commandDraftReady,
      missingRequiredFields: missingRequiredFieldLabels.length,
      optionalFields: optionalFields.filter((field) => field.hasValue).length,
      requiredFields: requiredFields.length,
      reviewOnlyFields: reviewOnlyFields.length,
      warnings: warnings.length
    },
    warnings
  };
}

export function summarizeFullTextFixtureExtractionDraft(
  draft: FullTextFixtureExtractionDraft
) {
  return {
    blockers: draft.blockers,
    commandDraftReady: draft.summary.commandDraftReady,
    commandTemplate: draft.commandTemplate,
    derivedOnly: true,
    generatedAt: draft.generatedAt,
    localOnly: true,
    missingRequiredFields: draft.requiredFields
      .filter((field) => !field.hasValue)
      .map((field) => ({
        field: field.field,
        writeFlag: field.writeFlag
      })),
    nextAction: draft.nextAction,
    noAutoApproval: true,
    noCandidateDecision: true,
    noConnectorApproval: true,
    noDbValidation: true,
    noExtractionWrite: true,
    noLiveFetch: true,
    noNetworkFetch: true,
    noPromotion: true,
    noPublicRawTextExport: true,
    rawTextStored: false,
    readOnly: true,
    source: draft.source,
    summary: draft.summary,
    warnings: draft.warnings
  };
}

export function buildFullTextFixtureProgressReport({
  fixtures,
  generatedAt
}: {
  fixtures: FullTextFixtureProgressInput[];
  generatedAt?: Date;
}): FullTextFixtureProgressReport {
  const rows = fixtures
    .map((fixture) => fixtureProgressRow(fixture))
    .sort((first, second) => first.path.localeCompare(second.path));
  const summary = {
    blank: rows.filter((row) => row.status === "blank").length,
    blocked: rows.filter((row) => row.status === "blocked").length,
    extractionDraftReady: rows.filter(
      (row) => row.status === "extraction-draft-ready"
    ).length,
    filled: rows.filter((row) => row.status === "filled").length,
    files: rows.length,
    missing: rows.filter((row) => row.status === "missing").length,
    parseable: rows.filter((row) => row.parseable).length,
    unparseable: rows.filter((row) => row.status === "unparseable").length,
    warnings: rows.reduce((total, row) => total + row.warnings.length, 0)
  };
  const blockedLike =
    summary.blank + summary.blocked + summary.missing + summary.unparseable;

  return {
    derivedOnly: true,
    generatedAt: (generatedAt ?? new Date()).toISOString(),
    localOnly: true,
    nextAction:
      rows.length === 0
        ? "No local fixture files were found; write connector prep starters before checking fixture progress."
        : blockedLike > 0
          ? "Fill or fix blocked local fixture starters before extraction-draft review."
          : summary.extractionDraftReady > 0
            ? "Review extraction-draft-ready fixtures against accepted, claim-linked candidates before any operator write."
            : "Review filled local fixtures and add required extraction fields before drafting write commands.",
    noAutoApproval: true,
    noCandidateDecision: true,
    noConnectorApproval: true,
    noExtractionWrite: true,
    noLiveFetch: true,
    noNetworkFetch: true,
    noPromotion: true,
    noPublicRawTextExport: true,
    rawTextStored: false,
    readOnly: true,
    rows,
    summary
  };
}

export function summarizeFullTextFixtureProgressReport(
  report: FullTextFixtureProgressReport
) {
  return {
    derivedOnly: true,
    generatedAt: report.generatedAt,
    localOnly: true,
    nextAction: report.nextAction,
    noAutoApproval: true,
    noCandidateDecision: true,
    noConnectorApproval: true,
    noExtractionWrite: true,
    noLiveFetch: true,
    noNetworkFetch: true,
    noPromotion: true,
    noPublicRawTextExport: true,
    rawTextStored: false,
    readOnly: true,
    rows: report.rows.map((row) => ({
      blockers: row.blockers,
      extractionDraftReady: row.extractionDraftReady,
      missingRequiredFields: row.missingRequiredFields,
      missingTargets: row.missingTargets,
      nextAction: row.nextAction,
      parseable: row.parseable,
      path: row.path,
      source: row.source,
      status: row.status,
      warnings: row.warnings
    })),
    summary: report.summary
  };
}

function fixtureProgressRow(
  input: FullTextFixtureProgressInput
): FullTextFixtureProgressRow {
  if (input.missing) {
    return {
      blockers: ["Fixture file is missing."],
      extractionDraftReady: false,
      missingRequiredFields: REQUIRED_STUDY_EXTRACTION_FIELDS.length,
      missingTargets: 0,
      nextAction: "Create the local fixture starter before checking progress.",
      parseable: false,
      path: input.path,
      status: "missing",
      warnings: []
    };
  }

  try {
    const fixture = parseFullTextLocalFixture(
      JSON.parse(input.content ?? "null") as unknown
    );
    const report = buildFullTextFixtureReviewReport({ fixture });
    const draft = buildFullTextFixtureExtractionDraft({
      candidateKey: FIXTURE_PROGRESS_CANDIDATE_KEY,
      fixture,
      studySourceType: "reviewed-local-fixture"
    });
    const status = fixtureProgressStatus({ draft, fixture, report });

    return {
      blockers: status === "blank" ? [] : draft.blockers,
      extractionDraftReady: draft.summary.commandDraftReady,
      missingRequiredFields: draft.summary.missingRequiredFields,
      missingTargets: report.summary.missingTargets,
      nextAction: fixtureProgressNextAction(status),
      parseable: true,
      path: input.path,
      source: report.source,
      status,
      warnings: draft.warnings
    };
  } catch (error) {
    return {
      blockers: [error instanceof Error ? error.message : String(error)],
      extractionDraftReady: false,
      missingRequiredFields: REQUIRED_STUDY_EXTRACTION_FIELDS.length,
      missingTargets: 0,
      nextAction: "Fix the local fixture JSON before reviewing derived fields.",
      parseable: false,
      path: input.path,
      status: "unparseable",
      warnings: []
    };
  }
}

function fixtureProgressStatus({
  draft,
  fixture,
  report
}: {
  draft: FullTextFixtureExtractionDraft;
  fixture: FullTextLocalFixture;
  report: FullTextFixtureReviewReport;
}): FullTextFixtureProgressStatus {
  if (isBlankFixtureStarter(fixture)) {
    return "blank";
  }

  if (report.blockers.length > 0) {
    return "blocked";
  }

  if (draft.summary.commandDraftReady) {
    return "extraction-draft-ready";
  }

  return "filled";
}

function isBlankFixtureStarter(fixture: FullTextLocalFixture) {
  return (
    fixture.textExcerpt.startsWith("Replace this placeholder") &&
    fixture.derivedExtractionTargets.length > 0 &&
    fixture.derivedExtractionTargets.every(
      (target) => target.confidence === "Missing" && !target.value.trim()
    )
  );
}

function fixtureProgressNextAction(status: FullTextFixtureProgressStatus) {
  if (status === "blank") {
    return "Fill reviewed local fixture values and keep only a short reviewed excerpt.";
  }

  if (status === "blocked") {
    return "Resolve fixture blockers before parser-shape or extraction-draft review.";
  }

  if (status === "extraction-draft-ready") {
    return "Preview the extraction draft against an accepted, claim-linked candidate before any operator write.";
  }

  if (status === "filled") {
    return "Add missing required extraction fields or keep this fixture as derived-review context only.";
  }

  if (status === "missing") {
    return "Create the local fixture starter before checking progress.";
  }

  return "Fix the local fixture JSON before reviewing derived fields.";
}

function parseDerivedExtractionTargets(
  value: unknown
): FullTextFixtureDerivedExtractionTarget[] {
  if (!Array.isArray(value)) {
    throw new Error("Full-text fixture derivedExtractionTargets must be an array.");
  }

  return value.map((item, index) => {
    const record = requireRecord(item, `derivedExtractionTargets[${index}]`);

    return {
      confidence: parseConfidence(record.confidence),
      field: requireString(record.field, `derivedExtractionTargets[${index}].field`),
      note: readString(record.note),
      quoteLocator: readString(record.quoteLocator),
      value: readString(record.value)
    };
  });
}

function fixtureTemplateTarget(
  field: string
): FullTextFixtureDerivedExtractionTarget {
  return {
    confidence: "Missing",
    field,
    note: "Fill only after local operator review; leave blank if unavailable.",
    quoteLocator: "",
    value: ""
  };
}

function parseConfidence(value: unknown): FullTextFixtureTargetConfidence {
  const text = readString(value);

  if (!text) {
    return "Missing";
  }

  if (!ALLOWED_CONFIDENCE.includes(text as FullTextFixtureTargetConfidence)) {
    throw new Error(`Unsupported full-text fixture confidence: ${text}.`);
  }

  return text as FullTextFixtureTargetConfidence;
}

function extractionDraftField(
  fixture: FullTextLocalFixture,
  spec: {
    aliases: readonly string[];
    field: string;
    note: string;
    writeFlag?: string;
  },
  required: boolean
): FullTextFixtureExtractionDraftField {
  const target = findFixtureTarget(fixture, spec.aliases);
  const value = target?.value.trim() ?? "";

  return {
    confidence: target?.confidence,
    field: spec.field,
    hasValue: Boolean(value),
    note: target?.note || spec.note,
    quoteLocator: target?.quoteLocator,
    required,
    sourceField: target?.field,
    status: value ? "ready" : "missing",
    value: value || undefined,
    valueCharacters: value.length,
    valuePreview: value ? truncatePreview(value) : undefined,
    writeFlag: spec.writeFlag
  };
}

function findFixtureTarget(
  fixture: FullTextLocalFixture,
  aliases: readonly string[]
) {
  const aliasSet = new Set(aliases.map(normalizeFixtureFieldName));

  return fixture.derivedExtractionTargets.find((target) =>
    aliasSet.has(normalizeFixtureFieldName(target.field))
  );
}

function normalizeFixtureFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatFixtureExtractionCommand({
  candidateKey,
  optionalFields,
  requiredFields,
  studySourceType
}: {
  candidateKey: string;
  optionalFields: FullTextFixtureExtractionDraftField[];
  requiredFields: FullTextFixtureExtractionDraftField[];
  studySourceType?: string;
}) {
  return [
    "npm run ingest:sources --",
    `--extract-candidate-study ${commandTextArgument(candidateKey)}`,
    ...(studySourceType?.trim()
      ? [`--study-source-type ${commandTextArgument(studySourceType.trim())}`]
      : []),
    ...requiredFields.map(
      (field) =>
        `${field.writeFlag} ${commandTextArgument(
          fixtureCommandFieldValue(field, requiredFieldFallback(field.field))
        )}`
    ),
    ...optionalFields
      .filter((field) => field.hasValue)
      .map(
        (field) =>
          `${field.writeFlag} ${commandTextArgument(
            fixtureCommandFieldValue(field)
          )}`
      )
  ].join(" ");
}

function fixtureCommandFieldValue(
  field: FullTextFixtureExtractionDraftField,
  fallback?: string
) {
  if (field.value) {
    return field.value;
  }

  return fallback ?? field.valuePreview ?? "";
}

function requiredFieldFallback(field: string) {
  return (
    REQUIRED_STUDY_EXTRACTION_FIELDS.find((spec) => spec.field === field)?.fallback ??
    `Human-reviewed ${field} required.`
  );
}

function commandTextArgument(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function fixtureBlockers(
  fixture: FullTextLocalFixture,
  targets: FullTextFixtureReviewReportTarget[]
) {
  const blockers = [
    fixture.textExcerpt.length > MAX_FIXTURE_EXCERPT_CHARACTERS
      ? `textExcerpt is ${fixture.textExcerpt.length} characters; local fixtures must stay at or below ${MAX_FIXTURE_EXCERPT_CHARACTERS} characters.`
      : undefined,
    targets.length === 0
      ? "At least one derived extraction target is required."
      : undefined,
    targets.every((target) => !target.hasValue)
      ? "At least one derived extraction target needs a reviewed value."
      : undefined,
    sourceUrlHasCredentialRisk(fixture.sourceUrl)
      ? "sourceUrl must not contain credentials, query strings, or fragments."
      : undefined
  ].filter((blocker): blocker is string => Boolean(blocker));

  return unique(blockers);
}

function fixtureWarnings(
  fixture: FullTextLocalFixture,
  targets: FullTextFixtureReviewReportTarget[]
) {
  const warnings = [
    fixture.textExcerpt.length > WARN_FIXTURE_EXCERPT_CHARACTERS
      ? `textExcerpt is ${fixture.textExcerpt.length} characters; keep only the minimum local excerpt needed for parser-shape testing.`
      : undefined,
    fixture.reviewerNote
      ? undefined
      : "reviewerNote is empty; add a local operator note before relying on this fixture.",
    targets.some((target) => target.confidence === "Missing" || !target.hasValue)
      ? "One or more derived targets are missing values and should remain review-only."
      : undefined,
    targets.some((target) => !target.quoteLocator)
      ? "One or more derived targets are missing a quoteLocator for local traceability."
      : undefined
  ].filter((warning): warning is string => Boolean(warning));

  return unique(warnings);
}

function sourceUrlHasCredentialRisk(value: string) {
  try {
    const url = new URL(value);

    return Boolean(url.username || url.password || url.search || url.hash);
  } catch {
    return false;
  }
}

function truncatePreview(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`Full-text ${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string) {
  const text = readString(value);

  if (!text) {
    throw new Error(`Full-text fixture ${label} is required.`);
  }

  return text;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
