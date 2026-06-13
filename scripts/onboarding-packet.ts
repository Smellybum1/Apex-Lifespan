import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import { parseFullTextSourceInventory } from "@/lib/full-text-source-readiness";
import {
  buildDraftBatchSupplementOnboardingPacket,
  buildDraftSupplementOnboardingPacket,
  buildExistingBatchSupplementOnboardingPacket,
  buildExistingSupplementOnboardingPacket,
  summarizeSupplementOnboardingPacketReport,
  supplementOnboardingPacketReportToMarkdown
} from "@/lib/supplement-onboarding-packet";
import {
  SUPPLEMENT_ONBOARDING_CATEGORIES,
  SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES,
  SUPPLEMENT_ONBOARDING_OUTCOMES,
  type SupplementOnboardingClaimInput,
  type SupplementOnboardingClaimTemplateId,
  type SupplementOnboardingInput,
  type SupplementOnboardingProductInput
} from "@/lib/supplement-onboarding";
import type { InterventionCategory } from "@/lib/types";

process.env.APEX_PRISMA_LOG ??= "silent";

interface OnboardingPacketArgs {
  batchFilePath?: string;
  category?: InterventionCategory;
  claimTemplateIds: SupplementOnboardingClaimTemplateId[];
  claims: SupplementOnboardingClaimInput[];
  commonForms: string[];
  envFilePath?: string;
  fullTextInventoryFilePath?: string;
  json: boolean;
  name?: string;
  product: SupplementOnboardingProductInput;
  region: string;
  summary: boolean;
  supplement?: string;
  supplements: string[];
  synonyms: string[];
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const requestedModes = [
    Boolean(args.batchFilePath),
    Boolean(args.name),
    Boolean(args.supplement),
    args.supplements.length > 0
  ].filter(Boolean).length;

  if (requestedModes > 1) {
    throw new Error(
      "Use one packet mode: --name, --batch-file, --supplement, or --supplements."
    );
  }

  if (args.batchFilePath) {
    await printDraftBatchPacket(args);
    return;
  }

  if (args.supplements.length > 0) {
    await printExistingBatchPacket(args);
    return;
  }

  if (args.supplement) {
    await printExistingPacket(args);
    return;
  }

  if (args.name) {
    await printDraftPacket(args);
    return;
  }

  throw new Error(helpText());
}

async function printDraftPacket(args: OnboardingPacketArgs) {
  const { australiaRegulatoryStatuses, claims, interventions } = await import(
    "@/lib/seed-data"
  );
  const report = buildDraftSupplementOnboardingPacket({
    existingSeedData: {
      australiaRegulatoryStatuses,
      claims,
      interventions
    },
    input: {
      category: args.category,
      claimTemplateIds: args.claimTemplateIds,
      claims: args.claims,
      commonForms: args.commonForms,
      name: args.name ?? "",
      product: hasProductInput(args.product) ? args.product : undefined,
      region: args.region,
      synonyms: args.synonyms
    }
  });

  printPacket(report, args);
}

async function printDraftBatchPacket(args: OnboardingPacketArgs) {
  const { australiaRegulatoryStatuses, claims, interventions } = await import(
    "@/lib/seed-data"
  );
  const report = buildDraftBatchSupplementOnboardingPacket({
    existingSeedData: {
      australiaRegulatoryStatuses,
      claims,
      interventions
    },
    inputs: await readBatchFile(args.batchFilePath ?? "")
  });

  printPacket(report, args);
}

async function printExistingPacket(args: OnboardingPacketArgs) {
  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const { getEvidenceDashboardData } = await import("@/lib/data/dashboard");
    const { readSupplementOnboardingSourceSignals } = await import(
      "@/lib/supplement-onboarding-source-signals"
    );
    const data = await getEvidenceDashboardData();
    const sourceSignals = await readSupplementOnboardingSourceSignals({
      data,
      supplementQuery: args.supplement
    });
    const fullTextSourceInventory = args.fullTextInventoryFilePath
      ? parseFullTextSourceInventory(
          JSON.parse(await readFile(args.fullTextInventoryFilePath, "utf8")) as unknown
        )
      : undefined;
    const report = buildExistingSupplementOnboardingPacket({
      data,
      fullTextInventoryPath: args.fullTextInventoryFilePath,
      fullTextSourceInventory,
      sourceSignals,
      supplementQuery: args.supplement ?? ""
    });

    printPacket(report, args);
  });
}

async function printExistingBatchPacket(args: OnboardingPacketArgs) {
  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const { getEvidenceDashboardData } = await import("@/lib/data/dashboard");
    const { readSupplementOnboardingSourceSignals } = await import(
      "@/lib/supplement-onboarding-source-signals"
    );
    const data = await getEvidenceDashboardData();
    const sourceSignals = await Promise.all(
      args.supplements.map(async (supplementQuery) => ({
        sourceSignals: await readSupplementOnboardingSourceSignals({
          data,
          supplementQuery
        }),
        supplementQuery
      }))
    );
    const fullTextSourceInventory = args.fullTextInventoryFilePath
      ? parseFullTextSourceInventory(
          JSON.parse(await readFile(args.fullTextInventoryFilePath, "utf8")) as unknown
        )
      : undefined;
    const report = buildExistingBatchSupplementOnboardingPacket({
      data,
      fullTextInventoryPath: args.fullTextInventoryFilePath,
      fullTextSourceInventory,
      supplements: sourceSignals
    });

    printPacket(report, args);
  });
}

function printPacket(
  report: Parameters<typeof summarizeSupplementOnboardingPacketReport>[0],
  args: Pick<OnboardingPacketArgs, "json" | "summary">
) {
  if (args.json || args.summary) {
    console.log(
      JSON.stringify(
        args.summary ? summarizeSupplementOnboardingPacketReport(report) : report,
        null,
        2
      )
    );
    return;
  }

  console.log(supplementOnboardingPacketReportToMarkdown(report));
}

function readArgs(args: string[]): OnboardingPacketArgs {
  const parsed: OnboardingPacketArgs = {
    claimTemplateIds: [],
    claims: [],
    commonForms: [],
    json: false,
    product: {},
    region: "AU",
    summary: false,
    supplements: [],
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

    if (arg === "--name") {
      parsed.name = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--name=")) {
      parsed.name = readInlineValue(arg, "--name");
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

    if (arg === "--supplement") {
      parsed.supplement = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--supplements") {
      parsed.supplements.push(...readListValue(readRequiredValue(args, index, arg)));
      index += 1;
      continue;
    }

    if (arg.startsWith("--supplements=")) {
      parsed.supplements.push(...readListValue(readInlineValue(arg, "--supplements")));
      continue;
    }

    if (arg.startsWith("--supplement=")) {
      parsed.supplement = readInlineValue(arg, "--supplement");
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

    if (arg === "--env-file") {
      parsed.envFilePath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      parsed.envFilePath = readInlineValue(arg, "--env-file");
      continue;
    }

    if (arg === "--fulltext-inventory-file") {
      parsed.fullTextInventoryFilePath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--fulltext-inventory-file=")) {
      parsed.fullTextInventoryFilePath = readInlineValue(
        arg,
        "--fulltext-inventory-file"
      );
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

    throw new Error(`Unknown onboarding packet option: ${arg}\n\n${helpText()}`);
  }

  return parsed;
}

async function readBatchFile(filePath: string): Promise<SupplementOnboardingInput[]> {
  const raw = await readFile(filePath, "utf8");
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
  const product = {
    artgId: readStringProperty(item, "artgId"),
    austNumber: readStringProperty(item, "austNumber"),
    brand: readStringProperty(item, "brand"),
    name: readStringProperty(item, "name"),
    sourceUrl: readStringProperty(item, "sourceUrl"),
    sponsor: readStringProperty(item, "sponsor")
  };

  return hasProductInput(product) ? product : undefined;
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

function readClaim(value: string): SupplementOnboardingClaimInput {
  const separatorIndex = value.indexOf("|");

  if (separatorIndex === -1) {
    throw new Error(
      `--claim must use "Outcome|Claim text". Allowed outcomes: ${SUPPLEMENT_ONBOARDING_OUTCOMES.join(", ")}.`
    );
  }

  const outcomeValue = value.slice(0, separatorIndex).trim();
  const claimText = value.slice(separatorIndex + 1).trim();
  const outcome = readOutcome(outcomeValue);

  if (!claimText) {
    throw new Error("--claim requires claim text after the | separator.");
  }

  return {
    claimText,
    outcome
  };
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

function readOptionalCategory(value: unknown) {
  return typeof value === "string" && value.trim() ? readCategory(value) : undefined;
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
    "  npm run onboarding:packet -- --name <supplement-name> [--category <category>] [--template <id>] [--summary|--json]",
    "  npm run onboarding:packet -- --batch-file <path> [--summary|--json]",
    "  npm run onboarding:packet -- --supplement <intervention-id-or-slug> [--env-file <path>] [--fulltext-inventory-file <path>] [--summary|--json]",
    "  npm run onboarding:packet -- --supplements <id-or-slug,id-or-slug> [--env-file <path>] [--fulltext-inventory-file <path>] [--summary|--json]",
    "",
    "Builds a one-command onboarding packet. Batch modes keep each supplement isolated. The command is read-only: it does not edit seed data, write database rows, queue sources, accept/reject candidates, extract studies, mark claims reviewed, approve connectors, fetch full text, or promote evidence.",
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
