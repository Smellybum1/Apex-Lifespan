import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

interface FullTextSourceReadinessArgs {
  allSources: boolean;
  connectorApprovalPacket: boolean;
  connectorPlan: boolean;
  connectorReview: boolean;
  force: boolean;
  fixtureMatrix: boolean;
  inventoryFilePath?: string;
  next: boolean;
  progress: boolean;
  sourceId?: string;
  summary: boolean;
  template: boolean;
  worksheet: boolean;
  writeConnectorApprovalPacketPath?: string;
  writeConnectorPlanPath?: string;
  writeConnectorPrepKitDir?: string;
  writeConnectorReviewPath?: string;
  writeReviewKitDir?: string;
  writeTemplatePath?: string;
  writeWorksheetPath?: string;
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const {
    buildFullTextSourceInventoryTemplate,
    buildFullTextSourceInventoryNextActionPlan,
    buildFullTextSourceInventoryProgressReport,
    buildFullTextSourceFixtureScenarioMatrix,
    buildFullTextSourceReviewKit,
    buildFullTextSourceReviewWorksheet,
    buildFullTextSourceReadinessReport,
    buildFullTextConnectorApprovalPacket,
    buildFullTextConnectorImplementationPlan,
    buildFullTextConnectorPrepKit,
    buildFullTextConnectorReviewDraft,
    fullTextConnectorApprovalPacketToMarkdown,
    fullTextConnectorImplementationPlanToMarkdown,
    fullTextConnectorReviewDraftToMarkdown,
    fullTextSourceReviewWorksheetToMarkdown,
    parseFullTextSourceInventory,
    summarizeFullTextConnectorApprovalPacket,
    summarizeFullTextSourceFixtureScenarioMatrix,
    summarizeFullTextSourceInventoryNextActionPlan,
    summarizeFullTextConnectorImplementationPlan,
    summarizeFullTextConnectorReviewDraft,
    summarizeFullTextSourceInventoryProgressReport,
    summarizeFullTextSourceReadinessReport
  } = await import("@/lib/full-text-source-readiness");
  const inventory = args.inventoryFilePath
    ? parseFullTextSourceInventory(
        JSON.parse(await readFile(args.inventoryFilePath, "utf8")) as unknown
      )
    : undefined;

  if (args.fixtureMatrix) {
    const matrix = buildFullTextSourceFixtureScenarioMatrix();

    console.log(
      JSON.stringify(
        args.summary ? summarizeFullTextSourceFixtureScenarioMatrix(matrix) : matrix,
        null,
        2
      )
    );
    return;
  }

  if (args.writeReviewKitDir) {
    const kit = buildFullTextSourceReviewKit({
      includeAllSources: args.allSources,
      inventory,
      outputDir: args.writeReviewKitDir,
      sourceId: args.sourceId
    });

    await writeReviewKitFiles(kit.files, args.force);
    console.log(
      JSON.stringify(
        {
          files: kit.files.map((file) => ({
            kind: file.kind,
            path: file.path
          })),
          nextAction: kit.nextAction,
          noAutoApproval: kit.noAutoApproval,
          noConnectorApproval: kit.noConnectorApproval,
          noLiveFetch: kit.noLiveFetch,
          outputDir: kit.outputDir,
          sourceId: kit.source.id,
          sourceWorksheets: kit.summary.sourceWorksheets,
          status: "written"
        },
        null,
        2
      )
    );
    return;
  }

  if (args.writeConnectorPrepKitDir) {
    const kit = buildFullTextConnectorPrepKit({
      inventory,
      inventoryFilePath: args.inventoryFilePath,
      outputDir: args.writeConnectorPrepKitDir
    });

    await writeReviewKitFiles(kit.files, args.force);
    console.log(
      JSON.stringify(
        {
          approvalGranted: kit.approvalGranted,
          files: kit.files.map((file) => ({
            kind: file.kind,
            path: file.path
          })),
          nextAction: kit.nextAction,
          noConnectorApproval: kit.noConnectorApproval,
          noImplementationApproval: kit.noImplementationApproval,
          noLiveFetch: kit.noLiveFetch,
          noNetworkFetch: kit.noNetworkFetch,
          outputDir: kit.outputDir,
          fixtureTemplates: kit.summary.fixtureTemplates,
          readyForApprovalSources: kit.summary.readyForApprovalSources,
          readyForFixtureDesignSources: kit.summary.readyForFixtureDesignSources,
          readyForReviewSources: kit.summary.readyForReviewSources,
          status: "written"
        },
        null,
        2
      )
    );
    return;
  }

  if (args.template || args.writeTemplatePath) {
    const template = buildFullTextSourceInventoryTemplate({ inventory });
    const payload = `${JSON.stringify(template, null, 2)}\n`;

    if (args.writeTemplatePath) {
      await writeTemplateFile(args.writeTemplatePath, payload, args.force);
      console.log(
        JSON.stringify(
          {
            nextAction: template.nextAction,
            path: args.writeTemplatePath,
            sources: template.sources.length,
            status: "written"
          },
          null,
          2
        )
      );
      return;
    }

    console.log(payload.trimEnd());
    return;
  }

  if (args.worksheet || args.writeWorksheetPath) {
    const worksheet = buildFullTextSourceReviewWorksheet({
      inventory,
      sourceId: args.sourceId
    });
    const payload = fullTextSourceReviewWorksheetToMarkdown(worksheet);

    if (args.writeWorksheetPath) {
      await writeOutputFile(args.writeWorksheetPath, payload, args.force);
      console.log(
        JSON.stringify(
          {
            nextAction: worksheet.nextAction,
            path: args.writeWorksheetPath,
            sourceId: worksheet.source.id,
            status: "written"
          },
          null,
          2
        )
      );
      return;
    }

    console.log(payload.trimEnd());
    return;
  }

  if (args.connectorPlan || args.writeConnectorPlanPath) {
    const plan = buildFullTextConnectorImplementationPlan({
      inventory,
      inventoryFilePath: args.inventoryFilePath
    });
    const payload = fullTextConnectorImplementationPlanToMarkdown(plan);

    if (args.writeConnectorPlanPath) {
      await writeOutputFile(args.writeConnectorPlanPath, payload, args.force);
      console.log(
        JSON.stringify(
          {
            nextAction: plan.nextAction,
            path: args.writeConnectorPlanPath,
            readyForFixtureDesignSources:
              plan.summary.readyForFixtureDesignSources,
            status: "written"
          },
          null,
          2
        )
      );
      return;
    }

    console.log(
      args.summary
        ? JSON.stringify(summarizeFullTextConnectorImplementationPlan(plan), null, 2)
        : payload.trimEnd()
    );
    return;
  }

  if (args.connectorApprovalPacket || args.writeConnectorApprovalPacketPath) {
    const packet = buildFullTextConnectorApprovalPacket({
      inventory,
      inventoryFilePath: args.inventoryFilePath
    });
    const payload = fullTextConnectorApprovalPacketToMarkdown(packet);

    if (args.writeConnectorApprovalPacketPath) {
      await writeOutputFile(args.writeConnectorApprovalPacketPath, payload, args.force);
      console.log(
        JSON.stringify(
          {
            nextAction: packet.nextAction,
            path: args.writeConnectorApprovalPacketPath,
            readyForApprovalSources: packet.summary.readyForApprovalSources,
            status: "written"
          },
          null,
          2
        )
      );
      return;
    }

    console.log(
      args.summary
        ? JSON.stringify(summarizeFullTextConnectorApprovalPacket(packet), null, 2)
        : payload.trimEnd()
    );
    return;
  }

  if (args.connectorReview || args.writeConnectorReviewPath) {
    const draft = buildFullTextConnectorReviewDraft({
      inventory,
      inventoryFilePath: args.inventoryFilePath
    });
    const payload = fullTextConnectorReviewDraftToMarkdown(draft);

    if (args.writeConnectorReviewPath) {
      await writeOutputFile(args.writeConnectorReviewPath, payload, args.force);
      console.log(
        JSON.stringify(
          {
            nextAction: draft.nextAction,
            path: args.writeConnectorReviewPath,
            readyForReviewSources: draft.summary.readyForReviewSources,
            status: "written"
          },
          null,
          2
        )
      );
      return;
    }

    console.log(
      args.summary
        ? JSON.stringify(summarizeFullTextConnectorReviewDraft(draft), null, 2)
        : payload.trimEnd()
    );
    return;
  }

  if (args.next) {
    const plan = buildFullTextSourceInventoryNextActionPlan({
      inventory,
      inventoryFilePath: args.inventoryFilePath
    });

    console.log(
      JSON.stringify(
        args.summary ? summarizeFullTextSourceInventoryNextActionPlan(plan) : plan,
        null,
        2
      )
    );
    return;
  }

  if (args.progress) {
    const progress = buildFullTextSourceInventoryProgressReport({ inventory });

    console.log(
      JSON.stringify(
        args.summary ? summarizeFullTextSourceInventoryProgressReport(progress) : progress,
        null,
        2
      )
    );
    return;
  }

  const report = buildFullTextSourceReadinessReport({ inventory });

  console.log(
    JSON.stringify(
      args.summary ? summarizeFullTextSourceReadinessReport(report) : report,
      null,
      2
    )
  );
}

function readArgs(args: string[]): FullTextSourceReadinessArgs {
  const parsed: FullTextSourceReadinessArgs = {
    allSources: false,
    connectorApprovalPacket: false,
    connectorPlan: false,
    connectorReview: false,
    force: false,
    fixtureMatrix: false,
    next: false,
    progress: false,
    summary: false,
    template: false,
    worksheet: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--fixture-matrix") {
      parsed.fixtureMatrix = true;
      continue;
    }

    if (arg === "--template") {
      parsed.template = true;
      continue;
    }

    if (arg === "--progress") {
      parsed.progress = true;
      continue;
    }

    if (arg === "--next") {
      parsed.next = true;
      continue;
    }

    if (arg === "--connector-review") {
      parsed.connectorReview = true;
      continue;
    }

    if (arg === "--connector-plan") {
      parsed.connectorPlan = true;
      continue;
    }

    if (arg === "--connector-approval-packet") {
      parsed.connectorApprovalPacket = true;
      continue;
    }

    if (arg === "--worksheet") {
      parsed.worksheet = true;
      continue;
    }

    if (arg === "--force") {
      parsed.force = true;
      continue;
    }

    if (arg === "--all-sources") {
      parsed.allSources = true;
      continue;
    }

    if (arg === "--inventory-file") {
      parsed.inventoryFilePath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--inventory-file=")) {
      parsed.inventoryFilePath = readInlineValue(arg, "--inventory-file");
      continue;
    }

    if (arg === "--source-id") {
      parsed.sourceId = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--source-id=")) {
      parsed.sourceId = readInlineValue(arg, "--source-id");
      continue;
    }

    if (arg === "--write-template") {
      parsed.writeTemplatePath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--write-template=")) {
      parsed.writeTemplatePath = readInlineValue(arg, "--write-template");
      continue;
    }

    if (arg === "--write-worksheet") {
      parsed.writeWorksheetPath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--write-worksheet=")) {
      parsed.writeWorksheetPath = readInlineValue(arg, "--write-worksheet");
      continue;
    }

    if (arg === "--write-connector-review") {
      parsed.writeConnectorReviewPath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--write-connector-review=")) {
      parsed.writeConnectorReviewPath = readInlineValue(arg, "--write-connector-review");
      continue;
    }

    if (arg === "--write-connector-plan") {
      parsed.writeConnectorPlanPath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--write-connector-plan=")) {
      parsed.writeConnectorPlanPath = readInlineValue(arg, "--write-connector-plan");
      continue;
    }

    if (arg === "--write-connector-prep-kit") {
      parsed.writeConnectorPrepKitDir = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--write-connector-prep-kit=")) {
      parsed.writeConnectorPrepKitDir = readInlineValue(arg, "--write-connector-prep-kit");
      continue;
    }

    if (arg === "--write-connector-approval-packet") {
      parsed.writeConnectorApprovalPacketPath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--write-connector-approval-packet=")) {
      parsed.writeConnectorApprovalPacketPath = readInlineValue(arg, "--write-connector-approval-packet");
      continue;
    }

    if (arg === "--write-review-kit") {
      parsed.writeReviewKitDir = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--write-review-kit=")) {
      parsed.writeReviewKitDir = readInlineValue(arg, "--write-review-kit");
      continue;
    }

    throw new Error(`Unknown full-text source readiness option: ${arg}`);
  }

  if (
    parsed.force &&
    !parsed.writeTemplatePath &&
    !parsed.writeWorksheetPath &&
    !parsed.writeConnectorPlanPath &&
    !parsed.writeConnectorPrepKitDir &&
    !parsed.writeConnectorReviewPath &&
    !parsed.writeConnectorApprovalPacketPath &&
    !parsed.writeReviewKitDir
  ) {
    throw new Error(
      "--force is only supported with --write-template, --write-worksheet, --write-connector-review, --write-connector-plan, --write-connector-prep-kit, --write-connector-approval-packet, or --write-review-kit."
    );
  }

  if (parsed.sourceId && parsed.allSources) {
    throw new Error("--source-id cannot be combined with --all-sources.");
  }

  if (parsed.sourceId && !parsed.worksheet && !parsed.writeWorksheetPath && !parsed.writeReviewKitDir) {
    throw new Error("--source-id is only supported with --worksheet, --write-worksheet, or --write-review-kit.");
  }

  if (parsed.allSources && !parsed.writeReviewKitDir) {
    throw new Error("--all-sources is only supported with --write-review-kit.");
  }

  const wantsConnectorPlan = parsed.connectorPlan || Boolean(parsed.writeConnectorPlanPath);
  const wantsConnectorPrepKit = Boolean(parsed.writeConnectorPrepKitDir);
  const wantsConnectorReview = parsed.connectorReview || Boolean(parsed.writeConnectorReviewPath);
  const wantsConnectorApprovalPacket =
    parsed.connectorApprovalPacket || Boolean(parsed.writeConnectorApprovalPacketPath);
  const wantsReviewKit = Boolean(parsed.writeReviewKitDir);
  const wantsTemplate = parsed.template || Boolean(parsed.writeTemplatePath);
  const wantsWorksheet = parsed.worksheet || Boolean(parsed.writeWorksheetPath);

  if (
    parsed.fixtureMatrix &&
    (wantsTemplate ||
      wantsWorksheet ||
      parsed.next ||
      parsed.progress ||
      wantsConnectorPlan ||
      wantsConnectorPrepKit ||
      wantsConnectorReview ||
      wantsConnectorApprovalPacket ||
      wantsReviewKit ||
      Boolean(parsed.inventoryFilePath) ||
      Boolean(parsed.sourceId))
  ) {
    throw new Error(
      "--fixture-matrix cannot be combined with inventory, template, worksheet, review-kit, next, progress, connector-plan, connector-review, connector-approval-packet, or source-id output."
    );
  }

  if (
    parsed.next &&
    (wantsTemplate ||
      wantsWorksheet ||
      wantsConnectorPlan ||
      wantsConnectorPrepKit ||
      wantsConnectorReview ||
      wantsConnectorApprovalPacket ||
      wantsReviewKit ||
      parsed.progress)
  ) {
    throw new Error("--next cannot be combined with template, worksheet, review-kit, progress, connector-plan, connector-review, or connector-approval-packet output.");
  }

  if (
    parsed.progress &&
    (wantsTemplate ||
      wantsWorksheet ||
      wantsConnectorPlan ||
      wantsConnectorPrepKit ||
      wantsConnectorReview ||
      wantsConnectorApprovalPacket ||
      wantsReviewKit)
  ) {
    throw new Error("--progress cannot be combined with template, worksheet, review-kit, connector-plan, connector-review, or connector-approval-packet output.");
  }

  if (
    wantsConnectorReview &&
    (wantsTemplate ||
      parsed.progress ||
      wantsWorksheet ||
      wantsConnectorPlan ||
      wantsConnectorPrepKit ||
      wantsConnectorApprovalPacket ||
      wantsReviewKit)
  ) {
    throw new Error("--connector-review cannot be combined with template, progress, worksheet, connector-plan, connector-prep-kit, connector-approval-packet, or review-kit output.");
  }

  if (
    wantsConnectorPlan &&
    (wantsTemplate ||
      parsed.progress ||
      wantsWorksheet ||
      wantsConnectorPrepKit ||
      wantsConnectorApprovalPacket ||
      wantsReviewKit)
  ) {
    throw new Error("--connector-plan cannot be combined with template, progress, worksheet, connector-prep-kit, connector-approval-packet, or review-kit output.");
  }

  if (
    wantsConnectorApprovalPacket &&
    (wantsTemplate || parsed.progress || wantsWorksheet || wantsConnectorPrepKit || wantsReviewKit)
  ) {
    throw new Error("--connector-approval-packet cannot be combined with template, progress, worksheet, connector-prep-kit, or review-kit output.");
  }

  if (
    wantsConnectorPrepKit &&
    (wantsTemplate ||
      parsed.next ||
      parsed.progress ||
      wantsWorksheet ||
      wantsConnectorReview ||
      wantsConnectorPlan ||
      wantsConnectorApprovalPacket ||
      wantsReviewKit)
  ) {
    throw new Error("--write-connector-prep-kit cannot be combined with template, next, progress, worksheet, connector-review, connector-plan, connector-approval-packet, or review-kit output.");
  }

  if (wantsConnectorPrepKit && !parsed.inventoryFilePath) {
    throw new Error("--write-connector-prep-kit requires --inventory-file.");
  }

  if (wantsReviewKit && (wantsTemplate || wantsWorksheet)) {
    throw new Error("--write-review-kit cannot be combined with template or worksheet output.");
  }

  return parsed;
}

async function writeReviewKitFiles(
  files: Array<{ content: string; path: string }>,
  force: boolean
) {
  if (!force) {
    for (const file of files) {
      await assertOutputFileMissing(file.path);
    }
  }

  for (const file of files) {
    await mkdir(dirname(file.path), { recursive: true });
    await writeFile(file.path, file.content, "utf8");
  }
}

async function writeTemplateFile(path: string, payload: string, force: boolean) {
  await writeOutputFile(path, payload, force);
}

async function writeOutputFile(path: string, payload: string, force: boolean) {
  if (!force) {
    await assertOutputFileMissing(path);
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, payload, "utf8");
}

async function assertOutputFileMissing(path: string) {
  try {
    await access(path);
    throw new Error(`Refusing to overwrite existing file: ${path}. Use --force to replace it.`);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
