import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  buildSupplementOnboardingBatchPlan,
  buildSupplementOnboardingPlan,
  SUPPLEMENT_ONBOARDING_CATEGORIES,
  SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES,
  SUPPLEMENT_ONBOARDING_OUTCOMES,
  type SupplementOnboardingClaimInput,
  type SupplementOnboardingClaimTemplateId,
  type SupplementOnboardingInput,
  type SupplementOnboardingProductInput
} from "@/lib/supplement-onboarding";
import {
  buildSupplementOnboardingImportAssistantReport,
  summarizeSupplementOnboardingImportAssistantReport,
  supplementOnboardingImportAssistantReportToMarkdown
} from "@/lib/supplement-onboarding-import-assistant";
import {
  buildSupplementOnboardingSeedDiffReport,
  summarizeSupplementOnboardingSeedDiffReport,
  supplementOnboardingSeedDiffReportToMarkdown
} from "@/lib/supplement-onboarding-seed-diff";
import type { InterventionCategory } from "@/lib/types";

interface OnboardingSeedDiffArgs {
  batchFilePath?: string;
  category?: InterventionCategory;
  claimTemplateIds: SupplementOnboardingClaimTemplateId[];
  claims: SupplementOnboardingClaimInput[];
  commonForms: string[];
  importAssistant: boolean;
  json: boolean;
  name?: string;
  product: SupplementOnboardingProductInput;
  region: string;
  summary: boolean;
  synonyms: string[];
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const { australiaRegulatoryStatuses, claims, interventions } = await import(
    "@/lib/seed-data"
  );
  const plans = args.batchFilePath
    ? buildSupplementOnboardingBatchPlan({
        supplements: readBatchFile(args.batchFilePath)
      }).plans
    : [
        buildSupplementOnboardingPlan({
          category: args.category,
          claimTemplateIds: args.claimTemplateIds,
          claims: args.claims,
          commonForms: args.commonForms,
          name: readRequiredName(args.name),
          product: hasProductInput(args.product) ? args.product : undefined,
          region: args.region,
          synonyms: args.synonyms
        })
      ];
  const report = buildSupplementOnboardingSeedDiffReport({
    existingData: {
      australiaRegulatoryStatuses,
      claims,
      interventions
    },
    plans
  });

  if (args.importAssistant) {
    const importAssistantReport = buildSupplementOnboardingImportAssistantReport({
      plans,
      seedDiffReport: report
    });

    if (args.json || args.summary) {
      console.log(
        JSON.stringify(
          args.summary
            ? summarizeSupplementOnboardingImportAssistantReport(importAssistantReport)
            : importAssistantReport,
          null,
          2
        )
      );
      return;
    }

    console.log(supplementOnboardingImportAssistantReportToMarkdown(importAssistantReport));
    return;
  }

  if (args.json || args.summary) {
    console.log(
      JSON.stringify(args.summary ? summarizeSupplementOnboardingSeedDiffReport(report) : report, null, 2)
    );
    return;
  }

  console.log(supplementOnboardingSeedDiffReportToMarkdown(report));
}

function readArgs(args: string[]): OnboardingSeedDiffArgs {
  const parsed: OnboardingSeedDiffArgs = {
    claimTemplateIds: [],
    claims: [],
    commonForms: [],
    importAssistant: false,
    json: false,
    product: {},
    region: "AU",
    summary: false,
    synonyms: []
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

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--import-assistant") {
      parsed.importAssistant = true;
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

    if (arg === "--claim") {
      parsed.claims.push(readClaim(readRequiredValue(args, index, arg)));
      index += 1;
      continue;
    }

    if (arg.startsWith("--claim=")) {
      parsed.claims.push(readClaim(readInlineValue(arg, "--claim")));
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

    throw new Error(`Unknown onboarding seed-diff option: ${arg}\n\n${helpText()}`);
  }

  return parsed;
}

function readBatchFile(filePath: string): SupplementOnboardingInput[] {
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

function readBatchSupplement(value: unknown): SupplementOnboardingInput {
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

function readBatchClaims(value: unknown): SupplementOnboardingClaimInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    if (typeof item === "string") {
      return readClaim(item);
    }

    if (!item || typeof item !== "object") {
      throw new Error("Batch claims must be strings or objects.");
    }

    const claim = item as Record<string, unknown>;
    const outcomeValue = readStringProperty(claim, "outcome");
    const claimText = readStringProperty(claim, "claimText");
    const outcome = outcomeValue ? readOutcome(outcomeValue) : undefined;

    if (!outcome || !claimText) {
      throw new Error("Batch claim objects require outcome and claimText.");
    }

    return {
      claimText,
      outcome
    };
  });
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

function readOptionalCategory(value: unknown) {
  return typeof value === "string" && value.trim() ? readCategory(value) : undefined;
}

function readOutcome(value: string) {
  const outcome = SUPPLEMENT_ONBOARDING_OUTCOMES.find(
    (candidate) => candidate.toLowerCase() === value.trim().toLowerCase()
  );

  if (!outcome) {
    throw new Error(
      `Unknown claim outcome: ${value}. Allowed outcomes: ${SUPPLEMENT_ONBOARDING_OUTCOMES.join(", ")}.`
    );
  }

  return outcome;
}

function readClaim(value: string): SupplementOnboardingClaimInput {
  const separatorIndex = value.indexOf("|");

  if (separatorIndex === -1) {
    throw new Error(
      `--claim must use "Outcome|Claim text". Allowed outcomes: ${SUPPLEMENT_ONBOARDING_OUTCOMES.join(", ")}.`
    );
  }

  const outcome = readOutcome(value.slice(0, separatorIndex));
  const claimText = value.slice(separatorIndex + 1).trim();

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

function readRequiredName(value: string | undefined) {
  if (!value?.trim()) {
    throw new Error(helpText());
  }

  return value;
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

function readStringProperty(item: Record<string, unknown>, key: string) {
  const value = item[key];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArrayProperty(item: Record<string, unknown>, key: string) {
  const value = item[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function hasProductInput(product: SupplementOnboardingProductInput) {
  return Object.values(product).some((value) => typeof value === "string" && value.trim());
}

function helpText() {
  return [
    "Usage:",
    "  npm run onboarding:seed-diff -- --name <supplement> [--category <category>] [--template <id>] [--claim \"Outcome|Claim text\"] [--summary|--json]",
    "  npm run onboarding:seed-diff -- --import-assistant --name <supplement> [--summary|--json]",
    "  npm run onboarding:seed-diff -- --batch-file <path> [--summary|--json]",
    "",
    "The seed diff helper is read-only. It prints copy-review snippets, import-assistant plans, and validation commands; it never edits seed data, writes database rows, queues sources, reviews packets, or promotes evidence."
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
