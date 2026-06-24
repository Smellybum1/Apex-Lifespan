#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");

const contractTemplates = {
  "dashboard-ui-plumbing-batch": {
    description: "Wire already-computed dashboard values through UI, types, fixtures, and focused tests.",
    tier: "composer-assisted",
    context: ["AGENTS.md", "docs/codex/workflows/codex-cursor-composer.md"],
    decisions: [
      "Codex has frozen the displayed values, labels, and acceptance criteria.",
      "Do not change scoring, evidence meaning, product/regulatory interpretation, or public contracts.",
      "Do not invent new data; use only values supplied by the contract or already-computed local helpers.",
    ],
    acceptance: [
      "Dashboard UI and focused tests reflect only the Codex-specified already-computed values.",
    ],
    checks: ["git diff --check"],
    forbidden: ["prisma/**", "package.json", "package-lock.json", "src/lib/seed-data.ts"],
    stops: [
      "A new user-facing semantic, score formula, evidence interpretation, or regulatory meaning is required.",
    ],
    maxFiles: 6,
    maxLines: 900,
  },
  "seed-data-mechanical-batch": {
    description: "Apply exact seed/data row edits where every field, value, caveat, and note is supplied.",
    tier: "composer-assisted",
    context: ["AGENTS.md", "docs/codex/project.md", "docs/codex/workflows/codex-cursor-composer.md"],
    decisions: [
      "Every row, id, field value, caveat, source id, and expected count is supplied by Codex.",
      "Do not infer source meaning, evidence labels, AU/TGA status, product-level status, or medical wording.",
      "Do not add new sources, claims, ingredients, outcomes, or review statuses beyond the contract.",
    ],
    acceptance: [
      "Seed/data edits exactly match the supplied rows and expected count checks.",
    ],
    checks: ["git diff --check"],
    forbidden: ["prisma/**", "package.json", "package-lock.json", "scripts/**"],
    stops: [
      "Any field value, source interpretation, evidence label, AU/TGA caveat, or product-level boundary is missing or ambiguous.",
    ],
    maxFiles: 5,
    maxLines: 1000,
  },
  "docs-status-cleanup-batch": {
    description: "Clean compact docs/status text from supplied facts without creating new process.",
    tier: "composer-safe",
    context: ["AGENTS.md", "docs/codex/project.md", "docs/codex/workflows/codex-cursor-composer.md"],
    decisions: [
      "Use only facts supplied in the contract.",
      "Prefer deletion and simplification over adding process.",
      "Do not add roadmap micro-goals, readiness gates, review packets, or Composer governance.",
    ],
    acceptance: [
      "Docs are shorter or clearer and contain only supplied facts.",
    ],
    checks: ["git diff --check"],
    forbidden: ["src/**", "prisma/**", "package.json", "package-lock.json"],
    stops: [
      "The docs require new medical/regulatory, citation, evidence-review, database, production, or workflow-policy interpretation.",
    ],
    maxFiles: 8,
    maxLines: 700,
  },
  "routine-cross-surface-batch": {
    description: "Apply frozen routine wiring across a few related UI/test/helper files.",
    tier: "composer-assisted",
    context: ["AGENTS.md", "docs/codex/workflows/codex-cursor-composer.md"],
    decisions: [
      "Codex has frozen the behavior and the exact surfaces to update.",
      "Keep edits mechanical and limited to allowed paths.",
      "Do not change architecture, public contracts, evidence methodology, medical/regulatory wording, dependencies, database, or deployment behavior.",
    ],
    acceptance: [
      "All specified surfaces reflect the frozen behavior and focused checks pass.",
    ],
    checks: ["git diff --check"],
    forbidden: ["prisma/**", "package.json", "package-lock.json", "scripts/composer/**"],
    stops: [
      "A non-mechanical decision or protected-boundary change is required.",
    ],
    maxFiles: 8,
    maxLines: 1200,
  },
  "npm-script-task": {
    description: "Add or update one bounded npm/script workflow around already-decided local behavior.",
    tier: "composer-safe",
    context: ["AGENTS.md", "docs/codex/workflows/codex-cursor-composer.md"],
    decisions: [
      "Follow the existing npm script and scripts/ patterns.",
      "Do not change app, database, medical/regulatory, citation, evidence-review, or operator-write semantics.",
    ],
    acceptance: [
      "Script behavior matches the Codex-specified existing entrypoint or local workflow.",
    ],
    checks: ["git diff --check"],
    forbidden: ["prisma/schema.prisma", "prisma/migrations/**", "prisma/seed.ts"],
    stops: [
      "An app, database, medical/regulatory, citation, evidence-review, operator-write, or production behavior decision is required.",
    ],
    maxFiles: 2,
    maxLines: 120,
  },
  "focused-test-update": {
    description: "Update a narrow test or fixture assertion after Codex freezes expected behavior.",
    tier: "composer-safe",
    context: ["AGENTS.md", "docs/codex/workflows/codex-cursor-composer.md"],
    decisions: [
      "Expected behavior is frozen by Codex; do not redesign production behavior.",
      "Keep the patch to focused tests and fixture helpers.",
    ],
    acceptance: [
      "Focused tests assert the Codex-specified expected behavior.",
    ],
    checks: ["git diff --check"],
    stops: [
      "A production behavior, public contract, database, medical/regulatory, citation, evidence-review, or operator-write decision is required.",
    ],
    maxFiles: 2,
    maxLines: 220,
  },
  "docs-status-sync": {
    description: "Sync bounded status docs from Codex-supplied facts and generated reports.",
    tier: "composer-safe",
    context: ["AGENTS.md", "docs/codex/workflows/codex-cursor-composer.md"],
    decisions: [
      "Use only the facts supplied in the task contract.",
      "Keep startup-facing docs compact and move verbose detail out of startup context.",
    ],
    acceptance: [
      "Docs reflect the supplied status facts without adding new project claims.",
    ],
    checks: ["git diff --check"],
    forbidden: ["src/**", "prisma/**", "package.json", "package-lock.json"],
    stops: [
      "The docs require new medical/regulatory, citation, evidence-review, database, or production interpretation.",
    ],
    maxFiles: 2,
    maxLines: 180,
  },
  "validator-field-add": {
    description: "Add an already-specified report/validator field and focused assertions.",
    tier: "composer-assisted",
    context: ["AGENTS.md", "docs/codex/workflows/codex-cursor-composer.md"],
    decisions: [
      "Field name, source value, and semantics are frozen by Codex.",
      "Do not broaden validation policy, medical/regulatory meaning, citation/evidence semantics, database writes, or approval boundaries.",
    ],
    acceptance: [
      "The exact Codex-specified field is emitted and covered by focused tests.",
    ],
    checks: ["git diff --check"],
    stops: [
      "The field semantics, approval meaning, medical/regulatory methodology, citation/evidence interpretation, database behavior, or public contract is unclear.",
    ],
    maxFiles: 3,
    maxLines: 250,
  },
};

function usage() {
  console.error(`Usage:
  node scripts/composer/create-task.cjs <task-id> --objective <text> --allowed <path> [--template <id>] [--check <command>] [--accept <criterion>] [options]
  node scripts/composer/create-task.cjs --options-json <path>
  node scripts/composer/create-task.cjs --list-templates

Options:
  --options-json <path>          Read task options from JSON to avoid shell argument limits
  --template <id>               Apply a reusable contract capsule
  --context <path>              Add a context file, repeatable
  --forbid <path>               Add a forbidden path, repeatable
  --decision <text>             Add a design decision, repeatable
  --stop <text>                 Add a stop condition, repeatable
  --risk <low|moderate>         Default: low
  --max-files <n>               Default: 2
  --max-lines <n>               Default: 250
  --allow-experimental-runtime  Allow experimental runtime flags in generated work
  --force                       Replace an existing task folder
  --run-root <dir>              Override run root, mainly for checks`);
  process.exit(2);
}

function defaultOptions(taskId = "") {
  return {
    taskId,
    objective: "",
    risk: "low",
    context: [],
    allowed: [],
    forbidden: [],
    acceptance: [],
    checks: [],
    decisions: [],
    stops: [],
    template: "",
    maxFiles: 2,
    maxLines: 250,
    force: false,
    allowExperimentalRuntime: false,
    runRoot: path.join(root, ".ai", "delegation", "runs"),
  };
}

function readStringArray(value, fieldName) {
  if (value === undefined) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value;
  }
  throw new Error(`${fieldName} must be a string or an array of strings`);
}

function readOptionsJson(optionsPath) {
  const resolved = path.resolve(optionsPath);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read --options-json ${resolved}: ${error.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--options-json must contain a JSON object");
  }

  const taskId = parsed.taskId ?? parsed.task_id ?? "";
  if (typeof taskId !== "string" || taskId.length === 0) {
    throw new Error("--options-json requires taskId or task_id");
  }

  const options = defaultOptions(taskId);
  options.objective = parsed.objective ?? options.objective;
  options.risk = parsed.risk ?? options.risk;
  options.context = readStringArray(
    parsed.context ?? parsed.context_files,
    "context"
  );
  options.allowed = readStringArray(
    parsed.allowed ?? parsed.allowed_paths,
    "allowed"
  );
  options.forbidden = readStringArray(
    parsed.forbidden ?? parsed.forbidden_paths,
    "forbidden"
  );
  options.acceptance = readStringArray(
    parsed.acceptance ?? parsed.acceptance_criteria,
    "acceptance"
  );
  options.checks = readStringArray(
    parsed.checks ?? parsed.test_commands,
    "checks"
  );
  options.decisions = readStringArray(
    parsed.decisions ?? parsed.design_decisions,
    "decisions"
  );
  options.stops = readStringArray(
    parsed.stops ?? parsed.stop_conditions,
    "stops"
  );
  options.template = parsed.template ?? parsed.template_id ?? options.template;
  options.maxFiles = Number(
    parsed.maxFiles ?? parsed.max_files_changed ?? options.maxFiles
  );
  options.maxLines = Number(
    parsed.maxLines ?? parsed.max_diff_lines ?? options.maxLines
  );
  options.force = Boolean(parsed.force ?? options.force);
  options.allowExperimentalRuntime = Boolean(
    parsed.allowExperimentalRuntime ??
      parsed.allow_experimental_runtime ??
      options.allowExperimentalRuntime
  );
  if (parsed.runRoot || parsed.run_root) {
    options.runRoot = path.resolve(parsed.runRoot ?? parsed.run_root);
  }
  return options;
}

function parseArgs(argv) {
  if (argv[0] === "--list-templates") {
    console.log(JSON.stringify({
      templates: Object.fromEntries(
        Object.entries(contractTemplates).map(([id, template]) => [
          id,
          {
            description: template.description,
            tier: template.tier,
            max_files_changed: template.maxFiles,
            max_diff_lines: template.maxLines,
          },
        ]),
      ),
    }, null, 2));
    process.exit(0);
  }

  if (argv[0] === "--options-json") {
    if (argv.length !== 2) usage();
    try {
      return readOptionsJson(argv[1]);
    } catch (error) {
      console.error(error.message);
      process.exit(2);
    }
  }

  const [taskId, ...rest] = argv;
  if (!taskId || taskId.startsWith("--")) usage();
  const options = defaultOptions(taskId);

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const next = () => {
      index += 1;
      if (index >= rest.length) usage();
      return rest[index];
    };
    if (arg === "--objective") options.objective = next();
    else if (arg === "--template") options.template = next();
    else if (arg === "--risk") options.risk = next();
    else if (arg === "--context") options.context.push(next());
    else if (arg === "--allowed") options.allowed.push(next());
    else if (arg === "--forbid") options.forbidden.push(next());
    else if (arg === "--accept") options.acceptance.push(next());
    else if (arg === "--check") options.checks.push(next());
    else if (arg === "--decision") options.decisions.push(next());
    else if (arg === "--stop") options.stops.push(next());
    else if (arg === "--max-files") options.maxFiles = Number(next());
    else if (arg === "--max-lines") options.maxLines = Number(next());
    else if (arg === "--project-critical") options.stops.push("Any project-critical medical/regulatory, citation/evidence, database, production, approval, or external-write decision is required.");
    else if (arg === "--force") options.force = true;
    else if (arg === "--allow-experimental-runtime") options.allowExperimentalRuntime = true;
    else if (arg === "--run-root") options.runRoot = path.resolve(next());
    else usage();
  }
  return options;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const options = parseArgs(process.argv.slice(2));

const template = options.template ? contractTemplates[options.template] : null;
if (options.template && !template) {
  console.error(`Unknown template: ${options.template}`);
  console.error(`Available templates: ${Object.keys(contractTemplates).join(", ")}`);
  process.exit(2);
}

if (template) {
  options.risk = options.risk || "low";
  options.context = [...(template.context ?? []), ...options.context];
  options.forbidden = [...(template.forbidden ?? []), ...options.forbidden];
  options.acceptance = [...(template.acceptance ?? []), ...options.acceptance];
  options.checks = [...(template.checks ?? []), ...options.checks];
  options.decisions = [...(template.decisions ?? []), ...options.decisions];
  options.stops = [...(template.stops ?? []), ...options.stops];
  options.maxFiles = Number.isFinite(options.maxFiles) && options.maxFiles !== 2 ? options.maxFiles : (template.maxFiles ?? options.maxFiles);
  options.maxLines = Number.isFinite(options.maxLines) && options.maxLines !== 250 ? options.maxLines : (template.maxLines ?? options.maxLines);
}

if (!options.objective || options.allowed.length === 0 || options.checks.length === 0 || options.acceptance.length === 0) {
  usage();
}

const defaultForbidden = [
  ".env*",
  "data/**",
  "package.json",
  "package-lock.json",
  "prisma/schema.prisma",
  "prisma/migrations/**",
  "prisma/seed.ts",
  "pyproject.toml",
  ".codex/**",
  ".agents/**",
  ".ai/**",
  "scripts/composer/**",
];

const context = [...options.context];
const decisions = [
  "Codex owns architecture, public contracts, validation, and final review.",
  "Keep this to one bounded implementation packet with deterministic checks.",
  "Do not use experimental runtime flags, dependency workarounds, or install steps unless the task explicitly permits them.",
  ...options.decisions,
];
const stops = [
  "Any file outside allowed_paths would need to change.",
  "A dependency, package, security, production-deploy, database, medical/regulatory, external-write, or final-review decision is required.",
  "The implementation needs secrets, durable local data, network research, current time, randomness, or another AI agent.",
  ...options.stops,
];

const task = {
  schema_version: 1,
  task_id: options.taskId,
  objective: options.objective,
  risk: options.risk,
  task_tier: template?.tier ?? "composer-safe",
  template_id: options.template || undefined,
  design_decisions: unique(decisions),
  context_files: unique(context),
  allowed_paths: unique(options.allowed),
  forbidden_paths: unique([...defaultForbidden, ...options.forbidden]),
  acceptance_criteria: unique(options.acceptance),
  test_commands: unique(options.checks),
  max_files_changed: options.maxFiles,
  max_diff_lines: options.maxLines,
  stop_conditions: unique(stops),
  composer_self_review: {
    required_fields: [
      "changed_files",
      "checks_run",
      "assumptions",
      "codex_attention_needed",
    ],
    max_detail: "compact",
  },
};

if (options.allowExperimentalRuntime) {
  task.allow_experimental_runtime = true;
}

const runDir = path.join(options.runRoot, options.taskId);
if (fs.existsSync(runDir) && !options.force) {
  console.error(`Task folder already exists: ${runDir}`);
  process.exit(2);
}

fs.mkdirSync(runDir, { recursive: true });
const taskPath = path.join(runDir, "task.json");
const briefPath = path.join(runDir, "brief.md");
fs.writeFileSync(taskPath, `${JSON.stringify(task, null, 2)}\n`);
fs.writeFileSync(briefPath, `# Composer Task ${options.taskId}

Objective: ${options.objective}

Implement only the contract in \`task.json\`.

Boundaries:
- Work only in allowed paths.
- Run only the specified checks.
- Return BLOCKED if a stop condition occurs.
- Codex will review the patch before anything is kept.
`);

const validation = spawnSync(process.execPath, [path.join(root, "scripts", "composer", "validate-task.cjs"), taskPath], {
  cwd: root,
  encoding: "utf8",
});
if (validation.status !== 0) {
  process.stderr.write(validation.stderr);
  process.stdout.write(validation.stdout);
  process.exit(validation.status ?? 1);
}

console.log(JSON.stringify({
  ok: true,
  task_id: options.taskId,
  task_json: path.relative(root, taskPath).replaceAll("\\", "/"),
  brief: path.relative(root, briefPath).replaceAll("\\", "/"),
  max_files_changed: task.max_files_changed,
  max_diff_lines: task.max_diff_lines,
}, null, 2));
