import type { Prisma } from "@prisma/client";

export const SOURCE_CANDIDATE_DISCOVERY_CLASSIFIER_VERSION = "2026-06-27";
export const LOCAL_ACCEPTED_PROCESSING_METADATA_VERSION = "accepted-candidate-v1";
export const LOCAL_BENEFIT_DISCOVERY_METADATA_VERSION = "benefit-discovery-v1";
export const LOCAL_IDENTITY_RESOLUTION_METADATA_VERSION = "identity-resolution-v1";

export const SOURCE_CANDIDATE_METADATA_KEYS = {
  acceptedProcessing: "localAcceptedProcessing",
  benefitDiscoveryDecision: "localBenefitDiscoveryDecision",
  discoveryClassification: "discoveryClassification",
  identityResolution: "localIdentityResolution"
} as const;

export const SOURCE_CANDIDATE_METADATA_PATHS = {
  acceptedProcessingNeedsClaim: [
    SOURCE_CANDIDATE_METADATA_KEYS.acceptedProcessing,
    "needsClaim"
  ],
  acceptedProcessingVersion: [
    SOURCE_CANDIDATE_METADATA_KEYS.acceptedProcessing,
    "version"
  ],
  discoveryClassificationBucket: [
    SOURCE_CANDIDATE_METADATA_KEYS.discoveryClassification,
    "bucket"
  ]
} as const;

export type SourceCandidateDiscoveryBucket =
  | "likely-useful"
  | "maybe-useful"
  | "likely-noise";

export interface SourceCandidateDiscoveryClassification {
  bucket: SourceCandidateDiscoveryBucket;
  cautions: string[];
  label: "Likely useful" | "Maybe useful" | "Likely noise";
  reasons: string[];
  score: number;
  version: string;
}

export interface LocalAcceptedCandidateProcessingMetadataInput {
  error?: string;
  linkedClaim: boolean;
  needsClaim: boolean;
  nextAction: string;
  novelOutcomes: LocalAcceptedCandidateProcessingOutcomeMetadata[];
  outcomeSuggestions: LocalAcceptedCandidateProcessingOutcomeMetadata[];
  processedAt: string;
  referenceId?: string | null;
  sourceTypeSuggestion: string;
}

export interface LocalAcceptedCandidateProcessingMetadata {
  linkedClaim: boolean;
  needsClaim: boolean;
  nextAction?: string;
  novelOutcomeLabels: string[];
  novelOutcomes: LocalAcceptedCandidateProcessingOutcomeMetadata[];
  outcomeLabels: string[];
  outcomeSuggestions: LocalAcceptedCandidateProcessingOutcomeMetadata[];
  processedAt?: string;
  sourceTypeSuggestion?: string;
}

export interface LocalAcceptedCandidateProcessingOutcomeMetadata {
  label?: string;
  outcome?: string;
  score?: number;
}

export type LocalBenefitDiscoveryDecisionStatus =
  | "claim-drafted"
  | "linked-existing-claim"
  | "rejected"
  | "skipped-mismatch";

export interface LocalBenefitDiscoveryDecisionMetadata {
  clusterKey: string;
  status: LocalBenefitDiscoveryDecisionStatus;
}

export interface LocalBenefitDiscoveryDecisionMetadataInput {
  action: string;
  claimId?: string;
  clusterKey: string;
  status: LocalBenefitDiscoveryDecisionStatus;
}

export type LocalIdentityResolutionStatus =
  | "confirmed-target"
  | "rejected-wrong-supplement";

export interface LocalIdentityResolutionMetadata {
  interventionId: string;
  status: LocalIdentityResolutionStatus;
}

export interface LocalIdentityResolutionMetadataInput {
  action: string;
  interventionId: string;
  status: LocalIdentityResolutionStatus;
  synonym?: string;
}

export function sourceCandidateMetadataObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function sourceCandidateMetadataInput(
  value: Record<string, unknown>
): Prisma.InputJsonObject {
  return stripUndefined(value) as Prisma.InputJsonObject;
}

export function sourceCandidateMetadataString(
  metadata: Record<string, unknown>,
  key: string
) {
  const value = metadata[key];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function sourceCandidateMetadataStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];
}

export function readSourceCandidateDiscoveryClassification(metadata: unknown) {
  const classification =
    sourceCandidateMetadataObject(metadata)[
      SOURCE_CANDIDATE_METADATA_KEYS.discoveryClassification
    ];

  if (!classification || typeof classification !== "object" || Array.isArray(classification)) {
    return undefined;
  }

  const record = classification as Record<string, unknown>;
  const bucket = record.bucket;
  const label = record.label;
  const score = record.score;

  if (!isSourceCandidateDiscoveryBucket(bucket)) {
    return undefined;
  }

  if (!isSourceCandidateDiscoveryLabel(label) || typeof score !== "number") {
    return undefined;
  }

  return {
    bucket,
    cautions: sourceCandidateMetadataStringArray(record.cautions),
    label,
    reasons: sourceCandidateMetadataStringArray(record.reasons),
    score,
    version:
      sourceCandidateMetadataString(record, "version") ??
      SOURCE_CANDIDATE_DISCOVERY_CLASSIFIER_VERSION
  } satisfies SourceCandidateDiscoveryClassification;
}

export function readLocalAcceptedCandidateProcessingMetadata(metadata: unknown) {
  const processing =
    sourceCandidateMetadataObject(metadata)[SOURCE_CANDIDATE_METADATA_KEYS.acceptedProcessing];

  if (!processing || typeof processing !== "object" || Array.isArray(processing)) {
    return undefined;
  }

  const record = processing as Record<string, unknown>;

  if (record.version !== LOCAL_ACCEPTED_PROCESSING_METADATA_VERSION) {
    return undefined;
  }

  const novelOutcomes = localProcessingOutcomeMetadata(record.novelOutcomes);
  const outcomeSuggestions = localProcessingOutcomeMetadata(record.outcomeSuggestions);

  return {
    linkedClaim: record.linkedClaim === true,
    needsClaim: record.needsClaim === true,
    nextAction: sourceCandidateMetadataString(record, "nextAction"),
    novelOutcomeLabels: localProcessingOutcomeLabels(record.novelOutcomes),
    novelOutcomes,
    outcomeLabels: localProcessingOutcomeLabels(record.outcomeSuggestions),
    outcomeSuggestions,
    processedAt: sourceCandidateMetadataString(record, "processedAt"),
    sourceTypeSuggestion: sourceCandidateMetadataString(record, "sourceTypeSuggestion")
  } satisfies LocalAcceptedCandidateProcessingMetadata;
}

export function writeLocalAcceptedCandidateProcessingMetadata(
  metadata: unknown,
  input: LocalAcceptedCandidateProcessingMetadataInput
) {
  return sourceCandidateMetadataInput({
    ...sourceCandidateMetadataObject(metadata),
    [SOURCE_CANDIDATE_METADATA_KEYS.acceptedProcessing]: {
      error: input.error,
      linkedClaim: input.linkedClaim,
      needsClaim: input.needsClaim,
      nextAction: input.nextAction,
      novelOutcomes: input.novelOutcomes,
      outcomeSuggestions: input.outcomeSuggestions,
      processedAt: input.processedAt,
      referenceId: input.referenceId,
      sourceTypeSuggestion: input.sourceTypeSuggestion,
      version: LOCAL_ACCEPTED_PROCESSING_METADATA_VERSION
    }
  });
}

export function readLocalBenefitDiscoveryDecisionMetadata(metadata: unknown) {
  const decision =
    sourceCandidateMetadataObject(metadata)[
      SOURCE_CANDIDATE_METADATA_KEYS.benefitDiscoveryDecision
    ];

  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    return undefined;
  }

  const record = decision as Record<string, unknown>;

  if (record.version !== LOCAL_BENEFIT_DISCOVERY_METADATA_VERSION) {
    return undefined;
  }

  const clusterKey = sourceCandidateMetadataString(record, "clusterKey");
  const status = sourceCandidateMetadataString(record, "status");

  if (!clusterKey || !isLocalBenefitDiscoveryDecisionStatus(status)) {
    return undefined;
  }

  return {
    clusterKey,
    status
  } satisfies LocalBenefitDiscoveryDecisionMetadata;
}

export function writeLocalBenefitDiscoveryDecisionMetadata(
  metadata: unknown,
  input: LocalBenefitDiscoveryDecisionMetadataInput,
  decidedAt = new Date()
) {
  return sourceCandidateMetadataInput({
    ...sourceCandidateMetadataObject(metadata),
    [SOURCE_CANDIDATE_METADATA_KEYS.benefitDiscoveryDecision]: {
      action: input.action,
      claimId: input.claimId,
      clusterKey: input.clusterKey,
      decidedAt: decidedAt.toISOString(),
      status: input.status,
      version: LOCAL_BENEFIT_DISCOVERY_METADATA_VERSION
    }
  });
}

export function readLocalIdentityResolutionMetadata(metadata: unknown) {
  const resolution =
    sourceCandidateMetadataObject(metadata)[SOURCE_CANDIDATE_METADATA_KEYS.identityResolution];

  if (!resolution || typeof resolution !== "object" || Array.isArray(resolution)) {
    return undefined;
  }

  const record = resolution as Record<string, unknown>;

  if (record.version !== LOCAL_IDENTITY_RESOLUTION_METADATA_VERSION) {
    return undefined;
  }

  const interventionId = sourceCandidateMetadataString(record, "interventionId");
  const status = sourceCandidateMetadataString(record, "status");

  if (!interventionId || !isLocalIdentityResolutionStatus(status)) {
    return undefined;
  }

  return {
    interventionId,
    status
  } satisfies LocalIdentityResolutionMetadata;
}

export function writeLocalIdentityResolutionMetadata(
  metadata: unknown,
  input: LocalIdentityResolutionMetadataInput,
  resolvedAt = new Date()
) {
  const nextMetadata: Record<string, unknown> = {
    ...sourceCandidateMetadataObject(metadata),
    [SOURCE_CANDIDATE_METADATA_KEYS.identityResolution]: {
      action: input.action,
      interventionId: input.interventionId,
      resolvedAt: resolvedAt.toISOString(),
      status: input.status,
      synonym: input.synonym,
      version: LOCAL_IDENTITY_RESOLUTION_METADATA_VERSION
    }
  };

  if (input.status === "confirmed-target") {
    delete nextMetadata[SOURCE_CANDIDATE_METADATA_KEYS.benefitDiscoveryDecision];
  }

  return sourceCandidateMetadataInput(nextMetadata);
}

function localProcessingOutcomeLabels(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim() || undefined;
      }

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return undefined;
      }

      return sourceCandidateMetadataString(item as Record<string, unknown>, "label");
    })
    .filter((item): item is string => Boolean(item));
}

function localProcessingOutcomeMetadata(
  value: unknown
): LocalAcceptedCandidateProcessingOutcomeMetadata[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return undefined;
      }

      const record = item as Record<string, unknown>;
      const label = sourceCandidateMetadataString(record, "label");
      const outcome = sourceCandidateMetadataString(record, "outcome");
      const score = typeof record.score === "number" ? record.score : undefined;

      if (!label && !outcome && score === undefined) {
        return undefined;
      }

      const next: LocalAcceptedCandidateProcessingOutcomeMetadata = {};

      if (label) {
        next.label = label;
      }

      if (outcome) {
        next.outcome = outcome;
      }

      if (score !== undefined) {
        next.score = score;
      }

      return next;
    })
    .filter((item): item is LocalAcceptedCandidateProcessingOutcomeMetadata => Boolean(item));
}

function isSourceCandidateDiscoveryBucket(
  value: unknown
): value is SourceCandidateDiscoveryBucket {
  return value === "likely-useful" || value === "maybe-useful" || value === "likely-noise";
}

function isSourceCandidateDiscoveryLabel(
  value: unknown
): value is SourceCandidateDiscoveryClassification["label"] {
  return value === "Likely useful" || value === "Maybe useful" || value === "Likely noise";
}

function isLocalBenefitDiscoveryDecisionStatus(
  value: unknown
): value is LocalBenefitDiscoveryDecisionStatus {
  return (
    value === "claim-drafted" ||
    value === "linked-existing-claim" ||
    value === "rejected" ||
    value === "skipped-mismatch"
  );
}

function isLocalIdentityResolutionStatus(value: unknown): value is LocalIdentityResolutionStatus {
  return value === "confirmed-target" || value === "rejected-wrong-supplement";
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)).filter((item) => item !== undefined);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, stripUndefined(item)] as const)
      .filter(([, item]) => item !== undefined)
  );
}
