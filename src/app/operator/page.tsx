import { OperatorStatus } from "@prisma/client";
import { ShieldCheck, ShieldX } from "lucide-react";

import { canOperatorAccess, operatorWritesEnabled } from "@/lib/operator/authorization";
import { operatorAuthConfigured } from "@/lib/operator/config";
import { getCurrentOperatorPrincipal } from "@/lib/operator/session";

export const dynamic = "force-dynamic";

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
      />
    );
  }

  if (principal.status !== OperatorStatus.ACTIVE) {
    return (
      <OperatorAccessState
        tone="blocked"
        title="Operator access disabled"
        detail="This operator account is not active."
      />
    );
  }

  const writesEnabled = operatorWritesEnabled();
  const canReviewCandidates = canOperatorAccess(principal.role, "candidate:review");
  const canManageOperators = canOperatorAccess(principal.role, "operator:manage");

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
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          <OperatorStatusTile label="Review access" value={canReviewCandidates ? "Ready" : "No"} />
          <OperatorStatusTile label="Writes" value={writesEnabled ? "Enabled" : "Disabled"} />
          <OperatorStatusTile label="Operator admin" value={canManageOperators ? "Ready" : "No"} />
        </div>
      </section>
    </main>
  );
}

function OperatorAccessState({
  detail,
  title,
  tone
}: {
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
          </div>
        </div>
      </section>
    </main>
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
