import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { dryRunUpdateClaimScore } from "@/lib/data/score-update";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import {
  buildScoreWorklistReport,
  type ScoreWorklistRow,
  type ScoreWorklistStateFilter
} from "@/lib/score-worklist";
import { buildScoreUpdateDraft } from "@/lib/score-update-draft";

async function main() {
  const args = readScoreDraftArgs(process.argv.slice(2));

  if (args.showHelp) {
    console.log(HELP_TEXT);
    return;
  }

  const env = mergeEnv(process.env, loadEnvFile(args.envFile).env);

  await withProcessEnv(env, async () => {
    const data = await getEvidenceDashboardData();
    const report = buildScoreWorklistReport(data, {
      includeScored: true,
      intervention: args.intervention,
      limit: Math.max(data.claims.length, 1),
      state: args.claimId ? "all" : args.state
    });
    const rows = selectScoreDraftRows(report.rows, args);
    const drafts = await Promise.all(rows.map(scoreDraftResult));

    if (args.json) {
      console.log(
        JSON.stringify(
          args.limit === 1
            ? drafts[0]
            : {
                drafts,
                totalDrafts: drafts.length
              },
          null,
          2
        )
      );
      return;
    }

    console.log(formatScoreDraftOutput(drafts).join("\n"));
  });
}

interface ScoreDraftArgs {
  claimId?: string;
  envFile: string;
  intervention?: string;
  json: boolean;
  limit: number;
  showHelp?: false;
  state: ScoreWorklistStateFilter;
}

type ParsedScoreDraftArgs =
  | ScoreDraftArgs
  | {
      showHelp: true;
    };

const VALID_STATES: ScoreWorklistStateFilter[] = [
  "default_score_review",
  "ready_to_score",
  "work"
];

const HELP_TEXT = `Usage: npx tsx scripts/local-score-draft.ts [options]

Build a read-only score-update dry run from the local score worklist suggestion.
Defaults to the first ready-to-score row. This command does not write scores,
review status, source packets, or public evidence.

Options:
  --env-file <path>       Env file to load before reading local data. Default: .env.local
  --claim <claim-id>      Draft a score update for a specific claim.
  --intervention <query>  Filter by intervention id, slug, or name text.
  --limit <count>         Number of matching rows to draft when --claim is omitted. Default: 1
  --state <state>         ready_to_score | default_score_review | work. Default: ready_to_score
  --json                  Print JSON with dry-run and form fields.
  --help                  Show this help.`;

function readScoreDraftArgs(args: string[]): ParsedScoreDraftArgs {
  const parsed: ScoreDraftArgs = {
    envFile: ".env.local",
    json: false,
    limit: 1,
    state: "ready_to_score"
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help") {
      return { showHelp: true };
    }

    if (arg === "--json") {
      parsed.json = true;
      continue;
    }

    if (arg === "--env-file") {
      parsed.envFile = requiredNextValue(args, index, "--env-file");
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      parsed.envFile = requiredInlineValue(arg, "--env-file");
      continue;
    }

    if (arg === "--claim") {
      parsed.claimId = requiredNextValue(args, index, "--claim");
      index += 1;
      continue;
    }

    if (arg.startsWith("--claim=")) {
      parsed.claimId = requiredInlineValue(arg, "--claim");
      continue;
    }

    if (arg === "--intervention") {
      parsed.intervention = requiredNextValue(args, index, "--intervention");
      index += 1;
      continue;
    }

    if (arg.startsWith("--intervention=")) {
      parsed.intervention = requiredInlineValue(arg, "--intervention");
      continue;
    }

    if (arg === "--limit") {
      parsed.limit = positiveInteger(requiredNextValue(args, index, "--limit"), "--limit");
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      parsed.limit = positiveInteger(requiredInlineValue(arg, "--limit"), "--limit");
      continue;
    }

    if (arg === "--state") {
      parsed.state = scoreDraftState(requiredNextValue(args, index, "--state"));
      index += 1;
      continue;
    }

    if (arg.startsWith("--state=")) {
      parsed.state = scoreDraftState(requiredInlineValue(arg, "--state"));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function selectScoreDraftRows(rows: ScoreWorklistRow[], args: ScoreDraftArgs) {
  const selectedRows = args.claimId
    ? rows.filter((item) => item.claimId === args.claimId)
    : rows.slice(0, args.limit);

  if (selectedRows.length === 0) {
    throw new Error("No score worklist row matched the current filters.");
  }

  return selectedRows;
}

async function scoreDraftResult(row: ScoreWorklistRow) {
  const draft = buildScoreUpdateDraft(row);
  const dryRun = await dryRunUpdateClaimScore({
    claimId: draft.claimId,
    finalLabel: draft.finalLabel,
    rationale: draft.rationale,
    scores: draft.scores
  });

  return {
    changes: draft.changes,
    dryRun,
    formFields: draft.formFields,
    row: {
      claim: row.claim,
      claimId: row.claimId,
      currentScoreLabel: row.currentScoreLabel,
      intervention: row.intervention,
      outcome: row.outcome,
      references: row.references,
      sourcePacket: row.sourcePacket,
      state: row.state,
      stateLabel: row.stateLabel,
      suggestion: row.suggestion
    }
  };
}

function formatScoreDraftOutput(
  drafts: Awaited<ReturnType<typeof scoreDraftResult>>[]
) {
  if (drafts.length === 1) {
    return formatScoreDraftLines(drafts[0]!);
  }

  return [
    "Read-only local score draft batch",
    `Drafts: ${drafts.length}`,
    "This command did not write scores, review status, source packets, or public evidence.",
    "",
    ...drafts.flatMap((draft, index) => [
      `${index + 1}. ${draft.row.intervention?.name ?? "Unknown intervention"} / ${draft.row.outcome} (${draft.row.claimId})`,
      `   Current: ${draft.row.currentScoreLabel}`,
      `   Suggested: ${draft.row.suggestion.compositeScoreLabel}; ${draft.row.suggestion.finalLabel}`,
      `   Changes: ${formatScoreDraftChanges(draft.changes)}`,
      `   Dry-run would update claim: ${draft.dryRun.wouldUpdateClaim}; snapshot: ${draft.dryRun.wouldCreateSnapshot}; history: ${draft.dryRun.wouldCreateHistory}`,
      `   Citations: ${
        draft.row.references.length > 0
          ? draft.row.references.map((reference) => reference.label).join("; ")
          : "none linked"
      }`,
      `   Full form fields: rerun with --claim ${draft.row.claimId}`
    ])
  ];
}

function formatScoreDraftLines({
  dryRun,
  formFields,
  row,
  changes
}: {
  changes: Awaited<ReturnType<typeof scoreDraftResult>>["changes"];
  dryRun: Awaited<ReturnType<typeof dryRunUpdateClaimScore>>;
  formFields: Record<string, string>;
  row: {
    claimId: string;
    currentScoreLabel: string;
    intervention: ScoreWorklistRow["intervention"];
    outcome: string;
    suggestion: ScoreWorklistRow["suggestion"];
  };
}) {
  return [
    "Read-only local score draft",
    `${row.intervention?.name ?? "Unknown intervention"} / ${row.outcome} (${row.claimId})`,
    `Current: ${row.currentScoreLabel}`,
    `Suggested: ${row.suggestion.compositeScoreLabel}; ${row.suggestion.finalLabel}`,
    `Changes: ${formatScoreDraftChanges(changes)}`,
    `Dry-run would update claim: ${dryRun.wouldUpdateClaim}`,
    `Dry-run would create snapshot: ${dryRun.wouldCreateSnapshot}`,
    `Dry-run would create history: ${dryRun.wouldCreateHistory}`,
    "",
    "Operator form fields:",
    ...Object.entries(formFields).map(([key, value]) => `- ${key}: ${value}`)
  ];
}

function formatScoreDraftChanges(changes: Awaited<ReturnType<typeof scoreDraftResult>>["changes"]) {
  const fieldChanges = changes.scoreFields.map(
    (change) => `${change.label} ${change.saved}->${change.draft}`
  );
  const labelChange = changes.finalLabel
    ? [`Label ${changes.finalLabel.saved}->${changes.finalLabel.draft}`]
    : [];
  const parts = [...fieldChanges, ...labelChange];

  return parts.length > 0 ? parts.join("; ") : "none";
}

function scoreDraftState(value: string): ScoreWorklistStateFilter {
  if (VALID_STATES.includes(value as ScoreWorklistStateFilter)) {
    return value as ScoreWorklistStateFilter;
  }

  throw new Error(`Unsupported --state value: ${value}.`);
}

function requiredNextValue(args: string[], index: number, option: string) {
  const value = args[index + 1]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function requiredInlineValue(arg: string, option: string) {
  const value = arg.slice(`${option}=`.length).trim();

  if (!value) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function positiveInteger(value: string, option: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${option} must be a positive integer.`);
  }

  return parsed;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
