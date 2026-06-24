import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import type { ClinicalTrialSearchResult } from "@/lib/integrations/clinical-trials";

const SMOKE_CLAIM_ID = "creatine-strength";
const SMOKE_INTERVENTION_ID = "creatine";
const SMOKE_NCT_ID = "NCT99999999";

interface TrialAlertPersistenceSmokeArgs {
  apply: boolean;
  enableWriteApproval: boolean;
  envFilePath?: string;
  target?: "local" | "preview";
}

interface TrialAlertPersistenceSmokeResult {
  alertIds: string[];
  apply: boolean;
  cleanedAuditRows: number;
  cleanedAlertRows: number;
  draftCount: number;
  executed: boolean;
  humanOwned: true;
  noAutoPromotion: true;
  readOnly: boolean;
  target: "dry-run" | "local" | "preview";
  verifiedRows: number;
  writeApprovalEnabled: boolean;
}

async function main() {
  const args = readTrialAlertPersistenceSmokeArgs(process.argv.slice(2));
  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  guardApplyTarget(args, env);

  await withProcessEnv(
    {
      ...env,
      ...(args.enableWriteApproval ? { APEX_OPERATOR_WRITES_ENABLED: "true" } : {})
    },
    async () => {
      const result = args.apply
        ? await runApplySmoke(args)
        : await runDryRunSmoke(args);

      console.log(JSON.stringify(result, null, 2));
    }
  );
}

async function runDryRunSmoke(
  args: TrialAlertPersistenceSmokeArgs
): Promise<TrialAlertPersistenceSmokeResult> {
  const { buildClinicalTrialAlertDrafts } = await import("@/lib/trial-alerts");
  const drafts = buildClinicalTrialAlertDrafts(trialAlertSmokeFixture(), {
    claimId: SMOKE_CLAIM_ID,
    detectedAt: smokeDetectedAt(),
    interventionId: SMOKE_INTERVENTION_ID
  });

  if (!drafts.every((draft) => draft.data.noAutoPromotion === true)) {
    throw new Error("Trial alert persistence smoke draft was not no-auto-promotion.");
  }

  return {
    alertIds: [],
    apply: false,
    cleanedAuditRows: 0,
    cleanedAlertRows: 0,
    draftCount: drafts.length,
    executed: false,
    humanOwned: true,
    noAutoPromotion: true,
    readOnly: true,
    target: args.target ?? "dry-run",
    verifiedRows: 0,
    writeApprovalEnabled: false
  };
}

async function runApplySmoke(
  args: TrialAlertPersistenceSmokeArgs
): Promise<TrialAlertPersistenceSmokeResult> {
  const { OperatorRole, OperatorStatus } = await import("@prisma/client");
  const { prisma } = await import("@/lib/db/prisma");
  const { recordTrialAlertsAsOperator } = await import("@/lib/operator/trial-alert-actions");
  const note = `Trial alert non-production persistence smoke ${new Date().toISOString()}`;
  const recorded = await recordTrialAlertsAsOperator(
    {
      email: "trial-alert-smoke@example.test",
      role: OperatorRole.ADMIN,
      status: OperatorStatus.ACTIVE,
      userId: ""
    },
    {
      claimId: SMOKE_CLAIM_ID,
      detectedAt: smokeDetectedAt(),
      interventionId: SMOKE_INTERVENTION_ID,
      note,
      result: trialAlertSmokeFixture(),
      reviewedAt: new Date()
    },
    {
      APEX_OPERATOR_WRITES_ENABLED: "true"
    }
  );
  const verifiedAlerts = await prisma.trialAlert.findMany({
    select: {
      id: true,
      noAutoPromotion: true,
      reviewerNotes: true,
      scoreHistoryId: true
    },
    where: {
      id: {
        in: recorded.alertIds
      }
    }
  });

  if (verifiedAlerts.length !== recorded.count) {
    throw new Error("Trial alert persistence smoke could not verify created alert rows.");
  }

  if (
    verifiedAlerts.some(
      (alert) =>
        !alert.noAutoPromotion || alert.scoreHistoryId !== null || alert.reviewerNotes !== note
    )
  ) {
    throw new Error("Trial alert persistence smoke verification failed.");
  }

  const cleanup = await prisma.trialAlert.deleteMany({
    where: {
      id: {
        in: recorded.alertIds
      }
    }
  });
  const auditCleanup = await prisma.operatorAuditEvent.deleteMany({
    where: {
      action: "trialAlert.record",
      actorEmail: "trial-alert-smoke@example.test",
      note: {
        startsWith: "Trial alert non-production persistence smoke"
      },
      targetType: "TrialAlert"
    }
  });

  return {
    alertIds: recorded.alertIds,
    apply: true,
    cleanedAuditRows: auditCleanup.count,
    cleanedAlertRows: cleanup.count,
    draftCount: recorded.count,
    executed: true,
    humanOwned: true,
    noAutoPromotion: recorded.noAutoPromotion,
    readOnly: false,
    target: args.target ?? "local",
    verifiedRows: verifiedAlerts.length,
    writeApprovalEnabled: true
  };
}

function readTrialAlertPersistenceSmokeArgs(args: string[]): TrialAlertPersistenceSmokeArgs {
  const parsed: TrialAlertPersistenceSmokeArgs = {
    apply: false,
    enableWriteApproval: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--apply") {
      parsed.apply = true;
      continue;
    }

    if (arg === "--enable-write-approval") {
      parsed.enableWriteApproval = true;
      continue;
    }

    if (arg === "--env-file") {
      const value = args[index + 1]?.trim();

      if (!value) {
        throw new Error("--env-file requires a path.");
      }

      parsed.envFilePath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      const value = arg.slice("--env-file=".length).trim();

      if (!value) {
        throw new Error("--env-file requires a path.");
      }

      parsed.envFilePath = value;
      continue;
    }

    if (arg === "--target") {
      const value = args[index + 1]?.trim();

      parsed.target = parseTarget(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--target=")) {
      parsed.target = parseTarget(arg.slice("--target=".length).trim());
      continue;
    }

    throw new Error(`Unknown trial alert persistence smoke argument: ${arg}`);
  }

  return parsed;
}

function parseTarget(value: string | undefined) {
  if (value === "local" || value === "preview") {
    return value;
  }

  throw new Error("--target must be local or preview.");
}

function guardApplyTarget(
  args: TrialAlertPersistenceSmokeArgs,
  env: Record<string, string | undefined>
) {
  if (!args.apply) {
    return;
  }

  if (!args.envFilePath) {
    throw new Error("--apply requires --env-file for a non-production database.");
  }

  if (!args.target) {
    throw new Error("--apply requires --target local or --target preview.");
  }

  if (!args.enableWriteApproval) {
    throw new Error("--apply requires --enable-write-approval.");
  }

  if (args.envFilePath.toLowerCase().includes("production")) {
    throw new Error("Refusing trial-alert persistence smoke against a production env file.");
  }

  if (env.VERCEL_ENV === "production" || env.APEX_ENVIRONMENT === "production") {
    throw new Error("Refusing trial-alert persistence smoke against production environment.");
  }
}

function trialAlertSmokeFixture(): ClinicalTrialSearchResult {
  return {
    query: "creatine",
    source: "ClinicalTrials.gov smoke fixture",
    studies: [
      {
        completionDate: "2026-01-01",
        conditions: ["Strength"],
        enrollment: "120 actual",
        enrollmentCount: 120,
        hasResults: true,
        interventions: ["DIETARY_SUPPLEMENT: Creatine"],
        lastUpdateDate: "2026-02-01",
        nctId: SMOKE_NCT_ID,
        phase: "Not applicable",
        primaryOutcomes: ["Strength"],
        resultsFirstPostDate: "2026-03-01",
        sponsor: "Example University",
        startDate: "2025-01-01",
        status: "Completed",
        studyType: "Interventional",
        title: "Creatine trial alert persistence smoke fixture",
        trialAlertDetail:
          "Posted registry results are an operator review alert only; this smoke must not change scores or promote evidence.",
        trialAlertLabel: "Results review needed",
        trialRelevanceDetail:
          "The query intervention appears in the registered intervention metadata.",
        trialRelevanceLabel: "Direct match",
        trialResultDetail: "Results are posted.",
        trialResultLabel: "Results posted",
        triageReasons: ["Results posted smoke fixture"],
        triageScore: 100,
        url: `https://clinicaltrials.gov/study/${SMOKE_NCT_ID}`
      }
    ]
  };
}

function smokeDetectedAt() {
  return new Date("2026-06-13T10:00:00.000Z");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
