"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";

import {
  buildSupplementOnboardingPlan,
  getSupplementOnboardingCategoryProfile,
  SUPPLEMENT_ONBOARDING_CATEGORIES,
  SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES,
  SUPPLEMENT_ONBOARDING_OUTCOMES,
  type SupplementOnboardingClaimTemplateId,
  type SupplementOnboardingProductInput
} from "@/lib/supplement-onboarding";
import {
  buildSupplementOnboardingSeedDiffReport,
  type SupplementOnboardingDraftImportPlan,
  type SupplementOnboardingSeedDiffExistingData
} from "@/lib/supplement-onboarding-seed-diff";
import type { InterventionCategory, OutcomeArea } from "@/lib/types";

export function OperatorOnboardingWizard({
  action,
  existingSeedData,
  saveBlockers,
  saveEnabled
}: {
  action: (formData: FormData) => Promise<void>;
  existingSeedData: SupplementOnboardingSeedDiffExistingData;
  saveBlockers: string[];
  saveEnabled: boolean;
}) {
  const [category, setCategory] = useState<InterventionCategory>("Vitamin/mineral");
  const [commonForms, setCommonForms] = useState("");
  const [customClaimOutcome, setCustomClaimOutcome] = useState<OutcomeArea>("Sleep");
  const [customClaimText, setCustomClaimText] = useState("");
  const [name, setName] = useState("");
  const [productArtgId, setProductArtgId] = useState("");
  const [productAustNumber, setProductAustNumber] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [productSourceUrl, setProductSourceUrl] = useState("");
  const [productSponsor, setProductSponsor] = useState("");
  const [region, setRegion] = useState("AU");
  const [selectedTemplates, setSelectedTemplates] = useState<
    SupplementOnboardingClaimTemplateId[]
  >(
    [
      ...(getSupplementOnboardingCategoryProfile("Vitamin/mineral")
        ?.defaultClaimTemplateIds ?? ["safety", "lifespan"])
    ]
  );
  const [synonyms, setSynonyms] = useState("");
  const preview = useMemo(() => {
    if (!name.trim()) {
      return undefined;
    }

    try {
      return buildSupplementOnboardingPlan({
        category,
        claimTemplateIds: selectedTemplates,
        claims: customClaimText.trim()
          ? [
              {
                claimText: customClaimText,
                outcome: customClaimOutcome
              }
            ]
          : [],
        commonForms: splitLinesOrCommas(commonForms),
        name,
        product: productInput({
          artgId: productArtgId,
          austNumber: productAustNumber,
          brand: productBrand,
          name: productName,
          sourceUrl: productSourceUrl,
          sponsor: productSponsor
        }),
        region,
        synonyms: splitLinesOrCommas(synonyms)
      });
    } catch {
      return undefined;
    }
  }, [
    category,
    commonForms,
    customClaimOutcome,
    customClaimText,
    name,
    productArtgId,
    productAustNumber,
    productBrand,
    productName,
    productSourceUrl,
    productSponsor,
    region,
    selectedTemplates,
    synonyms
  ]);
  const importPlan = useMemo(() => {
    if (!preview) {
      return undefined;
    }

    return buildSupplementOnboardingSeedDiffReport({
      existingData: existingSeedData,
      plans: [preview]
    }).items[0]?.importPlan;
  }, [existingSeedData, preview]);

  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Supplement draft</h2>
          <p className="mt-1 text-sm text-slate-600">
            {preview
              ? `${preview.claimDrafts.length} draft claims / ${preview.safetyWatchlist.signals.length} watchlist signals`
              : "Private operator draft"}
          </p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          {saveEnabled ? "Write-gated" : "Read-only"}
        </span>
      </div>

      <form action={action} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Supplement name
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Category
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="category"
                onChange={(event) => {
                  const nextCategory = event.target.value as InterventionCategory;

                  setCategory(nextCategory);
                  setSelectedTemplates(
                    [
                      ...(getSupplementOnboardingCategoryProfile(nextCategory)
                        ?.defaultClaimTemplateIds ?? ["safety", "lifespan"])
                    ]
                  );
                }}
                value={category}
              >
                {SUPPLEMENT_ONBOARDING_CATEGORIES.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Synonyms
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="synonyms"
                onChange={(event) => setSynonyms(event.target.value)}
                value={synonyms}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Forms
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="commonForms"
                onChange={(event) => setCommonForms(event.target.value)}
                value={commonForms}
              />
            </label>
          </div>

          <fieldset className="rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-700">
              Claim templates
            </legend>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES.map((template) => (
                <label
                  className="flex items-start gap-2 text-sm text-slate-700"
                  key={template.id}
                >
                  <input
                    checked={selectedTemplates.includes(template.id)}
                    className="mt-1"
                    name="claimTemplateIds"
                    onChange={() => toggleTemplate(template.id, setSelectedTemplates)}
                    type="checkbox"
                    value={template.id}
                  />
                  <span>
                    <span className="font-medium">{template.label}</span>
                    <span className="block text-slate-500">{template.outcome}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
            <label className="block text-sm font-semibold text-slate-700">
              Custom outcome
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="customClaimOutcome"
                onChange={(event) =>
                  setCustomClaimOutcome(event.target.value as OutcomeArea)
                }
                value={customClaimOutcome}
              >
                {SUPPLEMENT_ONBOARDING_OUTCOMES.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {outcome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Custom claim
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="customClaimText"
                onChange={(event) => setCustomClaimText(event.target.value)}
                value={customClaimText}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
            <label className="block text-sm font-semibold text-slate-700">
              Region
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="region"
                onChange={(event) => setRegion(event.target.value)}
                required
                value={region}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Save note
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="note"
              />
            </label>
          </div>

          <fieldset className="rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-700">
              Product identity
            </legend>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Brand
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  name="productBrand"
                  onChange={(event) => setProductBrand(event.target.value)}
                  value={productBrand}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Product name
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  name="productName"
                  onChange={(event) => setProductName(event.target.value)}
                  value={productName}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                AUST number
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  name="productAustNumber"
                  onChange={(event) => setProductAustNumber(event.target.value)}
                  value={productAustNumber}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                ARTG id
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  name="productArtgId"
                  onChange={(event) => setProductArtgId(event.target.value)}
                  value={productArtgId}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Sponsor
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  name="productSponsor"
                  onChange={(event) => setProductSponsor(event.target.value)}
                  value={productSponsor}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Source URL
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  name="productSourceUrl"
                  onChange={(event) => setProductSourceUrl(event.target.value)}
                  value={productSourceUrl}
                />
              </label>
            </div>
          </fieldset>

          <button
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
            disabled={!saveEnabled || !preview}
            type="submit"
          >
            Save Draft
          </button>
        </div>

        <aside className="rounded-md border border-slate-200 bg-slate-50 p-3">
          {preview ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {preview.interventionDraft.id}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {preview.sourceQueries.length} source queries /{" "}
                  {preview.queueAfterSeedCommands.length} queue commands
                </p>
              </div>
              <PreviewList
                empty="No guardrail warnings"
                items={preview.guardrailWarnings}
                title="Guardrails"
              />
              <PreviewList
                empty="No taxonomy defaults"
                items={[
                  `Templates: ${formatList(preview.taxonomy.autoAppliedClaimTemplateIds)}`,
                  `Default forms: ${formatList(preview.taxonomy.commonFormDefaults)}`,
                  `Synonym hints: ${formatList([
                    ...preview.taxonomy.inferredSynonymHints,
                    ...preview.taxonomy.suggestedSynonymHints
                  ])}`
                ]}
                title="Taxonomy"
              />
              <PreviewList
                empty="No blocking review items"
                items={preview.blockingReviewItems}
                title="Review blockers"
              />
              <PreviewList
                items={preview.handoffCommands.map(
                  (command) => `${command.label}: ${command.command}`
                )}
                title="Handoff commands"
              />
              {importPlan ? <DraftImportPlanPreview importPlan={importPlan} /> : null}
              <PreviewList
                empty="No AU/TGA gaps"
                items={[
                  `Target: ${preview.productStatusAssistant.target.name}`,
                  `Brand: ${preview.productStatusAssistant.target.brand ?? "Not captured"}`,
                  `AUST/ARTG: ${
                    preview.productStatusAssistant.target.austNumber ??
                    preview.productStatusAssistant.target.artgId ??
                    "Not captured"
                  }`,
                  ...preview.productStatusAssistant.gapAssessment
                ]}
                title="AU/TGA product status"
              />
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Draft claims</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {preview.claimDrafts.map((claim) => (
                    <li key={claim.id}>
                      <span className="font-medium">{claim.outcome}</span>
                      <span className="block text-slate-600">{claim.claimText}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {!saveEnabled && saveBlockers.length > 0 ? (
                <PreviewList items={saveBlockers} title="Save gate" />
              ) : null}
            </div>
          ) : (
            <PreviewList
              items={saveBlockers}
              title={saveEnabled ? "Draft preview" : "Save gate"}
            />
          )}
        </aside>
      </form>
    </section>
  );
}

export function draftImportPlanPreviewItems(
  importPlan: SupplementOnboardingDraftImportPlan
) {
  return [
    `Status: ${importPlan.status.replace(/-/g, " ")}`,
    `Recommended path: ${importPlan.recommendedPath.replace(/-/g, " ")}`,
    `Seed copy: ${importPlan.seedCopy.status.replace(/-/g, " ")}. ${importPlan.seedCopy.nextAction}`,
    `Database import: ${importPlan.databaseImport.status.replace(/-/g, " ")}. ${importPlan.databaseImport.nextAction}`,
    `No auto-write: ${importPlan.noAutoWrite}`,
    `No database write: ${importPlan.noDatabaseWrite}`,
    `No public evidence rows written: ${importPlan.noPublicEvidenceRowsWritten}`,
    `No auto-promotion: ${importPlan.noAutoPromotion}`
  ];
}

function DraftImportPlanPreview({
  importPlan
}: {
  importPlan: SupplementOnboardingDraftImportPlan;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">Draft import plan</h3>
      <ul className="mt-2 space-y-1 text-sm text-slate-700">
        {draftImportPlanPreviewItems(importPlan).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function PreviewList({
  empty,
  items,
  title
}: {
  empty?: string;
  items: string[];
  title: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {items.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty ?? "None"}</p>
      )}
    </div>
  );
}

function splitLinesOrCommas(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function productInput(
  input: Record<keyof SupplementOnboardingProductInput, string>
): SupplementOnboardingProductInput | undefined {
  const product = {
    artgId: optionalTrim(input.artgId),
    austNumber: optionalTrim(input.austNumber),
    brand: optionalTrim(input.brand),
    name: optionalTrim(input.name),
    sourceUrl: optionalTrim(input.sourceUrl),
    sponsor: optionalTrim(input.sponsor)
  };

  return Object.values(product).some(Boolean) ? product : undefined;
}

function optionalTrim(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "None";
}

function toggleTemplate(
  templateId: SupplementOnboardingClaimTemplateId,
  setSelectedTemplates: Dispatch<SetStateAction<SupplementOnboardingClaimTemplateId[]>>
) {
  setSelectedTemplates((current) =>
    current.includes(templateId)
      ? current.filter((candidate) => candidate !== templateId)
      : [...current, templateId]
  );
}
