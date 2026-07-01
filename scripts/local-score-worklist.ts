import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import {
  previewLocalIdentityResolutionActionsForCandidates,
  type LocalIdentityResolutionAutomationDecisionReadout
} from "@/lib/data/local-ingestion-control";
import { prisma } from "@/lib/db/prisma";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import {
  buildScoreExtractionCandidatePreview,
  DEFAULT_SCORE_EXTRACTION_CANDIDATE_PREVIEW_LIMIT,
  formatScoreExtractionCandidatePreviewLines
} from "@/lib/score-extraction-preview";
import {
  buildScoreIdentityWarningActionPreview,
  DEFAULT_SCORE_IDENTITY_WARNING_ACTION_PREVIEW_LIMIT,
  formatScoreIdentityWarningActionPreviewLines,
  type ScoreIdentityActionFilter
} from "@/lib/score-identity-preview";
import {
  buildScoreWorklistReferenceRepairBrief,
  buildScoreWorklistReport,
  formatScoreWorklistReferenceRepairBriefLines,
  formatScoreWorklistReportLinesWithOptions,
  type ScoreWorklistStateFilter
} from "@/lib/score-worklist";

async function main() {
  const args = readScoreWorklistArgs(process.argv.slice(2));

  if (args.showHelp) {
    console.log(HELP_TEXT);
    return;
  }

  const env = mergeEnv(process.env, loadEnvFile(args.envFile).env);

  await withProcessEnv(env, async () => {
    const data = await getEvidenceDashboardData();

    if (args.repairReference) {
      const brief = buildScoreWorklistReferenceRepairBrief(data, args.repairReference, {
        limit: args.limit
      });

      if (args.json) {
        console.log(JSON.stringify(brief, null, 2));
        return;
      }

      const lines = formatScoreWorklistReferenceRepairBriefLines(brief);

      if (data.dataSource === "database") {
        lines.push("", ...(await formatAcceptedCandidateRepairHintLines(args.repairReference)));
      }

      console.log(lines.join("\n"));
      return;
    }

    const report = buildScoreWorklistReport(data, {
      includeScored: args.includeScored,
      intervention: args.intervention,
      limit: args.limit,
      state: args.state
    });
    const identityActionPreview =
      data.dataSource === "database" && args.repairSummary && args.repairIdentityWarnings
        ? await buildScoreIdentityWarningActionPreview(report.repairSummary, {
            actionFilter: args.repairIdentityAction,
            referenceLimit: args.repairIdentityLimit
          })
        : undefined;
    const extractionCandidatePreview =
      data.dataSource === "database" && args.repairSummary && args.repairExtractionCandidates
        ? await buildScoreExtractionCandidatePreview(report.repairSummary, {
            referenceLimit: args.repairExtractionLimit
          })
        : undefined;

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            ...report,
            ...(identityActionPreview ? { identityActionPreview } : {}),
            ...(extractionCandidatePreview ? { extractionCandidatePreview } : {})
          },
          null,
          2
        )
      );
      return;
    }

    const lines = formatScoreWorklistReportLinesWithOptions(report, {
      detail: args.detail,
      repairIdentityWarningsOnly: args.repairIdentityWarnings,
      repairSummary: args.repairSummary
    });

    if (data.dataSource === "database" && args.repairSummary && args.repairIdentityWarnings) {
      lines.push("", ...formatScoreIdentityWarningActionPreviewLines(identityActionPreview));
    }

    if (data.dataSource === "database" && args.repairSummary && args.repairExtractionCandidates) {
      lines.push("", ...formatScoreExtractionCandidatePreviewLines(extractionCandidatePreview));
    }

    console.log(lines.join("\n"));
  });
}

interface ScoreWorklistArgs {
  detail: boolean;
  envFile: string;
  includeScored: boolean;
  intervention?: string;
  json: boolean;
  limit: number;
  repairReference?: string;
  repairExtractionCandidates: boolean;
  repairExtractionLimit: number;
  repairIdentityAction: ScoreIdentityActionFilter;
  repairIdentityLimit: number;
  repairIdentityWarnings: boolean;
  repairSummary: boolean;
  showHelp?: false;
  state: ScoreWorklistStateFilter;
}

type ParsedScoreWorklistArgs =
  | ScoreWorklistArgs
  | {
      showHelp: true;
    };

const VALID_STATES: ScoreWorklistStateFilter[] = [
  "all",
  "default_score_review",
  "ready_to_score",
  "scored",
  "snapshot_gap",
  "source_blocked",
  "work"
];

const HELP_TEXT = `Usage: npx tsx scripts/local-score-worklist.ts [options]

Read-only local scoring run sheet. It ranks score-readiness rows, shows linked citations,
and includes conservative suggested scores for operator review. Default order puts
score-review and ready-to-score rows before source-blocked extraction work.

Options:
  --env-file <path>       Env file to load before reading local data. Default: .env.local
  --state <state>         all | work | ready_to_score | default_score_review | source_blocked | snapshot_gap | scored
  --intervention <query>  Filter by intervention id, slug, or name text.
  --limit <count>         Number of rows to show. Default: 12
  --include-scored        Include already-scored rows when state is not all.
  --detail                Print claim boundary and extracted study fields for scoring review.
  --repair-summary        Show grouped source repair targets for source-blocked rows.
  --repair-identity-warnings
                          Focus repair summary on references whose titles do not visibly match the target intervention.
  --repair-identity-action <action>
                          Filter identity preview rows: all | actionable | confirm-target | reassign-intervention | reject-wrong-supplement | hold | unavailable.
  --repair-identity-limit <count>
                          Number of identity-warning references to scan for preview actions. Default: 8
  --repair-extraction-candidates
                          Show accepted candidates attached to pending extraction references.
  --repair-extraction-limit <count>
                          Number of pending extraction references to scan for accepted candidates. Default: 8
  --repair-reference <id> Show a read-only extraction brief for one blocked reference id.
  --json                  Print JSON instead of text.
  --help                  Show this help.

This command does not write scores, review status, source packets, or public evidence.`;

const CANDIDATE_KEY_B64_PREFIX = "candidate-key-b64:";

async function formatAcceptedCandidateRepairHintLines(referenceId: string) {
  const candidates = await prisma.sourceCandidate.findMany({
    orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
    select: {
      claimId: true,
      dedupeKey: true,
      externalId: true,
      interventionId: true,
      reviewNote: true,
      reviewStatus: true,
      source: true,
      sourceType: true,
      title: true,
      triageScore: true
    },
    take: 8,
    where: {
      acceptedReferenceId: referenceId,
      decision: "ACCEPTED"
    }
  });
  const identityDecisions =
    candidates.length > 0
      ? await sourceLedIdentityDecisionByCandidateKey(
          candidates.map((candidate) => candidate.dedupeKey)
        )
      : new Map<string, LocalIdentityResolutionAutomationDecisionReadout>();

  const lines = [
    "Accepted candidate repair hints:",
    candidates.length === 0
      ? "No accepted source candidates currently point at this reference; repair from the source record directly."
      : `${candidates.length} accepted candidate(s) point at this reference. Use the curation draft to inspect captured metadata before identity cleanup or extraction.`
  ];

  lines.push(
    ...candidates.flatMap((candidate, index) => {
      const key = safeCandidateKey(candidate.dedupeKey);
      const identityDecision = identityDecisions.get(candidate.dedupeKey);
      const context = [
        candidate.interventionId ? `intervention ${candidate.interventionId}` : undefined,
        candidate.claimId ? `claim ${candidate.claimId}` : undefined
      ]
        .filter(Boolean)
        .join("; ");

      return [
        `${index + 1}. ${sourceKindLabel(candidate.source)} ${candidate.externalId} - triage ${candidate.triageScore}` +
          (candidate.sourceType ? ` / ${candidate.sourceType}` : ""),
        `   ${candidate.title}`,
        context ? `   Context: ${context}` : undefined,
        `   Identity preview: ${formatIdentityResolutionPreview(identityDecision)}`,
        ...(identityDecision ? formatIdentityResolutionReasons(identityDecision) : []),
        `   Draft: npm run ingest:sources -- --candidate-curation-draft ${key}`,
        candidate.reviewNote ? `   Review note: ${candidate.reviewNote}` : undefined
      ].filter((line): line is string => Boolean(line));
    })
  );

  return lines;
}

async function sourceLedIdentityDecisionByCandidateKey(dedupeKeys: string[]) {
  const decisions = await previewLocalIdentityResolutionActionsForCandidates({
    dedupeKeys,
    strategy: "source-led"
  });

  return new Map(decisions.map((decision) => [decision.dedupeKey, decision]));
}

function formatIdentityResolutionPreview(
  decision: LocalIdentityResolutionAutomationDecisionReadout | undefined
) {
  if (!decision) {
    return "identity preview unavailable; inspect the curation draft and source record before extraction.";
  }

  switch (decision.action) {
    case "confirm-target":
      return "source-led resolver would confirm the current supplement identity.";
    case "reassign-intervention":
      return `source-led resolver would reassign to ${decision.matchedInterventionName ?? decision.matchedInterventionId ?? "the matched intervention"}.`;
    case "reject-wrong-supplement":
      return "source-led resolver would reject this as the wrong supplement.";
    case "hold":
      return "source-led resolver would hold for manual identity review.";
  }
}

function formatIdentityResolutionReasons(
  decision: LocalIdentityResolutionAutomationDecisionReadout
) {
  return decision.reasons.slice(0, 3).map((reason) => `   Identity reason: ${reason}`);
}

function safeCandidateKey(dedupeKey: string) {
  return `${CANDIDATE_KEY_B64_PREFIX}${Buffer.from(dedupeKey, "utf8").toString("base64url")}`;
}

function sourceKindLabel(source: string) {
  switch (source) {
    case "PUBMED":
      return "PubMed";
    case "CLINICALTRIALS_GOV":
      return "ClinicalTrials.gov";
    default:
      return source
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
  }
}

function readScoreWorklistArgs(args: string[]): ParsedScoreWorklistArgs {
  const parsed: ScoreWorklistArgs = {
    detail: false,
    envFile: ".env.local",
    includeScored: false,
    json: false,
    limit: 12,
    repairExtractionCandidates: false,
    repairExtractionLimit: DEFAULT_SCORE_EXTRACTION_CANDIDATE_PREVIEW_LIMIT,
    repairIdentityAction: "all",
    repairIdentityLimit: DEFAULT_SCORE_IDENTITY_WARNING_ACTION_PREVIEW_LIMIT,
    repairIdentityWarnings: false,
    repairSummary: false,
    state: "work"
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

    if (arg === "--detail") {
      parsed.detail = true;
      continue;
    }

    if (arg === "--repair-summary") {
      parsed.repairSummary = true;
      continue;
    }

    if (arg === "--repair-identity-warnings") {
      parsed.repairIdentityWarnings = true;
      parsed.repairSummary = true;
      continue;
    }

    if (arg === "--repair-extraction-candidates") {
      parsed.repairExtractionCandidates = true;
      parsed.repairSummary = true;
      continue;
    }

    if (arg === "--repair-identity-action") {
      parsed.repairIdentityAction = identityActionFilterValue(
        requiredNextValue(args, index, "--repair-identity-action")
      );
      parsed.repairIdentityWarnings = true;
      parsed.repairSummary = true;
      index += 1;
      continue;
    }

    if (arg.startsWith("--repair-identity-action=")) {
      parsed.repairIdentityAction = identityActionFilterValue(
        requiredInlineValue(arg, "--repair-identity-action")
      );
      parsed.repairIdentityWarnings = true;
      parsed.repairSummary = true;
      continue;
    }

    if (arg === "--repair-identity-limit") {
      parsed.repairIdentityLimit = positiveInteger(
        requiredNextValue(args, index, "--repair-identity-limit"),
        "--repair-identity-limit"
      );
      parsed.repairIdentityWarnings = true;
      parsed.repairSummary = true;
      index += 1;
      continue;
    }

    if (arg.startsWith("--repair-identity-limit=")) {
      parsed.repairIdentityLimit = positiveInteger(
        requiredInlineValue(arg, "--repair-identity-limit"),
        "--repair-identity-limit"
      );
      parsed.repairIdentityWarnings = true;
      parsed.repairSummary = true;
      continue;
    }

    if (arg === "--repair-extraction-limit") {
      parsed.repairExtractionLimit = positiveInteger(
        requiredNextValue(args, index, "--repair-extraction-limit"),
        "--repair-extraction-limit"
      );
      parsed.repairExtractionCandidates = true;
      parsed.repairSummary = true;
      index += 1;
      continue;
    }

    if (arg.startsWith("--repair-extraction-limit=")) {
      parsed.repairExtractionLimit = positiveInteger(
        requiredInlineValue(arg, "--repair-extraction-limit"),
        "--repair-extraction-limit"
      );
      parsed.repairExtractionCandidates = true;
      parsed.repairSummary = true;
      continue;
    }

    if (arg === "--repair-reference") {
      parsed.repairReference = requiredNextValue(args, index, "--repair-reference");
      index += 1;
      continue;
    }

    if (arg.startsWith("--repair-reference=")) {
      parsed.repairReference = requiredInlineValue(arg, "--repair-reference");
      continue;
    }

    if (arg === "--include-scored") {
      parsed.includeScored = true;
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

    if (arg === "--state") {
      parsed.state = scoreWorklistState(requiredNextValue(args, index, "--state"));
      index += 1;
      continue;
    }

    if (arg.startsWith("--state=")) {
      parsed.state = scoreWorklistState(requiredInlineValue(arg, "--state"));
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

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
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

function scoreWorklistState(value: string): ScoreWorklistStateFilter {
  if (VALID_STATES.includes(value as ScoreWorklistStateFilter)) {
    return value as ScoreWorklistStateFilter;
  }

  throw new Error(`Unsupported --state value: ${value}.`);
}

function identityActionFilterValue(value: string): ScoreIdentityActionFilter {
  switch (value.trim().toLowerCase()) {
    case "all":
      return "all";
    case "actionable":
      return "actionable";
    case "confirm":
    case "confirm-target":
      return "confirm-target";
    case "reassign":
    case "reassign-intervention":
      return "reassign-intervention";
    case "reject":
    case "reject-wrong-supplement":
      return "reject-wrong-supplement";
    case "hold":
      return "hold";
    case "unavailable":
      return "unavailable";
    default:
      throw new Error(`Unsupported --repair-identity-action value: ${value}.`);
  }
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
