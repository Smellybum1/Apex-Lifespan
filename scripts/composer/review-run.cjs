#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const runDir = process.argv[2] ? path.resolve(process.argv[2]) : "";
if (!runDir) {
  console.error("Usage: node scripts/composer/review-run.cjs <run-dir>");
  process.exit(2);
}

function readText(file, fallback = "") {
  try {
    return fs.readFileSync(path.join(runDir, file), "utf8");
  } catch {
    return fallback;
  }
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(readText(file));
  } catch {
    return fallback;
  }
}

function parseUsage(logText) {
  const usage = {};
  for (const line of logText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.usage) Object.assign(usage, parsed.usage);
      if (typeof parsed.duration_ms === "number") usage.duration_ms = parsed.duration_ms;
    } catch {
      // Ignore non-JSON progress lines.
    }
  }
  return usage;
}

function bulletList(values, emptyText) {
  if (!values || values.length === 0) return `- ${emptyText}`;
  return values.map((value) => `- ${value}`).join("\n");
}

const review = readJson("review.json", {});
const changedFiles = readText("changed-files.txt").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const diffStat = readText("diff-stat.txt").trim();
const stdout = readText(path.join("logs", "composer.stdout.log"));
const stderrSummary = readText("checks-summary.md").trim();
const usage = parseUsage(stdout);
const checks = Array.isArray(review.checks) ? review.checks : [];
const violations = Array.isArray(review.violations) ? review.violations : [];
const failedChecks = checks.filter((check) => check.exit_code !== 0);
const passedChecks = checks.filter((check) => check.exit_code === 0);
const timeoutMarkerExists = fs.existsSync(path.join(runDir, "agent-timeout.txt"));
const agentTimedOut =
  review.agent_timed_out === true ||
  (review.agent_timed_out !== false && timeoutMarkerExists);
const acceptedCandidate = (
  !agentTimedOut
  && (review.composer_exit_code === 0 || review.composer_exit_code === "0")
  && violations.length === 0
  && failedChecks.length === 0
);
const changedFileSignalMismatch =
  typeof review.changed_files === "number" && review.changed_files !== changedFiles.length;
const fullDiffReasons = [
  ...(agentTimedOut ? ["agent timed out"] : []),
  ...(review.composer_exit_code === 0 || review.composer_exit_code === "0" ? [] : ["composer exit was nonzero"]),
  ...(violations.length > 0 ? ["contract violations"] : []),
  ...(failedChecks.length > 0 ? ["failed checks"] : []),
  ...(changedFileSignalMismatch ? ["changed-file signal mismatch"] : []),
];
const reviewGate = fullDiffReasons.length > 0 ? "full-diff" : "spot-check";

const lines = [
  `# Composer Review: ${review.task_id ?? path.basename(runDir)}`,
  "",
  `- Review gate: ${reviewGate}`,
  `- Status: ${review.status ?? "unknown"}`,
  `- Composer exit: ${review.composer_exit_code ?? "unknown"}`,
  `- Agent timed out: ${agentTimedOut}`,
  `- Changed files: ${review.changed_files ?? changedFiles.length}`,
  `- Diff lines: ${review.diff_lines ?? "unknown"}`,
];

lines.push("");
lines.push("## Compact Signals");
lines.push(`- Outcome: ${acceptedCandidate ? "review-candidate" : "needs-codex-attention"}`);
lines.push(`- Checks: ${passedChecks.length} passed, ${failedChecks.length} failed`);
lines.push(`- Violations: ${violations.length}`);
lines.push(`- Timeout marker: ${agentTimedOut ? "yes" : "no"}`);
lines.push(`- Changed-file signal: ${changedFileSignalMismatch ? "mismatch" : "clean"}`);
lines.push(`- Codex review load: ${reviewGate}`);
if (fullDiffReasons.length > 0) {
  lines.push(`- Full-diff reasons: ${fullDiffReasons.join("; ")}`);
}

lines.push("");
lines.push("## Changed Files");
lines.push(bulletList(changedFiles, "None recorded"));

lines.push("");
lines.push("## Checks");
if (checks.length === 0) {
  lines.push("- None recorded");
} else {
  for (const check of checks) {
    const icon = check.exit_code === 0 ? "PASS" : "FAIL";
    lines.push(`- ${icon}: ${check.command} (exit ${check.exit_code})`);
  }
}

lines.push("");
lines.push("## Violations");
lines.push(bulletList(violations, "None"));

if (diffStat) {
  lines.push("");
  lines.push("## Diff Stat");
  lines.push("```text");
  lines.push(diffStat);
  lines.push("```");
}

if (stderrSummary) {
  lines.push("");
  lines.push("## Log Signals");
  lines.push("```json");
  lines.push(stderrSummary);
  lines.push("```");
}

lines.push("");
lines.push("## Codex Review Checklist");
if (reviewGate === "spot-check") {
  lines.push("- Spot-check changed files, acceptance evidence, and any sensitive wording touched by the packet.");
  lines.push("- Escalate to full diff if a signal is missing, unclear, or touches a protected boundary.");
} else {
  lines.push("- Inspect implementation.patch directly.");
  lines.push("- Confirm changed files match allowed_paths and no protected paths changed.");
  lines.push("- Confirm deterministic checks passed from the worktree.");
  lines.push("- Confirm no experimental runtime/dependency workaround appeared unless task.json allowed it.");
  lines.push("- Confirm Apex medical/regulatory, citation traceability, evidence-review, database/write, production-deploy, and security boundaries still hold.");
}

console.log(`${lines.join("\n")}\n`);
