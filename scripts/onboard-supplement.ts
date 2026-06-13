import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildSupplementOnboardingPlan,
  buildSupplementOnboardingBatchPlan,
  SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES,
  supplementOnboardingBatchPlanToMarkdown,
  supplementOnboardingPlanToMarkdown,
  SUPPLEMENT_ONBOARDING_CATEGORIES,
  SUPPLEMENT_ONBOARDING_OUTCOMES,
  type SupplementOnboardingBatchPlan,
  type SupplementOnboardingClaimInput,
  type SupplementOnboardingClaimTemplateId,
  type SupplementOnboardingProductInput
} from "@/lib/supplement-onboarding";
import {
  buildSupplementOnboardingReviewKit,
  type SupplementOnboardingReviewKit
} from "@/lib/supplement-onboarding-review-kit";
import { buildSupplementOnboardingSeedDiffReport } from "@/lib/supplement-onboarding-seed-diff";
import type { InterventionCategory } from "@/lib/types";

interface SupplementOnboardingCliArgs {
  batchFilePath?: string;
  category?: InterventionCategory;
  claimTemplateIds: SupplementOnboardingClaimTemplateId[];
  claims: SupplementOnboardingClaimInput[];
  commonForms: string[];
  forceReviewKit: boolean;
  json: boolean;
  name?: string;
  outputDir: string;
  product: SupplementOnboardingProductInput;
  region: string;
  synonyms: string[];
  writeDraft: boolean;
  writeReviewKit: boolean;
}

async function main() {
  const args = readArgs(process.argv.slice(2));

  if (args.batchFilePath) {
    const batch = buildSupplementOnboardingBatchPlan({
      supplements: readBatchFile(args.batchFilePath)
    });
    const markdown = supplementOnboardingBatchPlanToMarkdown(batch);

    if (args.writeDraft) {
      for (const plan of batch.plans) {
        const outputPath = writeDraft(
          args.outputDir,
          plan.interventionDraft.slug,
          supplementOnboardingPlanToMarkdown(plan)
        );
        console.log(`Wrote supplement onboarding draft: ${outputPath}`);
      }
    }

    if (args.writeReviewKit) {
      const seedDiffReport = buildSupplementOnboardingSeedDiffReport({
        existingData: await readExistingSeedData(),
        plans: batch.plans
      });
      const kits = batch.plans.map((plan) =>
        buildSupplementOnboardingReviewKit({
          plan,
          seedDiffReport
        })
      );
      const batchIndex = buildBatchReviewKitIndex({
        batch,
        kits,
        outputDir: args.outputDir
      });

      preflightBatchReviewKitOutput({
        force: args.forceReviewKit,
        indexPath: batchIndex.path,
        kits,
        outputDir: args.outputDir
      });

      for (const kit of kits) {
        const outputPaths = writeReviewKitFiles(
          args.outputDir,
          kit,
          args.forceReviewKit
        );
        console.log(
          `Wrote supplement onboarding review kit: ${path.dirname(outputPaths[0])}`
        );
      }

      writeLocalFile(batchIndex.path, batchIndex.content, args.forceReviewKit);
      console.log(`Wrote supplement onboarding batch review-kit index: ${batchIndex.path}`);

      if (!args.json) {
        return;
      }
    }

    if (args.json) {
      console.log(JSON.stringify(batch, null, 2));
      return;
    }

    console.log(markdown);
    return;
  }

  if (!args.name) {
    throw new Error(helpText());
  }

  const plan = buildSupplementOnboardingPlan({
    category: args.category,
    claimTemplateIds: args.claimTemplateIds,
    claims: args.claims,
    commonForms: args.commonForms,
    name: args.name,
    product: hasProductInput(args.product) ? args.product : undefined,
    region: args.region,
    synonyms: args.synonyms
  });
  const markdown = supplementOnboardingPlanToMarkdown(plan);

  if (args.writeDraft) {
    const outputPath = writeDraft(args.outputDir, plan.interventionDraft.slug, markdown);
    console.log(`Wrote supplement onboarding draft: ${outputPath}`);
  }

  if (args.writeReviewKit) {
    const seedDiffReport = buildSupplementOnboardingSeedDiffReport({
      existingData: await readExistingSeedData(),
      plans: [plan]
    });
    const kit = buildSupplementOnboardingReviewKit({
      plan,
      seedDiffReport
    });
    const outputPaths = writeReviewKitFiles(args.outputDir, kit, args.forceReviewKit);
    console.log(`Wrote supplement onboarding review kit: ${path.dirname(outputPaths[0])}`);

    if (!args.json) {
      return;
    }
  }

  if (args.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  console.log(markdown);
}

function readArgs(args: string[]): SupplementOnboardingCliArgs {
  const parsed: SupplementOnboardingCliArgs = {
    claims: [],
    claimTemplateIds: [],
    commonForms: [],
    forceReviewKit: false,
    json: false,
    outputDir: "docs/codex/onboarding",
    product: {},
    region: "AU",
    synonyms: [],
    writeDraft: false,
    writeReviewKit: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      throw new Error(helpText());
    }

    if (arg === "--json") {
      parsed.json = true;
      continue;
    }

    if (arg === "--batch-file") {
      parsed.batchFilePath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--batch-file=")) {
      parsed.batchFilePath = readInlineValue(arg, "--batch-file");
      continue;
    }

    if (arg === "--write-draft") {
      parsed.writeDraft = true;
      continue;
    }

    if (arg === "--write-review-kit") {
      parsed.writeReviewKit = true;
      continue;
    }

    if (arg === "--force-review-kit") {
      parsed.forceReviewKit = true;
      continue;
    }

    if (arg === "--name") {
      parsed.name = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--name=")) {
      parsed.name = readInlineValue(arg, "--name");
      continue;
    }

    if (arg === "--category") {
      parsed.category = readCategory(readRequiredValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--category=")) {
      parsed.category = readCategory(readInlineValue(arg, "--category"));
      continue;
    }

    if (arg === "--synonym") {
      parsed.synonyms.push(readRequiredValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--synonym=")) {
      parsed.synonyms.push(readInlineValue(arg, "--synonym"));
      continue;
    }

    if (arg === "--synonyms") {
      parsed.synonyms.push(...readListValue(readRequiredValue(args, index, arg)));
      index += 1;
      continue;
    }

    if (arg.startsWith("--synonyms=")) {
      parsed.synonyms.push(...readListValue(readInlineValue(arg, "--synonyms")));
      continue;
    }

    if (arg === "--form") {
      parsed.commonForms.push(readRequiredValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--form=")) {
      parsed.commonForms.push(readInlineValue(arg, "--form"));
      continue;
    }

    if (arg === "--claim") {
      parsed.claims.push(readClaim(readRequiredValue(args, index, arg)));
      index += 1;
      continue;
    }

    if (arg === "--template") {
      parsed.claimTemplateIds.push(readTemplate(readRequiredValue(args, index, arg)));
      index += 1;
      continue;
    }

    if (arg.startsWith("--template=")) {
      parsed.claimTemplateIds.push(readTemplate(readInlineValue(arg, "--template")));
      continue;
    }

    if (arg === "--templates") {
      parsed.claimTemplateIds.push(
        ...readListValue(readRequiredValue(args, index, arg)).map(readTemplate)
      );
      index += 1;
      continue;
    }

    if (arg.startsWith("--templates=")) {
      parsed.claimTemplateIds.push(
        ...readListValue(readInlineValue(arg, "--templates")).map(readTemplate)
      );
      continue;
    }

    if (arg.startsWith("--claim=")) {
      parsed.claims.push(readClaim(readInlineValue(arg, "--claim")));
      continue;
    }

    if (arg === "--region") {
      parsed.region = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--region=")) {
      parsed.region = readInlineValue(arg, "--region");
      continue;
    }

    if (arg === "--product-name") {
      parsed.product.name = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--product-name=")) {
      parsed.product.name = readInlineValue(arg, "--product-name");
      continue;
    }

    if (arg === "--product-brand") {
      parsed.product.brand = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--product-brand=")) {
      parsed.product.brand = readInlineValue(arg, "--product-brand");
      continue;
    }

    if (arg === "--aust-number") {
      parsed.product.austNumber = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--aust-number=")) {
      parsed.product.austNumber = readInlineValue(arg, "--aust-number");
      continue;
    }

    if (arg === "--artg-id") {
      parsed.product.artgId = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--artg-id=")) {
      parsed.product.artgId = readInlineValue(arg, "--artg-id");
      continue;
    }

    if (arg === "--sponsor") {
      parsed.product.sponsor = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--sponsor=")) {
      parsed.product.sponsor = readInlineValue(arg, "--sponsor");
      continue;
    }

    if (arg === "--product-source-url") {
      parsed.product.sourceUrl = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--product-source-url=")) {
      parsed.product.sourceUrl = readInlineValue(arg, "--product-source-url");
      continue;
    }

    if (arg === "--output-dir") {
      parsed.outputDir = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--output-dir=")) {
      parsed.outputDir = readInlineValue(arg, "--output-dir");
      continue;
    }

    throw new Error(`Unknown supplement onboarding option: ${arg}\n\n${helpText()}`);
  }

  return parsed;
}

function readCategory(value: string): InterventionCategory {
  const category = SUPPLEMENT_ONBOARDING_CATEGORIES.find(
    (candidate) => candidate.toLowerCase() === value.trim().toLowerCase()
  );

  if (!category) {
    throw new Error(
      `Unknown category: ${value}. Allowed categories: ${SUPPLEMENT_ONBOARDING_CATEGORIES.join(", ")}.`
    );
  }

  return category;
}

function readClaim(value: string): SupplementOnboardingClaimInput {
  const separatorIndex = value.indexOf("|");

  if (separatorIndex === -1) {
    throw new Error(
      `--claim must use "Outcome|Claim text". Allowed outcomes: ${SUPPLEMENT_ONBOARDING_OUTCOMES.join(", ")}.`
    );
  }

  const outcomeValue = value.slice(0, separatorIndex).trim();
  const claimText = value.slice(separatorIndex + 1).trim();
  const outcome = SUPPLEMENT_ONBOARDING_OUTCOMES.find(
    (candidate) => candidate.toLowerCase() === outcomeValue.toLowerCase()
  );

  if (!outcome) {
    throw new Error(
      `Unknown claim outcome: ${outcomeValue}. Allowed outcomes: ${SUPPLEMENT_ONBOARDING_OUTCOMES.join(", ")}.`
    );
  }

  if (!claimText) {
    throw new Error("--claim requires claim text after the | separator.");
  }

  return {
    claimText,
    outcome
  };
}

function readTemplate(value: string): SupplementOnboardingClaimTemplateId {
  const template = SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES.find(
    (candidate) => candidate.id.toLowerCase() === value.trim().toLowerCase()
  );

  if (!template) {
    throw new Error(
      `Unknown claim template: ${value}. Allowed templates: ${SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES.map((candidate) => candidate.id).join(", ")}.`
    );
  }

  return template.id;
}

function writeDraft(outputDir: string, slug: string, markdown: string) {
  const normalizedDir = path.normalize(outputDir);
  mkdirSync(normalizedDir, { recursive: true });
  const outputPath = path.join(normalizedDir, `${slug}.md`);
  writeFileSync(outputPath, markdown, "utf8");
  return outputPath;
}

function writeReviewKitFiles(
  outputDir: string,
  kit: SupplementOnboardingReviewKit,
  force: boolean
) {
  return kit.files.map((file) => {
    const outputPath = path.join(path.normalize(outputDir), file.path);
    mkdirSync(path.dirname(outputPath), { recursive: true });

    try {
      writeFileSync(outputPath, file.content, {
        encoding: "utf8",
        flag: force ? "w" : "wx"
      });
    } catch (error) {
      if (isFileExistsError(error)) {
        throw new Error(
          `Review kit file already exists: ${outputPath}. Use --force-review-kit only after reviewing local notes that may be overwritten.`
        );
      }

      throw error;
    }

    return outputPath;
  });
}

function buildBatchReviewKitIndex({
  batch,
  kits,
  outputDir
}: {
  batch: SupplementOnboardingBatchPlan;
  kits: SupplementOnboardingReviewKit[];
  outputDir: string;
}) {
  const normalizedDir = path.normalize(outputDir);
  const kitBySlug = new Map(kits.map((kit) => [kit.slug, kit]));
  const lines = [
    "# Supplement Onboarding Batch Review-Kit Index",
    "",
    `Generated: ${batch.generatedAt}`,
    `Read-only: ${batch.readOnly}`,
    `Human-owned: true`,
    `Local file write only: true`,
    `No auto-write: true`,
    `No database write: true`,
    `No public evidence rows written: true`,
    `No candidate decision: true`,
    `No extraction write: true`,
    `No auto-review: true`,
    `No auto-promotion: true`,
    "",
    "## Batch Progress",
    "",
    `- supplements: ${batch.progress.supplements}`,
    `- draft claims: ${batch.progress.draftClaims}`,
    `- source queries: ${batch.progress.sourceQueries}`,
    `- queue commands after reviewed copy: ${batch.progress.queueCommands}`,
    `- supplements with blockers: ${batch.progress.supplementsWithBlockers}`,
    `- supplements with safety signals: ${batch.progress.supplementsWithSafetySignals}`,
    `- product-status targets: ${batch.progress.productStatusTargets}`,
    "",
    "## Generated Kits",
    "",
    ...batch.priorityQueue.flatMap((item, index) => {
      const kit = kitBySlug.get(item.slug);
      const indexPath = kit?.files[0]?.path ?? `${item.slug}-review-kit/00-index.md`;

      return [
        `${index + 1}. ${item.name} - ${item.tier}`,
        `   Kit index: \`${indexPath}\``,
        `   Action: ${item.action}`,
        `   Counts: ${item.claimDrafts} claim drafts, ${item.blockerCount} blockers, ${item.safetySignals.blocked} blocked safety signals, ${item.safetySignals.warning} safety warnings, ${item.queueCommands.length} queue commands.`,
        `   Rationale: ${item.rationale.join(" ")}`
      ];
    }),
    "",
    "## Review Items",
    "",
    ...batch.batchReviewItems.map((item) => `- ${item}`),
    "",
    "## Boundaries",
    "",
    "- This batch index links local review-kit files only.",
    "- It does not edit seed data or create database intervention, claim, source-candidate, reference, study, AU/TGA, or public evidence rows.",
    "- It does not queue sources, accept or reject candidates, extract studies, mark claim packets reviewed, approve connectors, fetch full text, or promote evidence.",
    "- Queue commands remain explicit post-review commands after reviewed seed/database records exist.",
    "",
    "## Next Action",
    "",
    batch.priorityQueue[0]?.action ??
      "Review each generated supplement kit before seed/data work.",
    ""
  ];

  return {
    content: `${lines.join("\n")}\n`,
    path: path.join(normalizedDir, "batch-review-kit-index.md")
  };
}

function preflightBatchReviewKitOutput({
  force,
  indexPath,
  kits,
  outputDir
}: {
  force: boolean;
  indexPath: string;
  kits: SupplementOnboardingReviewKit[];
  outputDir: string;
}) {
  if (force) {
    return;
  }

  const outputPaths = [
    indexPath,
    ...kits.flatMap((kit) =>
      kit.files.map((file) => path.join(path.normalize(outputDir), file.path))
    )
  ];
  const existingPath = outputPaths.find((outputPath) => existsSync(outputPath));

  if (existingPath) {
    throw new Error(
      `Review kit file already exists: ${existingPath}. Use --force-review-kit only after reviewing local notes that may be overwritten.`
    );
  }
}

function writeLocalFile(outputPath: string, content: string, force: boolean) {
  mkdirSync(path.dirname(outputPath), { recursive: true });

  try {
    writeFileSync(outputPath, content, {
      encoding: "utf8",
      flag: force ? "w" : "wx"
    });
  } catch (error) {
    if (isFileExistsError(error)) {
      throw new Error(
        `Review kit file already exists: ${outputPath}. Use --force-review-kit only after reviewing local notes that may be overwritten.`
      );
    }

    throw error;
  }
}

async function readExistingSeedData() {
  const { australiaRegulatoryStatuses, claims, interventions } = await import(
    "@/lib/seed-data"
  );

  return {
    australiaRegulatoryStatuses,
    claims,
    interventions
  };
}

function isFileExistsError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "code" in error && (error as { code?: unknown }).code === "EEXIST";
}

function readBatchFile(filePath: string) {
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
  const supplements = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { supplements?: unknown }).supplements)
      ? (parsed as { supplements: unknown[] }).supplements
      : undefined;

  if (!supplements) {
    throw new Error("--batch-file must contain a JSON array or an object with supplements[].");
  }

  return supplements.map(readBatchSupplement);
}

function readBatchSupplement(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error("Each batch supplement must be an object.");
  }

  const item = value as Record<string, unknown>;
  const name = readStringProperty(item, "name");

  if (!name) {
    throw new Error("Each batch supplement requires a name.");
  }

  return {
    category: readOptionalCategory(item.category),
    claimTemplateIds: readStringArrayProperty(item, "claimTemplateIds").map(
      readTemplate
    ),
    claims: readBatchClaims(item.claims),
    commonForms: readStringArrayProperty(item, "commonForms"),
    name,
    product: readBatchProduct(item.product),
    region: readStringProperty(item, "region"),
    synonyms: readStringArrayProperty(item, "synonyms")
  };
}

function readBatchProduct(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const item = value as Record<string, unknown>;

  return {
    artgId: readStringProperty(item, "artgId"),
    austNumber: readStringProperty(item, "austNumber"),
    brand: readStringProperty(item, "brand"),
    name: readStringProperty(item, "name"),
    sourceUrl: readStringProperty(item, "sourceUrl"),
    sponsor: readStringProperty(item, "sponsor")
  };
}

function readBatchClaims(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((claim) => {
    if (typeof claim === "string") {
      return readClaim(claim);
    }

    if (!claim || typeof claim !== "object") {
      throw new Error("Batch claims must be strings or objects.");
    }

    const item = claim as Record<string, unknown>;
    const outcome = readStringProperty(item, "outcome");
    const claimText = readStringProperty(item, "claimText");

    if (!outcome || !claimText) {
      throw new Error("Batch claim objects require outcome and claimText.");
    }

    return readClaim(`${outcome}|${claimText}`);
  });
}

function readStringProperty(item: Record<string, unknown>, key: string) {
  const value = item[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArrayProperty(item: Record<string, unknown>, key: string) {
  const value = item[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function readOptionalCategory(value: unknown) {
  return typeof value === "string" && value.trim()
    ? readCategory(value)
    : undefined;
}

function hasProductInput(product: SupplementOnboardingProductInput) {
  return Boolean(
    product.artgId ||
      product.austNumber ||
      product.brand ||
      product.name ||
      product.sourceUrl ||
      product.sponsor
  );
}

function readRequiredValue(args: string[], index: number, option: string) {
  const value = args[index + 1]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function readInlineValue(arg: string, option: string) {
  const value = arg.slice(`${option}=`.length).trim();

  if (!value) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function readListValue(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function helpText() {
  return [
    "Usage: npm run onboard:supplement -- --name <supplement-name> [options]",
    "",
    "Creates a dry-run onboarding packet for a new supplement. It does not mutate seed data, queue jobs, review claims, or publish evidence.",
    "",
    "Options:",
    "  --name <name>                  Supplement/intervention display name.",
    "  --batch-file <path>            JSON array/object of supplements to draft in one read-only batch.",
    "  --category <category>          One app category, for example \"Vitamin/mineral\".",
    "  --synonym <term>               Repeatable synonym/search term.",
    "  --synonyms <a,b,c>             Comma-separated synonyms/search terms.",
    "  --form <form>                  Repeatable common form, for example Capsule.",
    "  --claim \"Outcome|Claim text\"  Repeatable draft claim scope.",
    "  --template <id>                Repeatable claim preset, for example sleep or safety.",
    "  --templates <a,b,c>            Comma-separated claim presets.",
    "  --region <region>              Region metadata for source commands (default AU).",
    "  --product-name <name>          Exact product name for AU/TGA product-status review.",
    "  --product-brand <brand>        Exact product brand for AU/TGA product-status review.",
    "  --aust-number <number>         Product AUST number if visible on label/source.",
    "  --artg-id <id>                 Product ARTG identifier if found.",
    "  --sponsor <name>               Product sponsor/market authorisation holder if found.",
    "  --product-source-url <url>     Product-level source URL reviewed for AU/TGA status.",
    "  --write-draft                  Write docs/codex/onboarding/<slug>.md.",
    "  --write-review-kit             Write docs/codex/onboarding/<slug>-review-kit/*.md without overwriting existing files.",
    "  --force-review-kit             Overwrite review-kit files when --write-review-kit is used.",
    "  --output-dir <path>            Output directory for --write-draft and --write-review-kit.",
    "  --json                         Print JSON instead of Markdown.",
    "  --help                         Show this help.",
    "",
    `Allowed templates: ${SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES.map((template) => `${template.id} (${template.label})`).join(", ")}`,
    `Allowed categories: ${SUPPLEMENT_ONBOARDING_CATEGORIES.join(", ")}`,
    `Allowed outcomes: ${SUPPLEMENT_ONBOARDING_OUTCOMES.join(", ")}`
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
