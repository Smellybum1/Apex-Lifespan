const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const validator = path.join(root, "scripts", "composer", "validate-task.cjs");
const createTask = path.join(root, "scripts", "composer", "create-task.cjs");
const reviewRun = path.join(root, "scripts", "composer", "review-run.cjs");

function writeTask(dir, name, patch = {}) {
  const task = {
    schema_version: 1,
    task_id: name,
    objective: "Validate the Composer worker task contract safely.",
    risk: "low",
    design_decisions: ["Codex owns architecture and final review."],
    context_files: ["AGENTS.md"],
    allowed_paths: ["docs/codex/workflows/**"],
    forbidden_paths: [".env*", "data/**", "package-lock.json"],
    acceptance_criteria: ["The validator accepts safe bounded tasks."],
    test_commands: ["npm run check:skills"],
    max_files_changed: 4,
    max_diff_lines: 200,
    stop_conditions: ["The task becomes ambiguous."],
    ...patch,
  };
  const file = path.join(dir, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(task, null, 2));
  return file;
}

function runValidate(file) {
  return spawnSync(process.execPath, [validator, file], { cwd: root, encoding: "utf8" });
}

function expectPass(file) {
  const result = runValidate(file);
  assert.equal(result.status, 0, `${file} should pass\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
}

function expectFail(file, pattern) {
  const result = runValidate(file);
  assert.notEqual(result.status, 0, `${file} should fail`);
  assert.match(`${result.stdout}\n${result.stderr}`, pattern);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "apex-lifespan-composer-"));

expectPass(writeTask(tmp, "valid-task"));
expectPass(writeTask(tmp, "docs-codex-path-check", {
  test_commands: ["git diff --check -- docs/codex/workflows/example.md"],
}));
expectPass(writeTask(tmp, "npm-script-check", {
  test_commands: ["npm run test -- scripts/composer/example.test.ts"],
}));
expectFail(writeTask(tmp, "missing-criteria", { acceptance_criteria: [] }), /acceptance_criteria must not be empty/);
expectFail(writeTask(tmp, "overlap-paths", { allowed_paths: ["docs/**"], forbidden_paths: ["docs/codex/**"] }), /overlaps/);
expectFail(writeTask(tmp, "escape-paths", { allowed_paths: ["../outside/**"] }), /escape the repo/);
expectFail(writeTask(tmp, "dangerous-command", { test_commands: ["git push"] }), /forbidden command/);
expectFail(writeTask(tmp, "codex-cli-command", { test_commands: ["codex exec"] }), /forbidden command/);
expectFail(writeTask(tmp, "experimental-command", { test_commands: ["node --experimental-strip-types scripts/example.cjs"] }), /experimental runtime/);
expectPass(writeTask(tmp, "allowed-experimental-command", {
  test_commands: ["node --experimental-strip-types scripts/example.cjs"],
  allow_experimental_runtime: true,
}));
expectPass(writeTask(tmp, "larger-frozen-routine-task", { max_diff_lines: 2500 }));
expectFail(writeTask(tmp, "excessive-diff", { max_diff_lines: 5000 }), /max_diff_lines/);
expectFail(writeTask(tmp, "critical-weak-stop", {
  objective: "Implement a medical regulatory evidence helper.",
  stop_conditions: ["A dependency change is required."],
}), /Project-critical tasks/);
expectFail(writeTask(tmp, "invalid-tier", { task_tier: "codex-only" }), /task_tier/);

const listedTemplates = spawnSync(process.execPath, [createTask, "--list-templates"], { cwd: root, encoding: "utf8" });
assert.equal(listedTemplates.status, 0, listedTemplates.stderr);
const templates = JSON.parse(listedTemplates.stdout).templates;
assert.ok(templates["dashboard-ui-plumbing-batch"], "create-task should list dashboard-ui-plumbing-batch template");
assert.ok(templates["seed-data-mechanical-batch"], "create-task should list seed-data-mechanical-batch template");
assert.ok(templates["docs-status-cleanup-batch"], "create-task should list docs-status-cleanup-batch template");
assert.ok(templates["routine-cross-surface-batch"], "create-task should list routine-cross-surface-batch template");
assert.ok(templates["docs-status-sync"], "create-task should list reusable docs-status-sync template");
assert.ok(templates["focused-test-update"], "create-task should list reusable focused-test-update template");
assert.ok(templates["npm-script-task"], "create-task should list reusable npm-script-task template");

const generatedRoot = path.join(tmp, "runs");
const generated = spawnSync(process.execPath, [
  createTask,
  "generated-task",
  "--run-root",
  generatedRoot,
  "--objective",
  "Generate a bounded Composer task contract.",
  "--allowed",
  "docs/codex/workflows/generated-task.md",
  "--check",
  "npm run check:skills",
  "--accept",
  "Generated task has objective acceptance criteria.",
], { cwd: root, encoding: "utf8" });
assert.equal(generated.status, 0, `${generated.stdout}\n${generated.stderr}`);
const generatedTask = JSON.parse(fs.readFileSync(path.join(generatedRoot, "generated-task", "task.json"), "utf8"));
assert.equal(generatedTask.max_files_changed, 2, "created tasks should default to two changed files");
assert.equal(generatedTask.max_diff_lines, 250, "created tasks should default to 250 diff lines");
assert.ok(generatedTask.forbidden_paths.includes("scripts/composer/**"), "created tasks should forbid delegation system edits");
assert.equal(generatedTask.task_tier, "composer-safe", "created tasks should default to composer-safe tier");
assert.deepEqual(generatedTask.composer_self_review.required_fields, [
  "changed_files",
  "checks_run",
  "assumptions",
  "codex_attention_needed",
]);

const optionsJson = path.join(tmp, "generated-from-json-options.json");
fs.writeFileSync(optionsJson, JSON.stringify({
  taskId: "generated-from-json-task",
  runRoot: generatedRoot,
  force: true,
  template: "focused-test-update",
  objective: "Generate a bounded Composer task contract from a JSON options file.",
  allowed: ["docs/codex/workflows/generated-from-json-task.md"],
  checks: ["git diff --check"],
  acceptance: ["Generated JSON options task has objective acceptance criteria."],
  decisions: [
    `Long frozen contract details are accepted from JSON instead of the Windows command line: ${"detail ".repeat(600)}`,
  ],
  maxFiles: 2,
  maxLines: 300,
}, null, 2));
const generatedFromJson = spawnSync(process.execPath, [
  createTask,
  "--options-json",
  optionsJson,
], { cwd: root, encoding: "utf8" });
assert.equal(generatedFromJson.status, 0, `${generatedFromJson.stdout}\n${generatedFromJson.stderr}`);
const generatedFromJsonTask = JSON.parse(fs.readFileSync(path.join(generatedRoot, "generated-from-json-task", "task.json"), "utf8"));
assert.equal(generatedFromJsonTask.template_id, "focused-test-update");
assert.equal(generatedFromJsonTask.max_diff_lines, 300);
assert.ok(
  generatedFromJsonTask.design_decisions.some((entry) => entry.includes("Long frozen contract details")),
  "JSON options should preserve long design decisions"
);

const templated = spawnSync(process.execPath, [
  createTask,
  "templated-docs-task",
  "--run-root",
  generatedRoot,
  "--template",
  "docs-status-sync",
  "--objective",
  "Sync bounded Composer workflow docs from supplied facts.",
  "--allowed",
  "docs/codex/workflows/codex-cursor-composer.md",
], { cwd: root, encoding: "utf8" });
assert.equal(templated.status, 0, `${templated.stdout}\n${templated.stderr}`);
const templatedTask = JSON.parse(fs.readFileSync(path.join(generatedRoot, "templated-docs-task", "task.json"), "utf8"));
assert.equal(templatedTask.template_id, "docs-status-sync");
assert.equal(templatedTask.task_tier, "composer-safe");
assert.ok(templatedTask.test_commands.includes("git diff --check"), "docs template should include diff check");
assert.ok(templatedTask.acceptance_criteria.some((entry) => entry.includes("supplied status facts")), "docs template should include status-sync acceptance");

const dashboardBatch = spawnSync(process.execPath, [
  createTask,
  "dashboard-batch-task",
  "--run-root",
  generatedRoot,
  "--template",
  "dashboard-ui-plumbing-batch",
  "--objective",
  "Wire frozen dashboard values through UI and focused tests.",
  "--allowed",
  "src/components/evidence-dashboard.tsx",
  "--allowed",
  "src/components/evidence-dashboard.test.tsx",
], { cwd: root, encoding: "utf8" });
assert.equal(dashboardBatch.status, 0, `${dashboardBatch.stdout}\n${dashboardBatch.stderr}`);
const dashboardBatchTask = JSON.parse(fs.readFileSync(path.join(generatedRoot, "dashboard-batch-task", "task.json"), "utf8"));
assert.equal(dashboardBatchTask.template_id, "dashboard-ui-plumbing-batch");
assert.equal(dashboardBatchTask.max_files_changed, 6);
assert.equal(dashboardBatchTask.max_diff_lines, 900);

const configPath = path.join(root, ".ai", "delegation", "local-config.example.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
assert.equal(config.sandbox, "enabled", "example config should require sandboxing");
assert.equal(config.safety_proven, false, "example config must fail closed until smoke-tested");
assert.equal(config.require_standard_mode, true, "example config should require standard mode");
assert.equal(config.forbid_fast_mode, true, "example config should reject fast mode");
assert.equal(config.agent_output_format, "stream-json", "example config should default to stream-json for live Composer diagnostics");
assert.equal(config.agent_timeout_seconds, 210, "example config should bound headless Composer runs below Codex's usual outer timeout");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(pkg.scripts["composer:create"], undefined, "package should not expose Composer shortcuts by default");
assert.equal(pkg.scripts["composer:templates"], undefined, "package should not expose Composer shortcuts by default");
assert.equal(pkg.scripts["composer:review"], undefined, "package should not expose Composer shortcuts by default");

const psScripts = [
  path.join(root, "scripts", "composer", "preflight.ps1"),
  path.join(root, "scripts", "composer", "smoke-test.ps1"),
  path.join(root, "scripts", "composer", "invoke-composer-worker.ps1"),
];
const invokeScriptText = fs.readFileSync(path.join(root, "scripts", "composer", "invoke-composer-worker.ps1"), "utf8");
const preflightScriptText = fs.readFileSync(path.join(root, "scripts", "composer", "preflight.ps1"), "utf8");
assert.match(preflightScriptText, /stream-json/, "preflight should require stream-json output support");
assert.match(preflightScriptText, /GNU timeout/, "preflight should require GNU timeout for WSL agent bounds");
assert.match(invokeScriptText, /\[switch\]\$UseDirtyMainSnapshot/, "invoke script should support a dirty-main snapshot mode");
assert.match(invokeScriptText, /\[switch\]\$CleanExistingWorktree/, "invoke script should support explicit cleanup of stale disposable worktrees");
assert.match(invokeScriptText, /Copy-DirtyMainSnapshot/, "invoke script should copy dirty context into the disposable worktree when requested");
assert.match(invokeScriptText, /dirty-snapshot-baseline-files\.txt/, "invoke script should record the staged dirty baseline files");
assert.match(invokeScriptText, /dirty-snapshot-skipped-files\.txt/, "invoke script should record skipped dirty snapshot files");
assert.match(invokeScriptText, /\.ai\/delegation\/runs\/\*/, "invoke script should not copy previous Composer run folders into dirty snapshots");
assert.match(invokeScriptText, /Test-GeneratedArtifactPath/, "invoke script should skip generated artifact roots during dirty snapshots and diff collection");
assert.match(invokeScriptText, /"data"/, "invoke script should not copy local app data into dirty snapshots");
assert.match(invokeScriptText, /Remove-DisposableGeneratedArtifacts/, "invoke script should clear disposable generated artifacts before Windows-side checks");
assert.match(invokeScriptText, /New-WorktreeDirectoryLink/, "invoke script should reuse local dependency directories through disposable worktree links");
assert.match(invokeScriptText, /\.apex-lifespan-composer-worktrees/, "invoke script should default to the Apex Composer worktree root");
assert.match(invokeScriptText, /docs\\codex\\generated/, "invoke script should use Apex generated-doc fixture path when linking optional fixtures");
assert.match(invokeScriptText, /Remove-WorktreeDirectoryLink \$worktreeGeneratedDocs/, "invoke script should clean the generated docs worktree link after checks");
assert.match(invokeScriptText, /Convert-ToCmdCheckCommand/, "invoke script should normalize Windows check commands before cmd.exe execution");
assert.match(invokeScriptText, /New-CheckLogPath/, "invoke script should keep check log filenames short and stable");
assert.match(invokeScriptText, /Get-ShortHash/, "invoke script should hash full check commands for unique short log names");
assert.match(invokeScriptText, /Invoke-Captured "cmd\.exe" @\("\/d", "\/c", \$checkCommand\)/, "invoke script should avoid cmd.exe /s so quoted .cmd paths with spaces run correctly");
assert.match(invokeScriptText, /Assert-ComposerWorktreePath/, "invoke script should verify stale worktree cleanup stays inside the Composer worktree root");
assert.match(invokeScriptText, /existing-worktree-path\.txt/, "invoke script should record stale worktree paths before refusing or cleaning them");
assert.match(invokeScriptText, /git -C \$repoRoot worktree remove --force \$cleanPath/, "invoke script should remove stale worktrees only through git worktree remove");
assert.match(invokeScriptText, /\$staleRunArtifacts/, "invoke script should clear stale review artifacts before each invoke");
assert.match(invokeScriptText, /agent-timeout\.txt/, "invoke script should include timeout markers in stale artifact cleanup");
assert.match(invokeScriptText, /Get-ChildItem -LiteralPath \$logsDir -File/, "invoke script should clear stale log files before each invoke");
assert.match(invokeScriptText, /agent_timeout_seconds/, "invoke script should read the configured Composer agent timeout");
assert.match(invokeScriptText, /agent_output_format/, "invoke script should read the configured Composer output format");
assert.match(invokeScriptText, /stream-json/, "invoke script should support streaming Cursor Agent output");
assert.match(invokeScriptText, /do not substitute a different command/, "invoke prompt should prevent Composer from replacing unavailable check launchers");
assert.match(invokeScriptText, /codex_attention_needed: true\/false/, "invoke prompt should request minimal Composer self-review fields");
assert.match(invokeScriptText, /timeout --kill-after=15s/, "invoke script should bound WSL Cursor Agent runs with GNU timeout");
assert.match(invokeScriptText, /agent-timeout\.txt/, "invoke script should record a timeout marker for hung Composer runs");
assert.match(invokeScriptText, /agent_timed_out/, "review.json should expose whether the Cursor Agent timed out");
assert.match(invokeScriptText, /Get-AddedDiffLines/, "invoke script should scan added diff lines for experimental runtime markers");
assert.match(invokeScriptText, /untrackedAfterRun/, "invoke script should add only non-ignored untracked files after Composer runs");
assert.match(invokeScriptText, /-notlike "\.composer-task\/\*"/, "invoke script should keep .composer-task out of diff collection");

for (const script of psScripts) {
  if (process.platform !== "win32") continue;
  const command = [
    "$errors = $null",
    `$null = [System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw '${script.replaceAll("'", "''")}'), [ref]$errors)`,
    "if ($errors.Count -gt 0) { $errors | Format-List | Out-String | Write-Error; exit 1 }",
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `${script} should parse\n${result.stdout}\n${result.stderr}`);
}

const summaryFixture = path.join(tmp, "summary.log");
fs.writeFileSync(summaryFixture, "\u001b[31mError: one\u001b[0m\nok\nError: one\nBLOCKED by policy\n");
const summary = spawnSync(process.execPath, [path.join(root, "scripts", "composer", "summarize-run.cjs"), summaryFixture], {
  cwd: root,
  encoding: "utf8",
});
assert.equal(summary.status, 0, summary.stderr);
const parsed = JSON.parse(summary.stdout);
assert.equal(parsed.failure_class, "policy-blocked");
assert.deepEqual(parsed.preview, ["Error: one", "BLOCKED by policy"]);

const successfulJsonFixture = path.join(tmp, "successful-json.log");
fs.writeFileSync(successfulJsonFixture, `${JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "Completed cleanly." })}\n`);
const cleanSummary = spawnSync(process.execPath, [path.join(root, "scripts", "composer", "summarize-run.cjs"), successfulJsonFixture], {
  cwd: root,
  encoding: "utf8",
});
assert.equal(cleanSummary.status, 0, cleanSummary.stderr);
const cleanParsed = JSON.parse(cleanSummary.stdout);
assert.equal(cleanParsed.failure_class, "none");
assert.deepEqual(cleanParsed.preview, [], "successful JSON result should not be treated as an error signal");

const reviewFixture = path.join(tmp, "review");
fs.mkdirSync(path.join(reviewFixture, "logs"), { recursive: true });
fs.writeFileSync(path.join(reviewFixture, "review.json"), JSON.stringify({
  task_id: "review-fixture",
  status: "needs-codex-review",
  composer_exit_code: 0,
  changed_files: 1,
  diff_lines: 12,
  violations: [],
  checks: [{ command: "npm run example", exit_code: 0, log: "logs/check.log" }],
}, null, 2));
fs.writeFileSync(path.join(reviewFixture, "changed-files.txt"), "docs/example.md\n");
fs.writeFileSync(path.join(reviewFixture, "diff-stat.txt"), " docs/example.md | 12 ++++++++++++\n");
fs.writeFileSync(path.join(reviewFixture, "checks-summary.md"), JSON.stringify({ preview: [] }, null, 2));
fs.writeFileSync(path.join(reviewFixture, "logs", "composer.stdout.log"), JSON.stringify({
  duration_ms: 42,
  usage: { inputTokens: 10, outputTokens: 3, cacheReadTokens: 20, cacheWriteTokens: 0 },
}));
const reviewSummary = spawnSync(process.execPath, [reviewRun, reviewFixture], { cwd: root, encoding: "utf8" });
assert.equal(reviewSummary.status, 0, reviewSummary.stderr);
assert.match(reviewSummary.stdout, /Composer Review: review-fixture/);
assert.match(reviewSummary.stdout, /Review gate: spot-check/);
assert.doesNotMatch(reviewSummary.stdout, /Tokens:/);
assert.match(reviewSummary.stdout, /Compact Signals/);
assert.match(reviewSummary.stdout, /Outcome: review-candidate/);
assert.match(reviewSummary.stdout, /PASS: npm run example/);

const staleTimeoutReviewFixture = path.join(tmp, "stale-timeout-review");
fs.mkdirSync(path.join(staleTimeoutReviewFixture, "logs"), { recursive: true });
fs.writeFileSync(path.join(staleTimeoutReviewFixture, "review.json"), JSON.stringify({
  task_id: "stale-timeout-review",
  status: "needs-codex-review",
  composer_exit_code: 0,
  agent_timed_out: false,
  changed_files: 0,
  diff_lines: 0,
  violations: [],
  checks: [],
}, null, 2));
fs.writeFileSync(path.join(staleTimeoutReviewFixture, "agent-timeout.txt"), "stale timeout from a previous invoke\n");
fs.writeFileSync(path.join(staleTimeoutReviewFixture, "changed-files.txt"), "");
fs.writeFileSync(path.join(staleTimeoutReviewFixture, "diff-stat.txt"), "");
fs.writeFileSync(path.join(staleTimeoutReviewFixture, "checks-summary.md"), JSON.stringify({ preview: [] }, null, 2));
fs.writeFileSync(path.join(staleTimeoutReviewFixture, "logs", "composer.stdout.log"), "");
const staleTimeoutSummary = spawnSync(process.execPath, [reviewRun, staleTimeoutReviewFixture], { cwd: root, encoding: "utf8" });
assert.equal(staleTimeoutSummary.status, 0, staleTimeoutSummary.stderr);
assert.match(staleTimeoutSummary.stdout, /Agent timed out: false/);
assert.match(staleTimeoutSummary.stdout, /Timeout marker: no/);

console.log("Composer integration check passed.");
