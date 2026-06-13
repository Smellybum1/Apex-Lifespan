import { pathToFileURL } from "node:url";

import {
  SUPPLEMENT_ONBOARDING_CATEGORIES,
  SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES,
  SUPPLEMENT_ONBOARDING_OUTCOMES,
  type SupplementOnboardingClaimInput,
  type SupplementOnboardingClaimTemplateId,
  type SupplementOnboardingProductInput
} from "@/lib/supplement-onboarding";
import {
  buildSupplementOnboardingRehearsalReport,
  summarizeSupplementOnboardingRehearsalReport,
  supplementOnboardingRehearsalToMarkdown
} from "@/lib/supplement-onboarding-rehearsal";
import type { InterventionCategory } from "@/lib/types";

interface OnboardingRehearsalArgs {
  category?: InterventionCategory;
  claimTemplateIds: SupplementOnboardingClaimTemplateId[];
  claims: SupplementOnboardingClaimInput[];
  commonForms: string[];
  markdown: boolean;
  name?: string;
  product: SupplementOnboardingProductInput;
  region: string;
  summary: boolean;
  synonyms: string[];
}

async function main() {
  const args = readArgs(process.argv.slice(2));

  if (!args.name) {
    throw new Error(helpText());
  }

  const report = buildSupplementOnboardingRehearsalReport({
    category: args.category,
    claimTemplateIds: args.claimTemplateIds,
    claims: args.claims,
    commonForms: args.commonForms,
    name: args.name,
    product: hasProductInput(args.product) ? args.product : undefined,
    region: args.region,
    synonyms: args.synonyms
  });

  if (args.markdown) {
    console.log(supplementOnboardingRehearsalToMarkdown(report));
    return;
  }

  console.log(
    JSON.stringify(
      args.summary ? summarizeSupplementOnboardingRehearsalReport(report) : report,
      null,
      2
    )
  );
}

function readArgs(args: string[]): OnboardingRehearsalArgs {
  const parsed: OnboardingRehearsalArgs = {
    claimTemplateIds: [],
    claims: [],
    commonForms: [],
    markdown: false,
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

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--markdown") {
      parsed.markdown = true;
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

    if (arg === "--claim") {
      parsed.claims.push(readClaim(readRequiredValue(args, index, arg)));
      index += 1;
      continue;
    }

    if (arg.startsWith("--claim=")) {
      parsed.claims.push(readClaim(readInlineValue(arg, "--claim")));
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

    throw new Error(`Unknown onboarding rehearsal option: ${arg}\n\n${helpText()}`);
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

function helpText() {
  return [
    "Usage: npm run onboarding:rehearsal -- --name <supplement> [--category <category>] [--template <id>] [--claim \"Outcome|Claim text\"] [--summary|--markdown]",
    "",
    `Categories: ${SUPPLEMENT_ONBOARDING_CATEGORIES.join(", ")}`,
    `Templates: ${SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES.map((template) => template.id).join(", ")}`
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
