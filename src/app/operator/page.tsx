import { OperatorStatus } from "@prisma/client";
import { LogIn, LogOut, ShieldCheck, ShieldX } from "lucide-react";
import { revalidatePath } from "next/cache";

import { signIn, signOut } from "@/auth";
import {
  OperatorClaimScoreEditor,
  type ClaimScoreWorklistContext
} from "@/components/operator/claim-score-editor";
import { OperatorOnboardingWizard } from "@/components/operator/onboarding-wizard";
import { canOperatorAccess, operatorWritesEnabled } from "@/lib/operator/authorization";
import {
  getOperatorAuditTrailSnapshot,
  type OperatorAuditTrailSnapshot
} from "@/lib/operator/audit-trail";
import {
  extractCandidateStudyFromBrowserForm,
  importOnboardingDraftFromBrowserForm,
  linkCandidateClaimFromBrowserForm,
  promoteCandidateFromBrowserForm,
  recomputeClaimScoreFromBrowserForm,
  reviewCandidateFromBrowserForm,
  saveOnboardingDraftFromBrowserForm,
  updateClaimScoreFromBrowserForm
} from "@/lib/operator/browser-write-actions";
import {
  getOperatorBrowserWriteControlState,
  type OperatorBrowserWriteControlState
} from "@/lib/operator/browser-write-controls";
import { operatorAuthConfigured } from "@/lib/operator/config";
import {
  getSourceCandidatePromotionReadinessSnapshot,
  type SourceCandidatePromotionReadinessSnapshot
} from "@/lib/operator/curation-promotion";
import {
  getOperatorReviewQueueSnapshot,
  type OperatorReviewQueueRow
} from "@/lib/operator/review-queue";
import {
  getOperatorOnboardingQualitySnapshot,
  type OperatorOnboardingQualitySnapshot
} from "@/lib/operator/onboarding-quality";
import {
  buildOperatorGuidedOnboardingWorkflowSnapshot,
  type OperatorGuidedOnboardingWorkflowSnapshot
} from "@/lib/operator/guided-onboarding";
import {
  getSupplementOnboardingDraftReviewSnapshot,
  type SupplementOnboardingDraftReviewSnapshot
} from "@/lib/operator/supplement-onboarding-drafts";
import { getCurrentOperatorPrincipal } from "@/lib/operator/session";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import {
  buildScoreExtractionCandidatePreview,
  formatScoreExtractionBlockerCounts,
  type ScoreExtractionCandidatePreview
} from "@/lib/score-extraction-preview";
import {
  buildScoreIdentityWarningActionPreview,
  formatScoreIdentityActionCounts,
  type ScoreIdentityWarningActionPreview
} from "@/lib/score-identity-preview";
import {
  buildScoreReadinessRows,
  buildScoreReadinessSummary,
  scoreReadinessNextAction,
  scoreReadinessStateLabel,
  selectScoreReadinessEditorRows,
  type ScoreReadinessSummary
} from "@/lib/score-readiness";
import {
  buildScoreWorklistRepairSummary,
  scoreWorklistExtractionReadyReferenceGroups,
  scoreWorklistIdentityWarningReferenceGroups,
  type ScoreWorklistRepairSampleClaim,
  type ScoreWorklistRepairSummary
} from "@/lib/score-worklist";
import type { Claim, NormalizedSourcePacketRow, Reference, Study } from "@/lib/types";
import {
  australiaRegulatoryStatuses,
  claims,
  interventions
} from "@/lib/seed-data";

export const dynamic = "force-dynamic";

async function signInWithGitHub() {
  "use server";

  await signIn("github", { redirectTo: "/operator" });
}

async function signOutOperator() {
  "use server";

  await signOut({ redirectTo: "/operator" });
}

async function reviewCandidateFromForm(formData: FormData) {
  "use server";

  const principal = await getCurrentOperatorPrincipal();

  if (!principal) {
    throw new Error("Operator authentication required.");
  }

  await reviewCandidateFromBrowserForm(principal, formData);
  revalidatePath("/operator");
}

async function linkCandidateClaimFromForm(formData: FormData) {
  "use server";

  const principal = await getCurrentOperatorPrincipal();

  if (!principal) {
    throw new Error("Operator authentication required.");
  }

  await linkCandidateClaimFromBrowserForm(principal, formData);
  revalidatePath("/operator");
}

async function extractCandidateStudyFromForm(formData: FormData) {
  "use server";

  const principal = await getCurrentOperatorPrincipal();

  if (!principal) {
    throw new Error("Operator authentication required.");
  }

  await extractCandidateStudyFromBrowserForm(principal, formData);
  revalidatePath("/operator");
}

async function promoteCandidateFromForm(formData: FormData) {
  "use server";

  const principal = await getCurrentOperatorPrincipal();

  if (!principal) {
    throw new Error("Operator authentication required.");
  }

  await promoteCandidateFromBrowserForm(principal, formData);
  revalidatePath("/operator");
}

async function recomputeClaimScoreFromForm(formData: FormData) {
  "use server";

  const principal = await getCurrentOperatorPrincipal();

  if (!principal) {
    throw new Error("Operator authentication required.");
  }

  await recomputeClaimScoreFromBrowserForm(principal, formData);
  revalidatePath("/operator");
}

async function updateClaimScoreFromForm(formData: FormData) {
  "use server";

  const principal = await getCurrentOperatorPrincipal();

  if (!principal) {
    throw new Error("Operator authentication required.");
  }

  await updateClaimScoreFromBrowserForm(principal, formData);
  revalidatePath("/operator");
}

async function saveOnboardingDraftFromForm(formData: FormData) {
  "use server";

  const principal = await getCurrentOperatorPrincipal();

  if (!principal) {
    throw new Error("Operator authentication required.");
  }

  await saveOnboardingDraftFromBrowserForm(principal, formData);
  revalidatePath("/operator");
}

async function importOnboardingDraftFromForm(formData: FormData) {
  "use server";

  const principal = await getCurrentOperatorPrincipal();

  if (!principal) {
    throw new Error("Operator authentication required.");
  }

  await importOnboardingDraftFromBrowserForm(principal, formData);
  revalidatePath("/operator");
}

export default async function OperatorPage() {
  const principal = await getCurrentOperatorPrincipal();

  if (!operatorAuthConfigured()) {
    return (
      <OperatorAccessState
        tone="blocked"
        title="Operator auth unavailable"
        detail="Database-backed GitHub operator auth is not configured for this deployment."
      />
    );
  }

  if (!principal) {
    return (
      <OperatorAccessState
        tone="blocked"
        title="Operator access required"
        detail="Use an authorized operator account for review workflows."
        action={
          <OperatorAuthButton action={signInWithGitHub} icon="in" label="Sign in with GitHub" />
        }
      />
    );
  }

  if (principal.status !== OperatorStatus.ACTIVE) {
    return (
      <OperatorAccessState
        tone="blocked"
        title="Operator access disabled"
        detail="This operator account is not active."
        action={<OperatorAuthButton action={signOutOperator} icon="out" label="Sign out" />}
      />
    );
  }

  const writesEnabled = operatorWritesEnabled();
  const canReadAudit = canOperatorAccess(principal.role, "audit:read");
  const canReviewCandidates = canOperatorAccess(principal.role, "candidate:review");
  const canImportOnboardingDraft = canOperatorAccess(principal.role, "onboarding:import");
  const canSaveOnboardingDraft = canOperatorAccess(principal.role, "onboarding:draft");
  const canReviewPromotion = canOperatorAccess(principal.role, "evidence:promote");
  const canManageOperators = canOperatorAccess(principal.role, "operator:manage");
  const candidateReviewControl = getOperatorBrowserWriteControlState(
    principal,
    "candidate-review"
  );
  const claimLinkControl = getOperatorBrowserWriteControlState(principal, "claim-link");
  const onboardingDraftControl = getOperatorBrowserWriteControlState(
    principal,
    "onboarding-draft"
  );
  const onboardingImportControl = getOperatorBrowserWriteControlState(
    principal,
    "onboarding-import"
  );
  const promotionControl = getOperatorBrowserWriteControlState(principal, "public-promotion");
  const studyExtractionControl = getOperatorBrowserWriteControlState(
    principal,
    "study-extraction"
  );
  const browserControlsEnabled =
    candidateReviewControl.enabled ||
    claimLinkControl.enabled ||
    onboardingDraftControl.enabled ||
    onboardingImportControl.enabled ||
    promotionControl.enabled ||
    studyExtractionControl.enabled;
  const reviewQueue = canReviewCandidates
    ? await getOperatorReviewQueueSnapshot(5)
    : { pendingCount: 0, rows: [] };
  const onboardingQuality = canReviewCandidates
    ? await getOperatorOnboardingQualitySnapshot(6)
    : undefined;
  const savedOnboardingDrafts = canSaveOnboardingDraft
    ? await getSupplementOnboardingDraftReviewSnapshot(5)
    : undefined;
  const guidedOnboardingWorkflow = onboardingQuality
    ? buildOperatorGuidedOnboardingWorkflowSnapshot({
        quality: onboardingQuality,
        savedDrafts: savedOnboardingDrafts
      })
    : undefined;
  const promotionReadiness = canReviewPromotion
    ? await getSourceCandidatePromotionReadinessSnapshot(5)
    : { blockedCount: 0, readyCount: 0, rows: [], total: 0 };
  const auditTrail = canReadAudit
    ? await getOperatorAuditTrailSnapshot(5)
    : { eventCount: 0, rows: [] };
  const scoreDashboardData = canReviewPromotion ? await getEvidenceDashboardData() : undefined;
  const scoreReadinessRows = scoreDashboardData ? buildScoreReadinessRows(scoreDashboardData) : [];
  const scoreReadinessSummary = buildScoreReadinessSummary(scoreReadinessRows);
  const scoreRepairSummary = buildScoreWorklistRepairSummary(scoreReadinessRows);
  const scoreIdentityPreview =
    scoreDashboardData?.dataSource === "database" &&
    scoreRepairSummary.identityWarningReferenceGroups > 0
      ? await buildScoreIdentityWarningActionPreview(scoreRepairSummary, {
          actionFilter: "actionable",
          referenceLimit: 50
        })
      : undefined;
  const scoreExtractionPreview =
    scoreDashboardData?.dataSource === "database" && scoreRepairSummary.extractionPendingRows > 0
      ? await buildScoreExtractionCandidatePreview(scoreRepairSummary, {
          referenceLimit: 8
        })
      : undefined;
  const scoreEditorRows = selectScoreReadinessEditorRows(scoreReadinessRows);
  const scoreSnapshotClaims = scoreEditorRows.map((row) => row.claim);
  const scoreEditorContext = Object.fromEntries(
    scoreEditorRows.map((row) => [
      row.claim.id,
      {
        nextAction: scoreReadinessNextAction(row),
        priorityLabel: row.priorityLabel,
        reasons: row.reasons,
        state: row.state,
        stateLabel: scoreReadinessStateLabel(row.state)
      }
    ])
  );
  const scoreSnapshotReferences = scoreDashboardData?.references ?? [];
  const scoreSnapshotSourcePackets = scoreDashboardData?.normalizedSourcePackets ?? [];
  const scoreSnapshotStudies = scoreDashboardData?.studies ?? [];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500">
              Operator
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">Review console</h1>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {principal.role}
          </span>
          <OperatorAuthButton action={signOutOperator} icon="out" label="Sign out" />
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          <OperatorStatusTile label="Review access" value={canReviewCandidates ? "Ready" : "No"} />
          <OperatorStatusTile label="Writes" value={writesEnabled ? "Enabled" : "Disabled"} />
          <OperatorStatusTile
            label="Promotion review"
            value={canReviewPromotion ? "Ready" : "No"}
          />
          <OperatorStatusTile
            label="Browser controls"
            value={browserControlsEnabled ? "Enabled" : "Locked"}
          />
          {canReadAudit ? <OperatorStatusTile label="Audit trail" value="Ready" /> : null}
          {canManageOperators ? (
            <OperatorStatusTile label="Operator admin" value="Ready" />
          ) : null}
        </div>

        {canSaveOnboardingDraft ? (
          <OperatorOnboardingWizard
            action={saveOnboardingDraftFromForm}
            existingSeedData={{
              australiaRegulatoryStatuses: australiaRegulatoryStatuses.map((status) => ({
                id: status.id
              })),
              claims: claims.map((claim) => ({ id: claim.id })),
              interventions: interventions.map((intervention) => ({ id: intervention.id }))
            }}
            saveBlockers={onboardingDraftControl.blockers}
            saveEnabled={onboardingDraftControl.enabled}
          />
        ) : null}

        {savedOnboardingDrafts ? (
          <SavedOnboardingDraftsPanel
            importAction={canImportOnboardingDraft ? importOnboardingDraftFromForm : undefined}
            importBlockers={onboardingImportControl.blockers}
            importEnabled={onboardingImportControl.enabled}
            snapshot={savedOnboardingDrafts}
          />
        ) : null}

        {guidedOnboardingWorkflow ? (
          <GuidedOnboardingWorkflowPanel snapshot={guidedOnboardingWorkflow} />
        ) : null}

        {onboardingQuality ? (
          <OnboardingMonitorPanel snapshot={onboardingQuality} />
        ) : null}

        {onboardingQuality ? (
          <OnboardingQualityPanel snapshot={onboardingQuality} />
        ) : null}

        {canReviewCandidates ? (
          <CandidateReviewQueuePanel
            candidateReviewControl={candidateReviewControl}
            reviewQueue={reviewQueue}
          />
        ) : null}

        {canReviewPromotion ? (
          <PromotionReadinessPanel
            claimLinkControl={claimLinkControl}
            promotionControl={promotionControl}
            snapshot={promotionReadiness}
            studyExtractionControl={studyExtractionControl}
          />
        ) : null}

        {canReviewPromotion ? (
          <ScoreSnapshotPanel
            claims={scoreSnapshotClaims}
            extractionPreview={scoreExtractionPreview}
            identityPreview={scoreIdentityPreview}
            promotionControl={promotionControl}
            references={scoreSnapshotReferences}
            repairSummary={scoreRepairSummary}
            recomputeAction={recomputeClaimScoreFromForm}
            sourcePackets={scoreSnapshotSourcePackets}
            studies={scoreSnapshotStudies}
            summary={scoreReadinessSummary}
            updateAction={updateClaimScoreFromForm}
            worklistContext={scoreEditorContext}
          />
        ) : null}

        {canReadAudit ? <AuditTrailPanel snapshot={auditTrail} /> : null}
      </section>
    </main>
  );
}

function GuidedOnboardingWorkflowPanel({
  snapshot
}: {
  snapshot: OperatorGuidedOnboardingWorkflowSnapshot;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Guided onboarding workflow</h2>
          <p className="mt-1 text-sm text-slate-600">{snapshot.nextAction}</p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          Read-only
        </span>
      </div>
      <div className="grid gap-0 border-b border-slate-100 text-sm md:grid-cols-6">
        <QualityMetric label="Steps" value={`${snapshot.summary.steps}`} />
        <QualityMetric label="Current" value={`${snapshot.summary.currentSteps}`} />
        <QualityMetric label="Blocked" value={`${snapshot.summary.blockedSteps}`} />
        <QualityMetric label="Ready" value={`${snapshot.summary.readySteps}`} />
        <QualityMetric label="Private drafts" value={`${snapshot.summary.privateDraftSteps}`} />
        <QualityMetric label="Batch kits" value={`${snapshot.summary.batchReviewKitSteps}`} />
      </div>
      <ol className="divide-y divide-slate-100">
        {snapshot.steps.length > 0 ? (
          snapshot.steps.slice(0, 6).map((step) => (
            <li className="px-4 py-4" key={step.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {step.label} / {step.target}
                  </p>
                  <h3 className="mt-1 max-w-3xl text-base font-semibold text-slate-950">
                    {step.action}
                  </h3>
                </div>
                <span className={workflowStatusClass(step.status)}>
                  {formatQualityState(step.status)}
                </span>
              </div>
              {step.command ? (
                <p className="mt-3 break-all text-sm text-slate-600">
                  Command: {step.command}
                </p>
              ) : null}
              {step.rationale.length > 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  Rationale: {step.rationale.slice(0, 2).join(" ")}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-slate-500">
                No auto-write: {step.noAutoWrite ? "true" : "false"} / No database write:{" "}
                {step.noDatabaseWrite ? "true" : "false"} / No candidate decision:{" "}
                {step.noCandidateDecision ? "true" : "false"} / No extraction write:{" "}
                {step.noExtractionWrite ? "true" : "false"} / No auto-promotion:{" "}
                {step.noAutoPromotion ? "true" : "false"}.
              </p>
            </li>
          ))
        ) : (
          <li className="px-4 py-6 text-sm text-slate-600">
            No onboarding workflow steps are visible for this operator role.
          </li>
        )}
      </ol>
    </section>
  );
}

function SavedOnboardingDraftsPanel({
  importAction,
  importBlockers,
  importEnabled = false,
  snapshot
}: {
  importAction?: (formData: FormData) => void | Promise<void>;
  importBlockers?: string[];
  importEnabled?: boolean;
  snapshot: SupplementOnboardingDraftReviewSnapshot;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Saved supplement drafts</h2>
          <p className="mt-1 text-sm text-slate-600">
            {snapshot.summary.drafts} private drafts loaded,{" "}
            {snapshot.summary.reviewRequired} need manual review,{" "}
            {snapshot.summary.blocked} blocked
          </p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          Read-only
        </span>
      </div>
      <div className="grid gap-0 border-b border-slate-100 text-sm md:grid-cols-4">
        <QualityMetric label="Private drafts" value={`${snapshot.summary.drafts}`} />
        <QualityMetric
          label="Manual review"
          value={`${snapshot.summary.reviewRequired}`}
        />
        <QualityMetric
          label="Manual seed copy"
          value={`${snapshot.summary.readyForManualSeedCopy}`}
        />
        <QualityMetric
          label="Database import"
          value={`${snapshot.summary.databaseImportReady} ready`}
        />
      </div>
      <div className="divide-y divide-slate-100">
        {snapshot.rows.length > 0 ? (
          snapshot.rows.map((row) => (
            <article className="px-4 py-4" key={row.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {row.draftStatus} / updated {row.updatedAt}
                  </p>
                  <h3 className="mt-1 max-w-3xl text-base font-semibold text-slate-950">
                    {row.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">{row.nextAction}</p>
                </div>
                <span className={importPlanStatusClass(row.importPlan.status)}>
                  {formatQualityState(row.importPlan.status)}
                </span>
              </div>
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p>
                  {row.claimCount} draft claims, {row.blockerCount} blockers,{" "}
                  {row.warningCount} warnings.
                </p>
                <p className="mt-2">
                  Seed copy: {formatQualityState(row.importPlan.seedCopy.status)} -{" "}
                  {row.importPlan.seedCopy.nextAction}
                </p>
                <p className="mt-2">
                  Database import: {formatQualityState(row.importPlan.databaseImport.status)};{" "}
                  supported now: {row.importPlan.databaseImport.supportedNow ? "true" : "false"}.
                </p>
                <p className="mt-2">
                  Operator import action:{" "}
                  {formatQualityState(row.databaseImportAction.status)}; permission:{" "}
                  {row.databaseImportAction.permission}; supported now:{" "}
                  {row.databaseImportAction.supportedNow ? "true" : "false"}.
                </p>
                <p className="mt-2">
                  Import preview: {row.databaseImportAction.importedRowPreview.interventions}{" "}
                  intervention, {row.databaseImportAction.importedRowPreview.claims} claims,{" "}
                  {row.databaseImportAction.importedRowPreview.australiaRegulatoryStatuses} AU/TGA
                  Unknown status.
                </p>
                <p className="mt-2">{row.databaseImportAction.publicVisibilityWarning}</p>
                {row.databaseImportAction.blockers.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {row.databaseImportAction.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                ) : null}
                {row.databaseImportAction.warnings.length > 0 ? (
                  <p className="mt-2">
                    Import warnings: {row.databaseImportAction.warnings.join(" ")}
                  </p>
                ) : null}
                <p className="mt-2">
                  No auto-write: {row.importPlan.noAutoWrite ? "true" : "false"} / No database
                  write: {row.importPlan.noDatabaseWrite ? "true" : "false"} / No public evidence
                  rows written: {row.importPlan.noPublicEvidenceRowsWritten ? "true" : "false"} /
                  No auto-promotion: {row.importPlan.noAutoPromotion ? "true" : "false"}.
                </p>
                <p className="mt-2">
                  Import safeguards: no claim review{" "}
                  {row.databaseImportAction.noClaimReview ? "true" : "false"} / no candidate
                  decision {row.databaseImportAction.noCandidateDecision ? "true" : "false"} /
                  no extraction write{" "}
                  {row.databaseImportAction.noExtractionWrite ? "true" : "false"} / no connector
                  approval {row.databaseImportAction.noConnectorApproval ? "true" : "false"} / no
                  full-text fetch {row.databaseImportAction.noFullTextFetch ? "true" : "false"} /
                  no auto-promotion {row.databaseImportAction.noAutoPromotion ? "true" : "false"}.
                </p>
              </div>
              {importAction ? (
                <form action={importAction} className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-white p-3">
                  <input name="draftId" type="hidden" value={row.id} />
                  <label className="text-sm font-medium text-slate-700" htmlFor={`import-note-${row.id}`}>
                    Import note
                  </label>
                  <textarea
                    className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                    id={`import-note-${row.id}`}
                    name="importNote"
                    placeholder="Record reviewed reason for database import."
                    required
                  />
                  {importEnabled ? null : (
                    <p className="text-sm text-slate-600">
                      Import locked: {(importBlockers ?? []).join(" ")}
                    </p>
                  )}
                  <button
                    className="w-fit rounded-md border border-slate-900 bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
                    disabled={
                      !importEnabled ||
                      !row.databaseImportAction.enabledWhenGateSatisfied
                    }
                    type="submit"
                  >
                    Import Draft
                  </button>
                </form>
              ) : null}
            </article>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-slate-600">
            No saved supplement drafts are visible for this operator role.
          </p>
        )}
      </div>
    </section>
  );
}

function OnboardingMonitorPanel({ snapshot }: { snapshot: OperatorOnboardingQualitySnapshot }) {
  const monitor = snapshot.monitor;

  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Post-onboarding monitor</h2>
          <p className="mt-1 text-sm text-slate-600">{monitor.nextAction}</p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          Read-only
        </span>
      </div>
      <div className="grid gap-0 border-b border-slate-100 text-sm md:grid-cols-6">
        <QualityMetric
          label="Action needed"
          value={`${monitor.summary.actionNeededSupplements}`}
        />
        <QualityMetric label="Watch" value={`${monitor.summary.watchSupplements}`} />
        <QualityMetric label="Ready" value={`${monitor.summary.readySupplements}`} />
        <QualityMetric
          label="Stale review"
          value={`${monitor.summary.staleReviewSupplements}`}
        />
        <QualityMetric
          label="Product status"
          value={`${
            monitor.summary.missingProductStatusSupplements +
            monitor.summary.unknownProductStatusSupplements
          }`}
        />
        <QualityMetric
          label="High attention"
          value={`${monitor.summary.highAttentionCadenceSupplements}`}
        />
      </div>
      {monitor.globalIssues.length > 0 ? (
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          {monitor.globalIssues.slice(0, 2).map((issue) => (
            <p className="break-words" key={issue.kind}>
              {issue.label}: {issue.detail} {issue.command ? `Command: ${issue.command}` : ""}
            </p>
          ))}
        </div>
      ) : null}
      <div className="divide-y divide-slate-100">
        {monitor.rows.length > 0 ? (
          monitor.rows.slice(0, 5).map((row) => (
            <article className="px-4 py-4" key={row.supplement.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {row.reviewAgeDays !== undefined
                      ? `Oldest review evidence: ${row.reviewAgeDays} days`
                      : "No review-age signal"}
                  </p>
                  <h3 className="mt-1 max-w-3xl text-base font-semibold text-slate-950">
                    {row.supplement.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">{row.nextAction}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Refresh policy: {formatQualityState(row.refreshPolicy.tier)},{" "}
                    {row.refreshPolicy.intervalDays} days.{" "}
                    {row.refreshPolicy.rationale.slice(0, 2).join(" ")}
                  </p>
                </div>
                <span className={monitorStatusClass(row.status)}>
                  {formatQualityState(row.status)}
                </span>
              </div>
              {row.issues.length > 0 ? (
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {row.issues.slice(0, 3).map((issue) => (
                    <div
                      className="rounded-md border border-slate-200 bg-slate-50 p-3"
                      key={`${row.supplement.id}-${issue.kind}`}
                    >
                      <p className="font-semibold text-slate-800">{issue.label}</p>
                      <p className="mt-1">{issue.detail}</p>
                      <p className="mt-1">{issue.nextAction}</p>
                      {issue.command ? (
                        <p className="mt-2 break-all text-slate-500">
                          {issue.command}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  No visible maintenance issue for this supplement.
                </p>
              )}
              <p className="mt-3 text-sm text-slate-500">
                No auto-write: {row.noAutoWrite ? "true" : "false"} / No candidate decision:{" "}
                {row.noCandidateDecision ? "true" : "false"} / No extraction write:{" "}
                {row.noExtractionWrite ? "true" : "false"} / No auto-review:{" "}
                {row.noAutoReview ? "true" : "false"} / No auto-promotion:{" "}
                {row.noAutoPromotion ? "true" : "false"}.
              </p>
            </article>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-slate-600">
            No supplements are visible for post-onboarding monitoring.
          </p>
        )}
      </div>
    </section>
  );
}

function OnboardingQualityPanel({ snapshot }: { snapshot: OperatorOnboardingQualitySnapshot }) {
  const topFullTextSource = snapshot.fullTextSources.reviewQueue[0];
  const fullTextFixtureCommands = snapshot.fullTextNextAction.commands.filter((command) =>
    [
      "check-fixture-progress",
      "validate-fixture-starter",
      "draft-fixture-extraction"
    ].includes(command.id)
  );

  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Onboarding quality</h2>
          <p className="mt-1 text-sm text-slate-600">
            {snapshot.summary.blockedSupplements} blocked,{" "}
            {snapshot.summary.warningSupplements} warning,{" "}
            {snapshot.summary.readySupplements} ready supplements loaded
          </p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          Read-only
        </span>
      </div>
      <div className="grid gap-0 border-b border-slate-100 text-sm md:grid-cols-6">
        <QualityMetric label="Claims reviewed" value={`${snapshot.summary.reviewedClaims}/${snapshot.summary.totalClaims}`} />
        <QualityMetric label="Candidates" value={`${snapshot.summary.candidates}`} />
        <QualityMetric label="Promotion ready" value={`${snapshot.summary.promotionReadyClaims}/${snapshot.summary.totalClaims}`} />
        <QualityMetric
          label="Batch progress"
          value={`${snapshot.summary.readySupplements + snapshot.summary.warningSupplements}/${snapshot.summary.supplements}`}
        />
        <QualityMetric
          label="Source tracking"
          value={snapshot.sourceTracking.status === "available" ? "Available" : "Unavailable"}
        />
        <QualityMetric
          label="Full-text gate"
          value={snapshot.fullTextSources.liveCaptureReady ? "Ready" : "Blocked"}
        />
      </div>
      <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
        Full-text source gate: {snapshot.fullTextSources.counts.blockedSources} blocked,{" "}
        {snapshot.fullTextSources.counts.dryRunSupportedSources} fixture-ready,{" "}
        {snapshot.fullTextSources.counts.liveApprovedSources} live-approved.{" "}
        {snapshot.fullTextSources.nextAction}
        {topFullTextSource ? (
          <span className="mt-2 block text-slate-700">
            Source review queue: {topFullTextSource.label} is{" "}
            {topFullTextSource.tier.replace(/-/g, " ")} at{" "}
            {topFullTextSource.convictionScore}/100 because{" "}
            {topFullTextSource.positiveFactors[0] ??
              "the source class has review metadata to inspect"}
            .
          </span>
        ) : null}
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-800">Source next step</p>
            <p className="mt-1">
              {snapshot.fullTextNextAction.status.replace(/-/g, " ")}
              {snapshot.fullTextNextAction.selectedSource
                ? ` / ${snapshot.fullTextNextAction.selectedSource.label}`
                : ""}
            </p>
            <p className="mt-1 text-slate-500">{snapshot.fullTextNextAction.nextAction}</p>
            {snapshot.fullTextNextAction.commands[0] ? (
              <p className="mt-2 break-all text-slate-500">
                {snapshot.fullTextNextAction.commands[0].command}
              </p>
            ) : null}
            {fullTextFixtureCommands.length > 0 ? (
              <div className="mt-3 space-y-1 text-slate-500">
                <p className="font-medium text-slate-700">Fixture follow-ups</p>
                {fullTextFixtureCommands.map((command) => (
                  <p className="break-all" key={command.id}>
                    {command.label}: {command.command}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-800">Full-text inventory progress</p>
            <p className="mt-1">
              {snapshot.fullTextProgress.summary.readyForConnectorReviewSources} ready,{" "}
              {snapshot.fullTextProgress.summary.inProgressSources} in progress,{" "}
              {snapshot.fullTextProgress.summary.prematureApprovalSources} premature approval,{" "}
              {snapshot.fullTextProgress.summary.notStartedSources} not started.
            </p>
            <p className="mt-1 text-slate-500">{snapshot.fullTextProgress.nextAction}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-800">Connector review draft</p>
            <p className="mt-1">
              {snapshot.fullTextConnectorReview.summary.readyForReviewSources} ready for review,{" "}
              {snapshot.fullTextConnectorReview.summary.blockedSources} blocked,{" "}
              {snapshot.fullTextConnectorReview.summary.holdSources} hold.
            </p>
            <p className="mt-1 text-slate-500">
              No connector approval:{" "}
              {snapshot.fullTextConnectorReview.noConnectorApproval ? "true" : "false"} / No live
              fetch: {snapshot.fullTextConnectorReview.noLiveFetch ? "true" : "false"}.
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-800">Connector approval packet</p>
            <p className="mt-1">
              {snapshot.fullTextConnectorApproval.summary.readyForApprovalSources} ready for
              approval, {snapshot.fullTextConnectorApproval.summary.blockedSources} blocked,{" "}
              {snapshot.fullTextConnectorApproval.summary.holdSources} hold.
            </p>
            <p className="mt-1 text-slate-500">
              Approval granted:{" "}
              {snapshot.fullTextConnectorApproval.approvalGranted ? "true" : "false"} / No
              implementation approval:{" "}
              {snapshot.fullTextConnectorApproval.noImplementationApproval
                ? "true"
                : "false"}
              .
            </p>
          </div>
        </div>
      </div>
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-normal text-slate-950">
              Priority queue
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {snapshot.priorityQueue.length} visible supplement actions, ordered by blockers,
              safety, candidates, warnings, extraction, and promotion readiness.
            </p>
          </div>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Operator-owned
          </span>
        </div>
        <ol className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
          {snapshot.priorityQueue.length > 0 ? (
            snapshot.priorityQueue.slice(0, 4).map((item, index) => (
              <li className="py-3" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {index + 1}. {formatQualityState(item.tier)}
                    </p>
                    <h4 className="mt-1 text-sm font-semibold text-slate-950">
                      {item.name}
                    </h4>
                  </div>
                  <span className={qualityStatusClass(item.status)}>
                    {item.status === "ready"
                      ? "Ready"
                      : item.status === "warning"
                        ? "Warning"
                        : "Blocked"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.action}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {item.claims} claims, {item.blockers} blockers, {item.warnings} warnings,{" "}
                  {item.safetySignals} safety signals, {item.pendingCandidates} pending candidates,{" "}
                  {item.promotionReadyClaims} promotion-ready claims.
                </p>
                {item.rationale.length > 0 ? (
                  <p className="mt-2 text-sm text-slate-600">
                    Rationale: {item.rationale.join(" ")}
                  </p>
                ) : null}
              </li>
            ))
          ) : (
            <li className="py-3 text-sm text-slate-600">
              No visible supplements need onboarding action.
            </li>
          )}
        </ol>
      </div>
      <div className="divide-y divide-slate-100">
        {snapshot.rows.length > 0 ? (
          snapshot.rows.map((row) => (
            <article className="px-4 py-4" key={row.supplement.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {row.supplement.category}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-950">
                    {row.supplement.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">
                    {row.counts.reviewedClaims}/{row.counts.claims} claims reviewed,{" "}
                    {row.counts.sourceCandidates} candidates,{" "}
                    {row.promotion.readyClaims}/{row.promotion.totalClaims} promotion-ready
                  </p>
                </div>
                <span className={qualityStatusClass(row.status)}>
                  {row.status === "ready" ? "Ready" : row.status === "warning" ? "Warning" : "Blocked"}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {[
                  `draft ${formatQualityState(row.states.draft)}`,
                  `queue ${formatQualityState(row.states.queue)}`,
                  `candidates ${formatQualityState(row.states.candidates)}`,
                  `extraction ${formatQualityState(row.states.extraction)}`,
                  `packet ${formatQualityState(row.states.reviewPacket)}`
                ].join(" / ")}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Conviction: {row.convictionDistribution.high} high,{" "}
                {row.convictionDistribution.moderate} moderate,{" "}
                {row.convictionDistribution.low} low,{" "}
                {row.convictionDistribution.veryLow} very low,{" "}
                {row.convictionDistribution.unscored} unscored
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Safety signals: {row.counts.safetySignals}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Review diff: {row.reviewPacketDiff.publicWordingChanges} wording,{" "}
                {row.reviewPacketDiff.scoreChanges} score,{" "}
                {row.reviewPacketDiff.uncertaintyLabelChanges} label,{" "}
                {row.reviewPacketDiff.referenceLinkChanges} reference changes
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Decision support: {row.reviewPacketDecision.readyForHumanReview} ready,{" "}
                {row.reviewPacketDecision.needsMoreEvidence} needs evidence,{" "}
                {row.reviewPacketDecision.holdOrReject} hold/reject
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Candidate review autopilot: {row.reviewPacketAutopilot.reviewPendingCandidate} pending,{" "}
                {row.reviewPacketAutopilot.summarizeLimitations} limitations,{" "}
                {row.reviewPacketAutopilot.blockedBySafety} safety blocked,{" "}
                {row.reviewPacketAutopilot.readyNoPendingCandidates} ready.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Autopilot next: {row.reviewPacketAutopilot.nextAction}
              </p>
              {row.reviewPacketAutopilot.recommendedCandidate ? (
                <p className="mt-2 break-all text-sm text-slate-600">
                  Recommended candidate:{" "}
                  {row.reviewPacketAutopilot.recommendedCandidate.title ??
                    row.reviewPacketAutopilot.recommendedCandidate.dedupeKey ??
                    "candidate pending review"}
                  {row.reviewPacketAutopilot.recommendedCandidate.score !== undefined
                    ? ` (${row.reviewPacketAutopilot.recommendedCandidate.score}/100)`
                    : ""}
                  {row.reviewPacketAutopilot.recommendedCandidate.curationDraftCommand
                    ? `. Draft: ${row.reviewPacketAutopilot.recommendedCandidate.curationDraftCommand}`
                    : ""}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-slate-500">
                No auto accept: {row.reviewPacketAutopilot.noAutoAccept ? "true" : "false"} / No
                auto reject: {row.reviewPacketAutopilot.noAutoReject ? "true" : "false"} / No
                auto extraction:{" "}
                {row.reviewPacketAutopilot.noAutoExtraction ? "true" : "false"} / No auto
                promotion: {row.reviewPacketAutopilot.noAutoPromotion ? "true" : "false"}.
              </p>
              {row.blockers.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {row.blockers.slice(0, 2).map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              ) : row.warnings.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {row.warnings.slice(0, 2).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-slate-600">
            No supplements are visible for onboarding quality review.
          </p>
        )}
      </div>
    </section>
  );
}

function QualityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-slate-100 px-4 py-3 md:border-r md:last:border-r-0">
      <p className="font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}

function qualityStatusClass(status: OperatorOnboardingQualitySnapshot["rows"][number]["status"]) {
  if (status === "ready") {
    return "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800";
  }

  if (status === "warning") {
    return "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900";
  }

  return "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800";
}

function importPlanStatusClass(status: SupplementOnboardingDraftReviewSnapshot["rows"][number]["importPlan"]["status"]) {
  if (status === "ready-for-manual-seed-copy") {
    return "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800";
  }

  if (status === "review-required") {
    return "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900";
  }

  return "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800";
}

function workflowStatusClass(status: OperatorGuidedOnboardingWorkflowSnapshot["steps"][number]["status"]) {
  if (status === "ready") {
    return "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800";
  }

  if (status === "current" || status === "waiting") {
    return "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900";
  }

  return "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800";
}

function monitorStatusClass(status: OperatorOnboardingQualitySnapshot["monitor"]["rows"][number]["status"]) {
  if (status === "ready") {
    return "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800";
  }

  if (status === "watch") {
    return "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900";
  }

  return "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800";
}

function formatQualityState(value: string) {
  return value.replace(/-/g, " ");
}

function OperatorAccessState({
  action,
  detail,
  title,
  tone
}: {
  action?: React.ReactNode;
  detail: string;
  title: string;
  tone: "blocked";
}) {
  const toneClass =
    tone === "blocked"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-white text-slate-900";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-8 text-slate-950">
      <section className={`w-full max-w-xl rounded-md border p-6 shadow-sm ${toneClass}`}>
        <div className="flex items-start gap-3">
          <ShieldX className="mt-1 h-5 w-5 flex-none" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
            <p className="mt-3 text-sm leading-6">{detail}</p>
            {action ? <div className="mt-5">{action}</div> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function OperatorAuthButton({
  action,
  icon,
  label
}: {
  action: () => Promise<void>;
  icon: "in" | "out";
  label: string;
}) {
  const Icon = icon === "in" ? LogIn : LogOut;

  return (
    <form action={action}>
      <button
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        type="submit"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}

function OperatorStatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}

function ScoreReadinessStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function PromotionReadinessPanel({
  claimLinkControl,
  promotionControl,
  snapshot,
  studyExtractionControl
}: {
  claimLinkControl: OperatorBrowserWriteControlState;
  promotionControl: OperatorBrowserWriteControlState;
  snapshot: SourceCandidatePromotionReadinessSnapshot;
  studyExtractionControl: OperatorBrowserWriteControlState;
}) {
  const anyPromotionWriteControl =
    claimLinkControl.enabled || promotionControl.enabled || studyExtractionControl.enabled;

  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Promotion readiness</h2>
          <p className="mt-1 text-sm text-slate-600">
            {snapshot.readyCount} ready and {snapshot.blockedCount} blocked accepted candidates loaded
          </p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          {anyPromotionWriteControl ? "Write-gated" : "Read-only"}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {snapshot.rows.length > 0 ? (
          snapshot.rows.map((row) => (
            <article className="px-4 py-4" key={row.candidate.dedupeKey}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {row.candidate.source} {row.candidate.externalId}
                  </p>
                  <h3 className="mt-1 max-w-3xl text-base font-semibold text-slate-950">
                    {row.candidate.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">{row.nextAction}</p>
                </div>
                <span
                  className={
                    row.ready
                      ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"
                      : "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
                  }
                >
                  {row.ready ? "Ready" : row.status}
                </span>
              </div>
              {row.blockers.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {row.blockers.slice(0, 3).map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p>{row.actionPreview.promotionEffect}</p>
                <p className="mt-2 break-all">
                  Dry run: {row.actionPreview.dryRunCommand}
                </p>
                <p className="mt-2">
                  Permission: {row.actionPreview.requiredPermission}
                </p>
                <p className="mt-2">
                  Extraction prefill: {row.extractionPrefill.sourceTextStatus}
                </p>
                <p className="mt-2">{row.extractionPrefill.fullTextStatus}</p>
                <p className="mt-2 break-all">
                  Curation draft: {row.extractionPrefill.curationDraftCommand}
                </p>
              </div>
              {anyPromotionWriteControl ? (
                <PromotionCurationControls
                  claimLinkControl={claimLinkControl}
                  promotionControl={promotionControl}
                  row={row}
                  studyExtractionControl={studyExtractionControl}
                />
              ) : null}
            </article>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-slate-600">
            No accepted candidates are visible for promotion review.
          </p>
        )}
      </div>
    </section>
  );
}

function CandidateReviewQueuePanel({
  candidateReviewControl,
  reviewQueue
}: {
  candidateReviewControl: OperatorBrowserWriteControlState;
  reviewQueue: {
    pendingCount: number;
    rows: OperatorReviewQueueRow[];
  };
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Candidate review queue</h2>
          <p className="mt-1 text-sm text-slate-600">
            {reviewQueue.pendingCount} pending candidates loaded
          </p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          {candidateReviewControl.enabled ? "Write-gated" : "Read-only"}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {reviewQueue.rows.length > 0 ? (
          reviewQueue.rows.map((candidate) => (
            <article className="px-4 py-4" key={candidate.dedupeKey}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">{candidate.source}</p>
                  <h3 className="mt-1 max-w-3xl text-base font-semibold text-slate-950">
                    {candidate.title}
                  </h3>
                </div>
                <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                  {candidate.triageScore}/100
                </span>
              </div>
              {candidate.curationStatus ? (
                <p className="mt-3 text-sm text-slate-700">{candidate.curationStatus}</p>
              ) : null}
              <p className="mt-3 text-sm text-slate-700">
                Autopilot priority: {candidate.autopilot.recommendation.replace(/-/g, " ")} /{" "}
                {candidate.autopilot.sourceConvictionScore}/100 /{" "}
                {candidate.autopilot.sourceReputationLabel.replace(/-/g, " ")}.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {candidate.autopilot.nextAction}
              </p>
              {candidate.autopilot.rationale.length > 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  Rationale: {candidate.autopilot.rationale.slice(0, 2).join(" ")}
                </p>
              ) : null}
              <p className="mt-2 break-all text-sm text-slate-500">
                Draft: {candidate.autopilot.curationDraftCommand}
              </p>
              <div className="mt-2 space-y-1 break-all text-sm text-slate-500">
                <p>Packet preview: {candidate.packetPreview.candidateReviewPacketCommand}</p>
                <p>Reference matches: {candidate.packetPreview.referenceMatchesCommand}</p>
                <p>Siblings: {candidate.packetPreview.siblingsCommand}</p>
                <p>Curation status: {candidate.packetPreview.curationStatusCommand}</p>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Preview read-only: {candidate.packetPreview.readOnly ? "true" : "false"} / No
                candidate decision:{" "}
                {candidate.packetPreview.noCandidateDecision ? "true" : "false"} / No extraction
                write: {candidate.packetPreview.noExtractionWrite ? "true" : "false"} / No
                promotion: {candidate.packetPreview.noPromotion ? "true" : "false"}.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                No auto accept: {candidate.autopilot.noAutoAccept ? "true" : "false"} / No
                auto reject: {candidate.autopilot.noAutoReject ? "true" : "false"} / No auto
                extraction: {candidate.autopilot.noAutoExtraction ? "true" : "false"} / No auto
                promotion: {candidate.autopilot.noAutoPromotion ? "true" : "false"}.
              </p>
              {candidateReviewControl.enabled ? (
                <CandidateReviewControls candidate={candidate} />
              ) : null}
            </article>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-slate-600">
            No pending candidates are visible for this operator role.
          </p>
        )}
      </div>
    </section>
  );
}

function ScoreSnapshotPanel({
  claims,
  extractionPreview,
  identityPreview,
  promotionControl,
  references,
  repairSummary,
  recomputeAction,
  sourcePackets,
  studies,
  summary,
  updateAction,
  worklistContext
}: {
  claims: Claim[];
  extractionPreview?: ScoreExtractionCandidatePreview;
  identityPreview?: ScoreIdentityWarningActionPreview;
  promotionControl: OperatorBrowserWriteControlState;
  references: Reference[];
  repairSummary: ScoreWorklistRepairSummary;
  recomputeAction: (formData: FormData) => void | Promise<void>;
  sourcePackets: NormalizedSourcePacketRow[];
  studies: Study[];
  summary: ScoreReadinessSummary;
  updateAction: (formData: FormData) => void | Promise<void>;
  worklistContext: Record<
    string,
    {
      nextAction: string;
      priorityLabel: string;
      reasons: string[];
      state: ClaimScoreWorklistContext["state"];
      stateLabel: string;
    }
  >;
}) {
  const claimReferences = buildClaimReferences(claims, references);

  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Score tools</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ready-first scoring pass: edit complete packets before source-blocked extraction work.
          </p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          {promotionControl.enabled ? "Write enabled" : "Locked"}
        </span>
      </div>

      <div className="space-y-2 px-4 py-4">
        <div className="grid gap-2 border-b border-slate-100 pb-4 text-sm md:grid-cols-5">
          <ScoreReadinessStat label="Loaded now" value={`${claims.length}`} />
          <ScoreReadinessStat label="Ready now" value={`${summary.readyToScore}`} />
          <ScoreReadinessStat
            label="Score review"
            value={`${summary.defaultLookingPublicScores}`}
          />
          <ScoreReadinessStat label="Source work" value={`${summary.sourceBlocked}`} />
          <ScoreReadinessStat label="Scored cells" value={`${summary.scoredPublicClaims}`} />
        </div>
        <ScoreSourceRepairQueue
          extractionPreview={extractionPreview}
          identityPreview={identityPreview}
          summary={repairSummary}
        />
        {claims.length > 0 ? (
          <form action={recomputeAction} className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Claim
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="claimId"
                required
              >
                <option value="">Select a claim</option>
                {claims.map((claim) => (
                  <option key={claim.id} value={claim.id}>
                    {worklistContext[claim.id]?.stateLabel ?? "Scored"} -{" "}
                    {claim.id} · {claim.outcome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Mode
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="mode"
                required
              >
                <option value="dry-run">Dry run</option>
                {promotionControl.enabled ? (
                  <option value="apply">Apply snapshot</option>
                ) : null}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Rationale
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="rationale"
                placeholder="Why is this snapshot being captured or recomputed?"
                required
              />
            </label>
            <button
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
              type="submit"
            >
              Run score snapshot action
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-600">No claims are available for score snapshot tools.</p>
        )}

        {claims.length > 0 ? (
          <OperatorClaimScoreEditor
            applyEnabled={promotionControl.enabled}
            claimReferences={claimReferences}
            claims={claims}
            sourcePackets={sourcePackets}
            studies={studies}
            updateAction={updateAction}
            worklistContext={worklistContext}
          />
        ) : null}

        {!promotionControl.enabled ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <p>Dry run is available to admin/owner operators. Apply actions require browser-write gates:</p>
            {promotionControl.blockers.map((blocker) => (
              <p key={blocker}>- {blocker}</p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ScoreSourceRepairQueue({
  extractionPreview,
  identityPreview,
  summary
}: {
  extractionPreview?: ScoreExtractionCandidatePreview;
  identityPreview?: ScoreIdentityWarningActionPreview;
  summary: ScoreWorklistRepairSummary;
}) {
  const extractionReadyGroups = scoreWorklistExtractionReadyReferenceGroups(summary);
  const identityWarningGroups = scoreWorklistIdentityWarningReferenceGroups(summary);

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">Source repair queue</h3>
          <p className="mt-1">
            Source-blocked scoring rows need extraction, source records, or curated links before
            they can become real scores.
          </p>
          <p className="mt-2 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900">
            Reference briefs are read-only: npx tsx scripts/local-score-worklist.ts
            --repair-reference &lt;reference-id&gt;
          </p>
          {summary.identityWarningReferenceGroups > 0 ? (
            <p className="mt-2 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900">
              Actionable identity preview: npx tsx scripts/local-score-worklist.ts --state
              source_blocked --repair-identity-action actionable --repair-identity-limit 50
              --limit 1
            </p>
          ) : null}
        </div>
        <span className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold">
          {summary.sourceBlockedRows} blocked
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <ScoreReadinessStat label="Extraction pending" value={`${summary.extractionPendingRows}`} />
        <ScoreReadinessStat
          label="Clean extraction refs"
          value={`${summary.extractionReadyReferenceGroups}`}
        />
        <ScoreReadinessStat
          label="Identity-check refs"
          value={`${summary.identityWarningReferenceGroups}`}
        />
        <ScoreReadinessStat label="Missing source records" value={`${summary.missingSourceRows}`} />
        <ScoreReadinessStat label="Unlinked claims" value={`${summary.unlinkedRows}`} />
        <ScoreReadinessStat
          label="Reference groups"
          value={`${summary.pendingReferenceGroups.length}`}
        />
      </div>
      {summary.pendingReferenceGroups.length > 0 ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-white px-2 py-1 text-xs leading-5 text-amber-900">
          Extraction lane: {summary.extractionReadyReferenceGroups} reference group(s) can move to
          structured extraction now; {summary.identityWarningReferenceGroups} should clear identity
          warnings first.
        </p>
      ) : null}
      {summary.blockerBreakdown.length > 0 ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-white p-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Blocker types
          </h4>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {summary.blockerBreakdown.slice(0, 6).map((blocker) => (
              <div
                className="rounded-md border border-amber-100 bg-amber-50/60 p-2"
                key={blocker.kind}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-950">{blocker.label}</p>
                  <span className="rounded-md border border-amber-200 bg-white px-2 py-0.5 text-xs font-semibold text-amber-900">
                    {blocker.claimCount}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-700">{blocker.nextAction}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {identityPreview ? <ScoreIdentityPreviewCard preview={identityPreview} /> : null}
      {extractionPreview ? <ScoreExtractionPreviewCard preview={extractionPreview} /> : null}
      {summary.sourceBlockedRows === 0 ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-emerald-950">
          No source-blocked scoring rows are visible in the current local catalog.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          <SourceRepairGroupList
            emptyText="No clean extraction-ready references."
            groups={extractionReadyGroups.slice(0, 3).map((group) => ({
              actionLabel: "Read-only brief command",
              actionText: `npx tsx scripts/local-score-worklist.ts --repair-reference ${group.reference.id}`,
              detail: `${group.claimCount} claim(s), ${group.interventions.length} intervention(s)`,
              gapText: formatSourceRepairGaps(group.extractionGaps),
              sampleClaims: group.sampleClaims,
              subtitle: group.reference.title,
              title: group.reference.label
            }))}
            title="Top extraction-ready references"
          />
          <SourceRepairGroupList
            emptyText="No identity-warning references."
            groups={identityWarningGroups.slice(0, 3).map((group) => ({
              actionLabel: "Identity cleanup preview",
              actionText:
                "npx tsx scripts/local-score-worklist.ts --state source_blocked --repair-identity-warnings --repair-identity-action actionable --limit 1",
              detail: `${group.claimCount} claim-link(s) blocked`,
              gapText: group.identityWarnings.join("; "),
              sampleClaims: group.sampleClaims,
              subtitle: group.reference.title,
              title: group.reference.label
            }))}
            title="Identity cleanup lane"
          />
          <SourceRepairGroupList
            emptyText="No missing source records."
            groups={summary.missingReferenceGroups.slice(0, 3).map((group) => ({
              actionLabel: "Next repair",
              actionText: `Restore or add source record ${group.referenceId}, then rerun the score worklist.`,
              detail: `${group.claimCount} claim(s) blocked`,
              sampleClaims: group.sampleClaims,
              subtitle: group.outcomes.slice(0, 3).join("; "),
              title: group.referenceId
            }))}
            title="Top missing source records"
          />
          <SourceRepairGroupList
            emptyText="No unlinked claim groups."
            groups={summary.unlinkedInterventionGroups.slice(0, 3).map((group) => ({
              actionLabel: "Next repair",
              actionText: `Curate claim references for ${group.intervention?.name ?? "this intervention"}, then rerun the score worklist.`,
              detail: `${group.claimCount} claim(s) need curated references`,
              sampleClaims: group.sampleClaims,
              subtitle: group.outcomes.slice(0, 3).join("; "),
              title: group.intervention?.name ?? "Unknown intervention"
            }))}
            title="Top unlinked claim groups"
          />
        </div>
      )}
    </div>
  );
}

function ScoreIdentityPreviewCard({
  preview
}: {
  preview: ScoreIdentityWarningActionPreview;
}) {
  const rows = preview.rows.slice(0, 5);

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-950">Actionable identity cleanup</h4>
          <p className="mt-1 text-xs leading-5 text-slate-700">
            Source-led, read-only preview for accepted candidates blocking score repair. Apply
            cleanup from Candidate Review identity resolver, then rerun the score worklist.
          </p>
        </div>
        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
          {rows.length}/{preview.uniqueMatches} listed
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
        <ScoreReadinessStat
          label="Warning refs scanned"
          value={`${preview.scannedWarningReferences}/${preview.totalWarningReferences}`}
        />
        <ScoreReadinessStat label="Accepted candidates" value={`${preview.acceptedCandidates}`} />
        <ScoreReadinessStat label="Raw actionable" value={`${preview.rawMatches}`} />
        <ScoreReadinessStat label="Filtered out" value={`${preview.hiddenByActionFilter}`} />
      </div>
      <p className="mt-2 break-words rounded-md border border-amber-100 bg-amber-50/60 px-2 py-1 text-xs leading-5 text-amber-900">
        Actions: {formatScoreIdentityActionCounts(preview.actionCounts)}
      </p>
      {rows.length > 0 ? (
        <div className="mt-3 divide-y divide-amber-100">
          {rows.map((row) => (
            <article
              className="grid gap-2 py-2 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]"
              key={`${row.dedupeKey}:${row.action}:${row.acceptedReferenceId ?? ""}:${row.matchedInterventionId ?? ""}`}
            >
              <div>
                <p className="break-words text-sm font-semibold text-slate-950">
                  {row.sourceLabel} {row.externalId} - triage {row.triageScore}
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-slate-600">{row.title}</p>
                <p className="mt-1 break-words text-xs leading-5 text-slate-700">
                  {row.interventionId ? `Intervention: ${row.interventionId}` : "No intervention"}{" "}
                  {row.claimId ? `- Claim: ${row.claimId}` : ""}
                </p>
              </div>
              <div>
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                  {row.actionLabel}
                </p>
                {row.reasons.length > 0 ? (
                  <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                    {row.reasons.slice(0, 2).join(" ")}
                  </p>
                ) : null}
                <p className="mt-1 break-words text-xs leading-5 text-slate-700">
                  <span className="font-semibold">Draft:</span> {row.draftCommand}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs leading-5 text-slate-600">
          No actionable candidate cleanup rows were found in the scanned warning references.
        </p>
      )}
    </div>
  );
}

function ScoreExtractionPreviewCard({
  preview
}: {
  preview: ScoreExtractionCandidatePreview;
}) {
  const references = preview.references.slice(0, 4);

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-950">Extraction candidate handoff</h4>
          <p className="mt-1 text-xs leading-5 text-slate-700">
            Accepted candidates attached to the highest-priority source-blocked references. Use
            the curation draft to verify source fields before any structured extraction write.
          </p>
        </div>
        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
          {references.length}/{preview.references.length} refs
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
        <ScoreReadinessStat
          label="Refs scanned"
          value={`${preview.scannedReferences}/${preview.totalPendingReferences}`}
        />
        <ScoreReadinessStat
          label="Accepted candidates"
          value={`${preview.acceptedCandidates}`}
        />
        <ScoreReadinessStat label="Scan limit" value={`${preview.referenceLimit}`} />
      </div>
      <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
        <ScoreReadinessStat label="Ready candidates" value={`${preview.readyCandidates}`} />
        <ScoreReadinessStat label="Blocked candidates" value={`${preview.blockedCandidates}`} />
      </div>
      <p className="mt-2 break-words rounded-md border border-amber-100 bg-amber-50/60 px-2 py-1 text-xs leading-5 text-amber-900">
        Blockers: {formatScoreExtractionBlockerCounts(preview.blockerCounts)}
      </p>
      {references.length > 0 ? (
        <div className="mt-3 divide-y divide-amber-100">
          {references.map((reference) => (
            <article className="py-3" key={reference.reference.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="break-words text-sm font-semibold text-slate-950">
                    {reference.reference.label}
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                    {reference.reference.title}
                  </p>
                </div>
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                  {reference.candidateCount} candidate(s)
                </span>
              </div>
              <p className="mt-2 break-words text-xs leading-5 text-slate-700">
                {reference.claimCount} claim(s), {reference.studyCount} extraction(s). Gaps:{" "}
                {reference.extractionGaps.join("; ") || "none listed"}
              </p>
              {reference.candidates.length > 0 ? (
                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  {reference.candidates.slice(0, 2).map((candidate) => (
                    <div
                      className="rounded-md border border-slate-200 bg-slate-50 p-2"
                      key={`${reference.reference.id}:${candidate.dedupeKey}:${candidate.claimId ?? ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="break-words text-xs font-semibold text-slate-950">
                          {candidate.sourceLabel} {candidate.externalId} - triage{" "}
                          {candidate.triageScore}
                        </p>
                        <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {candidate.extractionReady ? "ready" : "blocked"}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                        {candidate.title}
                      </p>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-700">
                        {candidate.nextAction}
                      </p>
                      {candidate.blockers.length > 0 ? (
                        <p className="mt-1 break-words text-xs leading-5 text-amber-900">
                          Blocked by: {candidate.blockers.map((blocker) => blocker.label).join("; ")}
                        </p>
                      ) : null}
                      <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                        {candidate.reviewStatus}; {candidate.sourceType};{" "}
                        {candidate.sourceTextStatus}
                      </p>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-700">
                        <span className="font-semibold">Study-type flag hint:</span>{" "}
                        {candidate.studySourceTypeFlagHint}; verify before writing extraction.
                      </p>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-700">
                        <span className="font-semibold">Draft:</span>{" "}
                        {candidate.curationDraftCommand}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs leading-5 text-slate-600">
                  No accepted source candidate is attached to this reference.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs leading-5 text-slate-600">
          No pending extraction references are visible in this score repair summary.
        </p>
      )}
    </div>
  );
}

function SourceRepairGroupList({
  emptyText,
  groups,
  title
}: {
  emptyText: string;
  groups: Array<{
    actionLabel: string;
    actionText: string;
    detail: string;
    gapText?: string;
    sampleClaims: ScoreWorklistRepairSampleClaim[];
    subtitle: string;
    title: string;
  }>;
  title: string;
}) {
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-800">{title}</h4>
      {groups.length > 0 ? (
        <div className="mt-2 divide-y divide-amber-200">
          {groups.map((group) => (
            <article className="py-2" key={group.title}>
              <p className="break-words text-sm font-semibold text-slate-900">{group.title}</p>
              <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                {group.subtitle || "No outcome summary available."}
              </p>
              <p className="mt-1 text-xs font-semibold text-amber-900">{group.detail}</p>
              {group.gapText ? (
                <p className="mt-1 break-words text-xs leading-5 text-amber-900">
                  Top gaps: {group.gapText}
                </p>
              ) : null}
              <p className="mt-1 break-words text-xs leading-5 text-slate-700">
                <span className="font-semibold">{group.actionLabel}:</span> {group.actionText}
              </p>
              {group.sampleClaims.length > 0 ? (
                <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                  Claims: {formatSourceRepairSamples(group.sampleClaims)}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-slate-600">{emptyText}</p>
      )}
    </section>
  );
}

function formatSourceRepairSamples(samples: ScoreWorklistRepairSampleClaim[]) {
  return samples
    .slice(0, 3)
    .map((sample) => `${sample.interventionName} / ${sample.outcome}`)
    .join("; ");
}

function formatSourceRepairGaps(gaps: Array<{ claimCount: number; gap: string }>) {
  if (gaps.length === 0) {
    return "";
  }

  return gaps
    .slice(0, 6)
    .map((gap) => `${gap.gap} (${gap.claimCount})`)
    .join("; ");
}

function buildClaimReferences(claims: Claim[], references: Reference[]) {
  const referencesById = new Map(references.map((reference) => [reference.id, reference]));
  const claimReferences: Record<string, Reference[]> = {};

  for (const claim of claims) {
    claimReferences[claim.id] = claim.keyReferenceIds
      .map((referenceId) => referencesById.get(referenceId))
      .filter((reference): reference is Reference => Boolean(reference));
  }

  return claimReferences;
}

function AuditTrailPanel({ snapshot }: { snapshot: OperatorAuditTrailSnapshot }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Audit trail</h2>
          <p className="mt-1 text-sm text-slate-600">
            {snapshot.eventCount} recent operator events loaded
          </p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          Read-only
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {snapshot.rows.length > 0 ? (
          snapshot.rows.map((event) => (
            <article className="px-4 py-4" key={event.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {event.actorRole} - {event.actorEmail}
                  </p>
                  <h3 className="mt-1 max-w-3xl text-base font-semibold text-slate-950">
                    {event.action}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">{event.target}</p>
                </div>
                <time
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                  dateTime={event.createdAt}
                >
                  {event.createdAt}
                </time>
              </div>
              {event.notePreview ? (
                <p className="mt-3 text-sm leading-6 text-slate-700">{event.notePreview}</p>
              ) : null}
            </article>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-slate-600">
            No operator audit events are visible yet.
          </p>
        )}
      </div>
    </section>
  );
}

function CandidateReviewControls({ candidate }: { candidate: OperatorReviewQueueRow }) {
  return (
    <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-2">
      <form action={reviewCandidateFromForm} className="space-y-3">
        <input name="dedupeKey" type="hidden" value={candidate.dedupeKey} />
        <label className="block text-sm font-semibold text-slate-700">
          Reference ID
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            name="acceptedReferenceId"
            placeholder="ref-pubmed-..."
            required
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Review note
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            name="reviewNote"
            required
          />
        </label>
        <button
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"
          name="decision"
          type="submit"
          value="Accepted"
        >
          Accept
        </button>
      </form>
      <form action={reviewCandidateFromForm} className="space-y-3">
        <input name="dedupeKey" type="hidden" value={candidate.dedupeKey} />
        <label className="block text-sm font-semibold text-slate-700">
          Rejection note
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            name="reviewNote"
            required
          />
        </label>
        <button
          className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800"
          name="decision"
          type="submit"
          value="Rejected"
        >
          Reject
        </button>
      </form>
    </div>
  );
}

function PromotionCurationControls({
  claimLinkControl,
  promotionControl,
  row,
  studyExtractionControl
}: {
  claimLinkControl: OperatorBrowserWriteControlState;
  promotionControl: OperatorBrowserWriteControlState;
  row: SourceCandidatePromotionReadinessSnapshot["rows"][number];
  studyExtractionControl: OperatorBrowserWriteControlState;
}) {
  const extractionSuggestion = (field: string) =>
    row.extractionPrefill.fieldSuggestions.find(
      (suggestion) => suggestion.field === field
    );

  return (
    <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-2">
      {claimLinkControl.enabled ? (
        <form action={linkCandidateClaimFromForm} className="space-y-3">
          <input name="dedupeKey" type="hidden" value={row.candidate.dedupeKey} />
          <label className="block text-sm font-semibold text-slate-700">
            Claim-link note
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              name="note"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Relevance
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              defaultValue="5"
              max="5"
              min="1"
              name="relevance"
              type="number"
            />
          </label>
          <button
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"
            type="submit"
          >
            Link Claim
          </button>
        </form>
      ) : null}

      {studyExtractionControl.enabled ? (
        <details className="rounded-md border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Extract Study
          </summary>
          <ExtractionPrefillPanel row={row} />
          <form action={extractCandidateStudyFromForm} className="mt-3 space-y-3">
            <input name="dedupeKey" type="hidden" value={row.candidate.dedupeKey} />
            <ExtractionInput
              label="Abstract/source summary"
              name="abstract"
              required={false}
              suggestion={extractionSuggestion("abstract")}
            />
            <ExtractionInput
              label="Population"
              name="population"
              suggestion={extractionSuggestion("population")}
            />
            <ExtractionInput
              label="Intervention"
              name="interventionName"
              suggestion={extractionSuggestion("interventionName")}
            />
            <ExtractionInput
              label="Sample size"
              name="sampleSize"
              suggestion={extractionSuggestion("sampleSize")}
            />
            <ExtractionInput
              label="Outcomes"
              name="outcomes"
              suggestion={extractionSuggestion("outcomes")}
            />
            <ExtractionInput
              label="Adverse events"
              name="adverseEvents"
              suggestion={extractionSuggestion("adverseEvents")}
            />
            <ExtractionInput
              label="Funding/conflicts"
              name="fundingConflicts"
              suggestion={extractionSuggestion("fundingConflicts")}
            />
            <ExtractionInput
              label="Risk of bias"
              name="riskOfBias"
              suggestion={extractionSuggestion("riskOfBias")}
            />
            <ExtractionInput label="Dose" name="dose" required={false} />
            <ExtractionInput
              label="Duration"
              name="duration"
              required={false}
              suggestion={extractionSuggestion("duration")}
            />
            <ExtractionInput
              label="Main results"
              name="mainResults"
              required={false}
              suggestion={extractionSuggestion("mainResults")}
            />
            <button
              className="rounded-md border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800"
              type="submit"
            >
              Save Extraction
            </button>
          </form>
        </details>
      ) : null}

      {promotionControl.enabled && row.ready ? (
        <form action={promoteCandidateFromForm} className="space-y-3">
          <input name="dedupeKey" type="hidden" value={row.candidate.dedupeKey} />
          <label className="block text-sm font-semibold text-slate-700">
            Promotion review note
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              name="promotionNote"
              required
            />
          </label>
          <button
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"
            type="submit"
          >
            Promote
          </button>
        </form>
      ) : null}
    </div>
  );
}

type ExtractionPrefillSuggestion =
  SourceCandidatePromotionReadinessSnapshot["rows"][number]["extractionPrefill"]["fieldSuggestions"][number];

function ExtractionPrefillPanel({
  row
}: {
  row: SourceCandidatePromotionReadinessSnapshot["rows"][number];
}) {
  const usefulSuggestions = row.extractionPrefill.fieldSuggestions.filter(
    (suggestion) => suggestion.confidence !== "manual-required"
  );

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
      <p className="font-semibold text-slate-800">Prefill suggestions</p>
      <p className="mt-1">{row.extractionPrefill.sourceTextStatus}</p>
      <p className="mt-1">{row.extractionPrefill.fullTextStatus}</p>
      {usefulSuggestions.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {usefulSuggestions.slice(0, 5).map((suggestion) => (
            <li key={suggestion.field}>
              <span className="font-medium">
                {suggestion.label} ({suggestion.confidenceLabel}):
              </span>{" "}
              <span>{suggestion.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ExtractionInput({
  label,
  name,
  required = true,
  suggestion
}: {
  label: string;
  name: string;
  required?: boolean;
  suggestion?: ExtractionPrefillSuggestion;
}) {
  const placeholder =
    suggestion && suggestion.confidence !== "manual-required"
      ? suggestion.value
      : undefined;

  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <textarea
        className="mt-1 min-h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        name={name}
        placeholder={placeholder}
        required={required}
      />
      {suggestion ? (
        <span className="mt-1 block text-xs font-normal text-slate-500">
          {suggestion.confidenceLabel} ({suggestion.confidence}):{" "}
          {suggestion.confidenceRationale} {suggestion.note}
        </span>
      ) : null}
    </label>
  );
}
