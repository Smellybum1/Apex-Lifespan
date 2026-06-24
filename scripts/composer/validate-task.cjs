#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function repoRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: path.resolve(__dirname, "..", ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return path.resolve(__dirname, "..", "..");
  }
}

const root = repoRoot();
const taskPath = process.argv[2];
assert.ok(taskPath, "Usage: node scripts/composer/validate-task.cjs <task.json>");

const task = JSON.parse(fs.readFileSync(path.resolve(taskPath), "utf8"));
const required = [
  "schema_version",
  "task_id",
  "objective",
  "risk",
  "design_decisions",
  "context_files",
  "allowed_paths",
  "forbidden_paths",
  "acceptance_criteria",
  "test_commands",
  "max_files_changed",
  "max_diff_lines",
  "stop_conditions",
];

for (const field of required) {
  assert.ok(Object.hasOwn(task, field), `Missing required field: ${field}`);
}

assert.equal(task.schema_version, 1, "schema_version must be 1");
assert.match(task.task_id, /^[a-z0-9][a-z0-9-]{2,63}$/, "task_id must be kebab-case, 3-64 chars");
assert.ok(["low", "moderate"].includes(task.risk), "risk must be low or moderate");
assert.equal(typeof task.objective, "string", "objective must be a string");
assert.ok(task.objective.trim().length >= 12, "objective is too short");

function assertStringArray(name, { nonEmpty = true } = {}) {
  const value = task[name];
  assert.ok(Array.isArray(value), `${name} must be an array`);
  if (nonEmpty) assert.ok(value.length > 0, `${name} must not be empty`);
  value.forEach((entry, index) => {
    assert.equal(typeof entry, "string", `${name}[${index}] must be a string`);
    assert.ok(entry.trim(), `${name}[${index}] must not be blank`);
  });
}

assertStringArray("design_decisions");
assertStringArray("context_files", { nonEmpty: false });
assertStringArray("allowed_paths");
assertStringArray("forbidden_paths");
assertStringArray("acceptance_criteria");
assertStringArray("test_commands");
assertStringArray("stop_conditions");

assert.ok(Number.isInteger(task.max_files_changed), "max_files_changed must be an integer");
assert.ok(task.max_files_changed >= 1 && task.max_files_changed <= 20, "max_files_changed must be between 1 and 20");
assert.ok(Number.isInteger(task.max_diff_lines), "max_diff_lines must be an integer");
assert.ok(task.max_diff_lines >= 1 && task.max_diff_lines <= 3000, "max_diff_lines must be between 1 and 3000");
if (Object.hasOwn(task, "allow_experimental_runtime")) {
  assert.equal(typeof task.allow_experimental_runtime, "boolean", "allow_experimental_runtime must be a boolean when present");
}
if (Object.hasOwn(task, "task_tier")) {
  assert.ok(["composer-safe", "composer-assisted"].includes(task.task_tier), "task_tier must be composer-safe or composer-assisted");
}
if (Object.hasOwn(task, "template_id")) {
  assert.equal(typeof task.template_id, "string", "template_id must be a string when present");
  assert.match(task.template_id, /^[a-z0-9][a-z0-9-]{2,63}$/, "template_id must be kebab-case, 3-64 chars");
}

function normalizePattern(pattern) {
  return pattern.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function literalPrefix(pattern) {
  const normalized = normalizePattern(pattern);
  const wildcardIndex = normalized.search(/[*?[\]{}]/);
  const prefix = wildcardIndex === -1 ? normalized : normalized.slice(0, wildcardIndex);
  return prefix.replace(/\/+$/, "");
}

function assertRepoRelative(pattern, fieldName) {
  const normalized = normalizePattern(pattern);
  assert.ok(!path.isAbsolute(normalized), `${fieldName} must be repo-relative: ${pattern}`);
  assert.doesNotMatch(normalized, /^[A-Za-z]:/, `${fieldName} must not include a drive letter: ${pattern}`);
  assert.ok(!normalized.split("/").includes(".."), `${fieldName} must not escape the repo: ${pattern}`);
  const prefix = literalPrefix(normalized) || ".";
  const resolved = path.resolve(root, prefix);
  const relative = path.relative(root, resolved);
  assert.ok(!relative.startsWith("..") && !path.isAbsolute(relative), `${fieldName} resolves outside repo: ${pattern}`);
  return normalized;
}

const allowed = task.allowed_paths.map((entry) => assertRepoRelative(entry, "allowed_paths"));
const forbidden = task.forbidden_paths.map((entry) => assertRepoRelative(entry, "forbidden_paths"));
task.context_files.forEach((entry) => assertRepoRelative(entry, "context_files"));

function prefixesOverlap(left, right) {
  const leftPrefix = literalPrefix(left);
  const rightPrefix = literalPrefix(right);
  if (!leftPrefix || !rightPrefix) return true;
  return leftPrefix === rightPrefix || leftPrefix.startsWith(`${rightPrefix}/`) || rightPrefix.startsWith(`${leftPrefix}/`);
}

for (const allowedPath of allowed) {
  for (const forbiddenPath of forbidden) {
    assert.ok(!prefixesOverlap(allowedPath, forbiddenPath), `allowed_paths overlaps forbidden_paths: ${allowedPath} vs ${forbiddenPath}`);
  }
}

const dangerousCommand = /\b(git\s+(commit|push|reset|clean|checkout|rebase|branch\s+-D)|npm\s+(install|i|update)|npm\s+run\s+(db:(push|migrate|migrate:deploy|seed)|build)|pnpm\s+add|yarn\s+add|prisma\s+(migrate|db\s+push)|vercel\b|(?<![/\\.-])agent\b|curl\b|wget\b|irm\b|Invoke-WebRequest\b|Remove-Item\b.*-Recurse|rm\s+-rf)\b/i;
const directCodexCommand = /(^|[;&|<>()\s])codex(\s|$)/i;
const experimentalRuntimeCommand = /(--experimental-|experimental-strip-types)/i;
for (const command of task.test_commands) {
  assert.doesNotMatch(command, dangerousCommand, `test_commands contains a forbidden command: ${command}`);
  assert.doesNotMatch(command, directCodexCommand, `test_commands contains a forbidden command: ${command}`);
  if (!task.allow_experimental_runtime) {
    assert.doesNotMatch(command, experimentalRuntimeCommand, `test_commands contains an experimental runtime flag without allow_experimental_runtime: ${command}`);
  }
}

const allTaskText = JSON.stringify(task);
if (/(medical|regulatory|TGA|ARTG|citation|evidence quality|evidence-review|AI reviewed|Human reviewed|operator write|database|db push|migration|Prisma|production deploy|source-rights|source rights|external-write|external write|seed write)/i.test(allTaskText)) {
  assert.match(
    task.stop_conditions.join(" "),
    /(methodology|medical|regulatory|TGA|ARTG|citation|evidence|database|migration|production|external[- ]write|ambiguous|ambiguity|unclear|approval)/i,
    "Project-critical tasks must stop on medical/regulatory, citation/evidence, database, production, external-write, approval, or ambiguity decisions",
  );
}

console.log(JSON.stringify({
  ok: true,
  task_id: task.task_id,
  risk: task.risk,
  allowed_paths: allowed.length,
  forbidden_paths: forbidden.length,
  test_commands: task.test_commands.length,
}));
