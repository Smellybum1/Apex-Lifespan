import {
  SourceKind as DbSourceKind,
  type Prisma
} from "@prisma/client";

import type {
  ClinicalTrialAlertLabel,
  ClinicalTrialRelevanceLabel,
  ClinicalTrialResultLabel,
  ClinicalTrialSearchItem,
  ClinicalTrialSearchResult
} from "@/lib/integrations/clinical-trials";
import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal, OperatorWriteEnv } from "@/lib/operator/authorization";
import { requireOperatorPermission } from "@/lib/operator/authorization";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";
import {
  buildClinicalTrialAlertDrafts,
  type TrialAlertDraftContext
} from "@/lib/trial-alerts";

export interface RecordTrialAlertsAsOperatorInput extends TrialAlertDraftContext {
  note: string;
  result: ClinicalTrialSearchResult;
  reviewedAt?: Date;
}

export interface RecordTrialAlertFromSourceCandidateInput {
  dedupeKey: string;
  detectedAt?: Date;
  note: string;
  reviewedAt?: Date;
}

export interface RecordedTrialAlerts {
  alertIds: string[];
  count: number;
  noAutoPromotion: true;
}

export async function recordTrialAlertsAsOperator(
  principal: OperatorPrincipal,
  input: RecordTrialAlertsAsOperatorInput,
  env?: OperatorWriteEnv
): Promise<RecordedTrialAlerts> {
  requireOperatorPermission(principal, "curation:study-extraction", env);

  const note = input.note.trim();
  const reviewedAt = input.reviewedAt ?? new Date();

  if (!note) {
    throw new Error("Trial alert review note is required.");
  }

  const drafts = buildClinicalTrialAlertDrafts(input.result, {
    claimId: input.claimId,
    detectedAt: input.detectedAt,
    interventionId: input.interventionId,
    sourceCandidateIdByNctId: input.sourceCandidateIdByNctId,
    trialIdByNctId: input.trialIdByNctId
  });

  const alerts = await prisma.$transaction(async (tx) => {
    const createdAlerts = await Promise.all(
      drafts.map((draft) =>
        tx.trialAlert.create({
          data: {
            ...draft.data,
            reviewedAt,
            reviewerNotes: note
          },
          select: {
            id: true,
            kind: true,
            nctId: true,
            noAutoPromotion: true,
            status: true
          }
        })
      )
    );

    await recordOperatorAuditEvent(
      principal,
      {
        action: "trialAlert.record",
        afterSummary: {
          alertIds: createdAlerts.map((alert) => alert.id),
          count: createdAlerts.length,
          noAutoPromotion: createdAlerts.every((alert) => alert.noAutoPromotion)
        },
        metadata: {
          kinds: createdAlerts.map((alert) => alert.kind),
          nctIds: createdAlerts.map((alert) => alert.nctId).filter(Boolean),
          query: input.result.query,
          source: input.result.source,
          statuses: createdAlerts.map((alert) => alert.status)
        },
        note,
        targetType: "TrialAlert"
      },
      tx
    );

    return createdAlerts;
  });

  return {
    alertIds: alerts.map((alert) => alert.id),
    count: alerts.length,
    noAutoPromotion: true
  };
}

export async function recordTrialAlertFromSourceCandidateAsOperator(
  principal: OperatorPrincipal,
  input: RecordTrialAlertFromSourceCandidateInput,
  env?: OperatorWriteEnv
): Promise<RecordedTrialAlerts> {
  requireOperatorPermission(principal, "curation:study-extraction", env);

  const note = input.note.trim();
  const dedupeKey = input.dedupeKey.trim();

  if (!dedupeKey) {
    throw new Error("Source candidate dedupe key is required.");
  }

  if (!note) {
    throw new Error("Trial alert review note is required.");
  }

  const candidate = await prisma.sourceCandidate.findUnique({
    select: {
      claimId: true,
      externalId: true,
      id: true,
      interventionId: true,
      metadata: true,
      query: true,
      source: true,
      sourceType: true,
      title: true,
      triageReasons: true,
      triageScore: true,
      url: true
    },
    where: {
      dedupeKey
    }
  });

  if (!candidate) {
    throw new Error("Source candidate not found for trial-alert recording.");
  }

  if (candidate.source !== DbSourceKind.CLINICALTRIALS_GOV) {
    throw new Error("Trial alerts can only be recorded from ClinicalTrials.gov candidates.");
  }

  const result = clinicalTrialResultFromCandidate(candidate);
  const nctId = result.studies[0]?.nctId;

  return recordTrialAlertsAsOperator(
    principal,
    {
      claimId: candidate.claimId ?? undefined,
      detectedAt: input.detectedAt,
      interventionId: candidate.interventionId ?? undefined,
      note,
      result,
      reviewedAt: input.reviewedAt,
      sourceCandidateIdByNctId: nctId
        ? new Map([[nctId, candidate.id]])
        : undefined
    },
    env
  );
}

type TrialAlertCandidateRecord = {
  externalId: string;
  metadata: Prisma.JsonValue | null;
  query: string;
  sourceType: string | null;
  title: string;
  triageReasons: string[];
  triageScore: number;
  url: string;
};

const trialAlertLabels: readonly ClinicalTrialAlertLabel[] = [
  "Low-priority lead",
  "Missing results follow-up",
  "Monitor active trial",
  "Registry status review",
  "Results review needed"
];

const trialRelevanceLabels: readonly ClinicalTrialRelevanceLabel[] = [
  "Combination product",
  "Direct match",
  "Related outcome only",
  "Unreviewed lead",
  "Wrong population"
];

const trialResultLabels: readonly ClinicalTrialResultLabel[] = [
  "Completed, no results posted",
  "Results posted",
  "Terminated/unknown",
  "Unreviewed lead"
];

function clinicalTrialResultFromCandidate(
  candidate: TrialAlertCandidateRecord
): ClinicalTrialSearchResult {
  const metadata = metadataRecord(candidate.metadata);
  const study: ClinicalTrialSearchItem = {
    briefSummary: metadataString(metadata, "briefSummary"),
    completionDate: metadataString(metadata, "completionDate") ?? "Unknown",
    conditions: metadataStringArray(metadata, "conditions"),
    enrollment: metadataString(metadata, "enrollment") ?? "Not provided",
    enrollmentCount: metadataNumber(metadata, "enrollmentCount"),
    hasResults: metadataBoolean(metadata, "hasResults"),
    interventions: metadataStringArray(metadata, "interventions"),
    lastUpdateDate: metadataString(metadata, "lastUpdateDate") ?? "Unknown",
    nctId: candidate.externalId || "Unknown NCT",
    phase: metadataString(metadata, "phase") ?? "Not provided",
    primaryOutcomes: metadataStringArray(metadata, "primaryOutcomes"),
    resultsFirstPostDate: metadataString(metadata, "resultsFirstPostDate") ?? null,
    sponsor: metadataString(metadata, "sponsor") ?? null,
    startDate: metadataString(metadata, "startDate") ?? "Unknown",
    status: metadataString(metadata, "status") ?? "Unknown",
    studyType: candidate.sourceType ?? "Clinical trial record",
    title: candidate.title,
    trialAlertDetail:
      metadataString(metadata, "trialAlertDetail") ??
      "This registry row is an operator review alert only; it does not change scores or promote evidence.",
    trialAlertLabel: metadataEnum(
      metadata,
      "trialAlertLabel",
      trialAlertLabels,
      "Low-priority lead"
    ),
    trialRelevanceDetail:
      metadataString(metadata, "trialRelevanceDetail") ??
      "Trial relevance needs manual review against the scoped claim.",
    trialRelevanceLabel: metadataEnum(
      metadata,
      "trialRelevanceLabel",
      trialRelevanceLabels,
      "Unreviewed lead"
    ),
    trialResultDetail:
      metadataString(metadata, "trialResultDetail") ??
      "Registry status needs manual review before treating this as evidence.",
    trialResultLabel: metadataEnum(
      metadata,
      "trialResultLabel",
      trialResultLabels,
      "Unreviewed lead"
    ),
    triageReasons: candidate.triageReasons,
    triageScore: candidate.triageScore,
    url: candidate.url
  };

  return {
    query: candidate.query,
    source: "ClinicalTrials.gov source candidate",
    studies: [study]
  };
}

function metadataRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function metadataStringArray(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) =>
    typeof item === "string" && item.trim() ? [item.trim()] : []
  );
}

function metadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function metadataBoolean(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return false;
}

function metadataEnum<T extends string>(
  metadata: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T
) {
  const value = metadataString(metadata, key);

  return allowed.includes(value as T) ? (value as T) : fallback;
}
