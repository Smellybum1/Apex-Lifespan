import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import type {
  EvidenceImpactPipelineAction,
  EvidenceImpactPipelineResult,
  EvidenceImpactPipelineUpstreamLead
} from "@/lib/operator/evidence-impact-pipeline";

async function main() {
  const args = readEvidenceImpactPipelineArgs(process.argv.slice(2));
  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const { runEvidenceImpactPipeline } = await import(
      "@/lib/operator/evidence-impact-pipeline"
    );
    const result = await runEvidenceImpactPipeline({
      actorEmail: args.actorEmail,
      forcePromote: args.forcePromote,
      fixture: args.fixtureReady ? "ready-public-promotion" : undefined,
      limit: args.limit,
      upstreamLimit: args.upstreamLimit,
      write: args.write
    });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatResult(result));
  });
}

interface EvidenceImpactPipelineCliArgs {
  actorEmail?: string;
  envFilePath?: string;
  forcePromote: boolean;
  fixtureReady: boolean;
  json: boolean;
  limit: number;
  upstreamLimit: number;
  write: boolean;
}

function readEvidenceImpactPipelineArgs(args: string[]): EvidenceImpactPipelineCliArgs {
  const parsed: EvidenceImpactPipelineCliArgs = {
    forcePromote: false,
    fixtureReady: false,
    json: false,
    limit: 25,
    upstreamLimit: 3,
    write: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--write") {
      parsed.write = true;
      continue;
    }

    if (arg === "--json") {
      parsed.json = true;
      continue;
    }

    if (arg === "--force-promote") {
      parsed.forcePromote = true;
      continue;
    }

    if (arg === "--fixture-ready") {
      parsed.fixtureReady = true;
      continue;
    }

    if (arg === "--actor-email") {
      parsed.actorEmail = requireValue(args[index + 1], "--actor-email");
      index += 1;
      continue;
    }

    if (arg.startsWith("--actor-email=")) {
      parsed.actorEmail = requireValue(
        arg.slice("--actor-email=".length),
        "--actor-email"
      );
      continue;
    }

    if (arg === "--env-file") {
      parsed.envFilePath = requireValue(args[index + 1], "--env-file");
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      parsed.envFilePath = requireValue(arg.slice("--env-file=".length), "--env-file");
      continue;
    }

    if (arg === "--limit") {
      parsed.limit = parseLimit(args[index + 1], "--limit");
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      parsed.limit = parseLimit(arg.slice("--limit=".length), "--limit");
      continue;
    }

    if (arg === "--upstream-limit") {
      parsed.upstreamLimit = parseLimit(args[index + 1], "--upstream-limit");
      index += 1;
      continue;
    }

    if (arg.startsWith("--upstream-limit=")) {
      parsed.upstreamLimit = parseLimit(
        arg.slice("--upstream-limit=".length),
        "--upstream-limit"
      );
      continue;
    }

    throw new Error(`Unknown evidence impact pipeline argument: ${arg}`);
  }

  return parsed;
}

function formatResult(result: EvidenceImpactPipelineResult) {
  const lines = [
    `Evidence impact pipeline ${result.dryRun ? "dry run" : "write run"}`,
    `Scanned ${result.summary.scanned}; would apply ${result.summary.wouldApply}; applied ${result.summary.applied}; skipped ${result.summary.skipped}; blocked ${result.summary.blocked}; upstream leads ${result.summary.upstreamLeads}.`
  ];

  if (result.principal) {
    lines.push(`Operator: ${result.principal.email} (${result.principal.role}).`);
  }

  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  appendSection(lines, "Would apply", result.wouldApply);
  appendSection(lines, "Applied", result.applied);
  appendSection(lines, "Skipped", result.skipped);
  appendSection(lines, "Blocked", result.blocked);
  appendUpstreamLeadsSection(lines, result.upstreamLeads);

  if (result.dryRun && result.wouldApply.length > 0) {
    lines.push("");
    lines.push("Run with --write to apply the listed AI-reviewed local impact steps.");
  }

  return lines.join("\n");
}

function appendSection(
  lines: string[],
  label: string,
  actions: EvidenceImpactPipelineAction[]
) {
  if (actions.length === 0) {
    return;
  }

  lines.push("");
  lines.push(`${label}:`);

  for (const action of actions) {
    lines.push(
      `- ${action.kind}: ${action.source} ${action.externalId} -> ${action.claimId ?? "no claim"} (${action.reason})`
    );

    if (action.blockers.length > 0) {
      lines.push(`  blockers: ${action.blockers.join("; ")}`);
    }

    if (action.command) {
      lines.push(`  next: ${action.command}`);
    }

    appendWritePreview(lines, action);
  }
}

function appendWritePreview(
  lines: string[],
  action: EvidenceImpactPipelineAction
) {
  const preview = action.writePreview;

  lines.push(`  transactionality: ${preview.transactionality}`);
  lines.push(
    `  write scope: ${preview.writeScope.length > 0 ? preview.writeScope.join("; ") : "none"}`
  );
  lines.push(`  verify: ${preview.verification.slice(0, 3).join("; ")}`);
  lines.push(`  rollback: ${preview.rollbackNotes.slice(0, 2).join("; ")}`);

  if (preview.approvalRequest) {
    lines.push(`  approval: ${preview.approvalRequest.approvalPhrase}`);
    lines.push(`  approval command: ${preview.approvalRequest.command}`);
    lines.push(
      `  approval permissions: ${preview.approvalRequest.requiredOperatorPermissions.join("; ")}`
    );
    lines.push(
      `  approval inputs: ${preview.approvalRequest.requiredInputs.join("; ")}`
    );
    lines.push(
      `  approval stop: ${preview.approvalRequest.stopConditions.slice(0, 2).join("; ")}`
    );
  }

  if (preview.commandCopy.length > 0) {
    lines.push("  command copy:");
    for (const command of preview.commandCopy.slice(0, 4)) {
      lines.push(`    ${command}`);
    }
  }
}

function appendUpstreamLeadsSection(
  lines: string[],
  leads: EvidenceImpactPipelineUpstreamLead[]
) {
  if (leads.length === 0) {
    return;
  }

  lines.push("");
  lines.push("Upstream candidate leads:");

  for (const lead of leads) {
    lines.push(
      `- ${lead.source}: ${lead.externalId} -> ${lead.claimId ?? "no claim"} (${lead.triageScore}/100; ${lead.reviewStatus})`
    );
    lines.push(`  why: ${lead.reason}`);
    lines.push(`  packet: ${lead.command}`);
    lines.push(`  references: ${lead.referenceMatchesCommand}`);
  }
}

function parseLimit(value: string | undefined, option: string) {
  const limit = Number(value?.trim());

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error(`${option} requires an integer between 1 and 50.`);
  }

  return limit;
}

function requireValue(value: string | undefined, option: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`${option} requires a value.`);
  }

  return trimmed;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
