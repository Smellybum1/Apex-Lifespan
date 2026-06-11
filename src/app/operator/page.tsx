import { OperatorStatus } from "@prisma/client";
import { LogIn, LogOut, ShieldCheck, ShieldX } from "lucide-react";
import { revalidatePath } from "next/cache";

import { signIn, signOut } from "@/auth";
import { canOperatorAccess, operatorWritesEnabled } from "@/lib/operator/authorization";
import {
  getOperatorAuditTrailSnapshot,
  type OperatorAuditTrailSnapshot
} from "@/lib/operator/audit-trail";
import {
  extractCandidateStudyFromBrowserForm,
  linkCandidateClaimFromBrowserForm,
  promoteCandidateFromBrowserForm,
  reviewCandidateFromBrowserForm
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
import { getCurrentOperatorPrincipal } from "@/lib/operator/session";

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
  const canReviewPromotion = canOperatorAccess(principal.role, "evidence:promote");
  const canManageOperators = canOperatorAccess(principal.role, "operator:manage");
  const candidateReviewControl = getOperatorBrowserWriteControlState(
    principal,
    "candidate-review"
  );
  const claimLinkControl = getOperatorBrowserWriteControlState(principal, "claim-link");
  const promotionControl = getOperatorBrowserWriteControlState(principal, "public-promotion");
  const studyExtractionControl = getOperatorBrowserWriteControlState(
    principal,
    "study-extraction"
  );
  const browserControlsEnabled =
    candidateReviewControl.enabled ||
    claimLinkControl.enabled ||
    promotionControl.enabled ||
    studyExtractionControl.enabled;
  const reviewQueue = canReviewCandidates
    ? await getOperatorReviewQueueSnapshot(5)
    : { pendingCount: 0, rows: [] };
  const promotionReadiness = canReviewPromotion
    ? await getSourceCandidatePromotionReadinessSnapshot(5)
    : { blockedCount: 0, readyCount: 0, rows: [], total: 0 };
  const auditTrail = canReadAudit
    ? await getOperatorAuditTrailSnapshot(5)
    : { eventCount: 0, rows: [] };

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

        {canReviewPromotion ? (
          <PromotionReadinessPanel
            claimLinkControl={claimLinkControl}
            promotionControl={promotionControl}
            snapshot={promotionReadiness}
            studyExtractionControl={studyExtractionControl}
          />
        ) : null}

        {canReadAudit ? <AuditTrailPanel snapshot={auditTrail} /> : null}
      </section>
    </main>
  );
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
          <form action={extractCandidateStudyFromForm} className="mt-3 space-y-3">
            <input name="dedupeKey" type="hidden" value={row.candidate.dedupeKey} />
            <ExtractionInput label="Population" name="population" />
            <ExtractionInput label="Intervention" name="interventionName" />
            <ExtractionInput label="Sample size" name="sampleSize" />
            <ExtractionInput label="Outcomes" name="outcomes" />
            <ExtractionInput label="Adverse events" name="adverseEvents" />
            <ExtractionInput label="Funding/conflicts" name="fundingConflicts" />
            <ExtractionInput label="Risk of bias" name="riskOfBias" />
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

function ExtractionInput({ label, name }: { label: string; name: string }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <textarea
        className="mt-1 min-h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        name={name}
        required
      />
    </label>
  );
}
