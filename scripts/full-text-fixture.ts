import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

interface FullTextFixtureArgs {
  candidateKey?: string;
  extractionDraft: boolean;
  force: boolean;
  fixtureDirPath?: string;
  fixtureFilePath?: string;
  progress: boolean;
  sourceId?: string;
  sourceUrl?: string;
  studySourceType?: string;
  summary: boolean;
  template: boolean;
  title?: string;
  writeTemplatePath?: string;
}

async function main() {
  const args = readArgs(process.argv.slice(2));

  const {
    buildFullTextFixtureExtractionDraft,
    buildFullTextFixtureProgressReport,
    buildFullTextLocalFixtureTemplate,
    buildFullTextFixtureReviewReport,
    parseFullTextLocalFixture,
    summarizeFullTextFixtureExtractionDraft,
    summarizeFullTextFixtureProgressReport,
    summarizeFullTextFixtureReviewReport
  } = await import("@/lib/full-text-fixture");

  if (args.template || args.writeTemplatePath) {
    const template = buildFullTextLocalFixtureTemplate({
      sourceId: args.sourceId,
      sourceUrl: args.sourceUrl,
      title: args.title
    });
    const payload = `${JSON.stringify(template, null, 2)}\n`;

    if (args.writeTemplatePath) {
      await writeOutputFile(args.writeTemplatePath, payload, args.force);
      console.log(
        JSON.stringify(
          {
            nextAction:
              "Edit the local fixture template with a short reviewed excerpt and derived targets, then rerun onboarding:fulltext-fixture with --fixture-file.",
            path: args.writeTemplatePath,
            sourceId: template.sourceId,
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

  if (args.progress) {
    const fixtures = await readProgressFixtures(args);
    const report = buildFullTextFixtureProgressReport({ fixtures });

    console.log(
      JSON.stringify(
        args.summary ? summarizeFullTextFixtureProgressReport(report) : report,
        null,
        2
      )
    );
    return;
  }

  if (!args.fixtureFilePath) {
    throw new Error("--fixture-file is required unless --template or --write-template is used.");
  }

  const fixture = parseFullTextLocalFixture(
    JSON.parse(await readFile(args.fixtureFilePath, "utf8")) as unknown
  );

  if (args.extractionDraft) {
    const draft = buildFullTextFixtureExtractionDraft({
      candidateKey: args.candidateKey,
      fixture,
      studySourceType: args.studySourceType
    });

    console.log(
      JSON.stringify(
        args.summary ? summarizeFullTextFixtureExtractionDraft(draft) : draft,
        null,
        2
      )
    );
    return;
  }

  const report = buildFullTextFixtureReviewReport({ fixture });

  console.log(
    JSON.stringify(
      args.summary ? summarizeFullTextFixtureReviewReport(report) : report,
      null,
      2
    )
  );
}

function readArgs(args: string[]): FullTextFixtureArgs {
  const parsed: FullTextFixtureArgs = {
    extractionDraft: false,
    force: false,
    progress: false,
    summary: false,
    template: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--template") {
      parsed.template = true;
      continue;
    }

    if (arg === "--force") {
      parsed.force = true;
      continue;
    }

    if (arg === "--extraction-draft") {
      parsed.extractionDraft = true;
      continue;
    }

    if (arg === "--progress") {
      parsed.progress = true;
      continue;
    }

    if (arg === "--fixture-file") {
      parsed.fixtureFilePath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--fixture-dir") {
      parsed.fixtureDirPath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--fixture-dir=")) {
      parsed.fixtureDirPath = readInlineValue(arg, "--fixture-dir");
      continue;
    }

    if (arg.startsWith("--fixture-file=")) {
      parsed.fixtureFilePath = readInlineValue(arg, "--fixture-file");
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

    if (arg === "--candidate-key") {
      parsed.candidateKey = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--candidate-key=")) {
      parsed.candidateKey = readInlineValue(arg, "--candidate-key");
      continue;
    }

    if (arg === "--study-source-type") {
      parsed.studySourceType = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--study-source-type=")) {
      parsed.studySourceType = readInlineValue(arg, "--study-source-type");
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

    if (arg === "--source-url") {
      parsed.sourceUrl = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--source-url=")) {
      parsed.sourceUrl = readInlineValue(arg, "--source-url");
      continue;
    }

    if (arg === "--title") {
      parsed.title = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--title=")) {
      parsed.title = readInlineValue(arg, "--title");
      continue;
    }

    throw new Error(`Unknown full-text fixture option: ${arg}`);
  }

  if (parsed.force && !parsed.writeTemplatePath) {
    throw new Error("--force is only supported with --write-template.");
  }

  if (
    parsed.fixtureFilePath &&
    (parsed.template || parsed.writeTemplatePath)
  ) {
    throw new Error("--fixture-file cannot be combined with --template or --write-template.");
  }

  if (parsed.fixtureDirPath && !parsed.progress) {
    throw new Error("--fixture-dir is only supported with --progress.");
  }

  if (parsed.progress && (parsed.template || parsed.writeTemplatePath || parsed.extractionDraft)) {
    throw new Error("--progress cannot be combined with --template, --write-template, or --extraction-draft.");
  }

  if (parsed.progress && parsed.fixtureFilePath && parsed.fixtureDirPath) {
    throw new Error("--progress accepts either --fixture-file or --fixture-dir, not both.");
  }

  if (parsed.progress && !parsed.fixtureFilePath && !parsed.fixtureDirPath) {
    throw new Error("--progress requires --fixture-file or --fixture-dir.");
  }

  if (parsed.extractionDraft && !parsed.fixtureFilePath) {
    throw new Error("--extraction-draft requires --fixture-file.");
  }

  if (
    (parsed.sourceId || parsed.sourceUrl || parsed.title) &&
    !parsed.template &&
    !parsed.writeTemplatePath
  ) {
    throw new Error("--source-id, --source-url, and --title are only supported with --template or --write-template.");
  }

  if ((parsed.candidateKey || parsed.studySourceType) && !parsed.extractionDraft) {
    throw new Error("--candidate-key and --study-source-type are only supported with --extraction-draft.");
  }

  return parsed;
}

async function readProgressFixtures(args: FullTextFixtureArgs) {
  if (args.fixtureFilePath) {
    return [
      {
        content: await readFile(args.fixtureFilePath, "utf8"),
        path: args.fixtureFilePath
      }
    ];
  }

  const fixtureDirPath = args.fixtureDirPath;

  if (!fixtureDirPath) {
    throw new Error("--progress requires --fixture-file or --fixture-dir.");
  }

  const entries = (await readdir(fixtureDirPath, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => join(fixtureDirPath, entry.name).replace(/\\/g, "/"))
    .sort((first, second) => first.localeCompare(second));

  return Promise.all(
    entries.map(async (path) => ({
      content: await readFile(path, "utf8"),
      path
    }))
  );
}

async function writeOutputFile(path: string, payload: string, force: boolean) {
  if (!force) {
    try {
      await access(path);
      throw new Error(`Refusing to overwrite existing file: ${path}. Use --force to replace it.`);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, payload, "utf8");
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
