import { OperatorStatus } from "@prisma/client";
import { LogIn, LogOut, ShieldCheck, ShieldX } from "lucide-react";

import { signIn, signOut } from "@/auth";
import { canOperatorAccess, operatorWritesEnabled } from "@/lib/operator/authorization";
import { operatorAuthConfigured } from "@/lib/operator/config";
import { getOperatorReviewQueueSnapshot } from "@/lib/operator/review-queue";
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
  const canReviewCandidates = canOperatorAccess(principal.role, "candidate:review");
  const canManageOperators = canOperatorAccess(principal.role, "operator:manage");
  const reviewQueue = canReviewCandidates
    ? await getOperatorReviewQueueSnapshot(5)
    : { pendingCount: 0, rows: [] };

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
          <OperatorStatusTile label="Operator admin" value={canManageOperators ? "Ready" : "No"} />
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
              Read-only
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
                </article>
              ))
            ) : (
              <p className="px-4 py-6 text-sm text-slate-600">
                No pending candidates are visible for this operator role.
              </p>
            )}
          </div>
        </section>
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
