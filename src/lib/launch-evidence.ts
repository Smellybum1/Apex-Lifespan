export type LaunchEvidenceType =
  | "admin-flow-smoke"
  | "launch-approval"
  | "post-launch-review";

export interface LaunchEvidenceRecordOptions {
  approvedBy?: string;
  note: string;
  reviewWindow?: string;
  timestamp?: Date;
  type: LaunchEvidenceType;
  url?: string;
}

export interface LaunchEvidenceRecord {
  entries: Record<string, string>;
  evidenceKey: string;
  humanOwned: true;
  label: string;
  noDatabaseWrite: true;
  noProductionWrite: true;
  noteKey: string;
  recordedKeys: string[];
  requiredConfirmation: string;
  timestamp: string;
  type: LaunchEvidenceType;
}

export interface LaunchEvidenceEnvUpdate {
  appendedKeys: string[];
  content: string;
  recordedKeys: string[];
  replacedKeys: string[];
}

interface LaunchEvidenceDefinition {
  approvedByKey?: string;
  evidenceKey: string;
  label: string;
  noteKey: string;
  requiredConfirmation: string;
  reviewWindowKey?: string;
  urlKey?: string;
}

const LAUNCH_EVIDENCE_DEFINITIONS: Record<LaunchEvidenceType, LaunchEvidenceDefinition> = {
  "admin-flow-smoke": {
    evidenceKey: "APEX_ADMIN_FLOW_SMOKE_PASSED_AT",
    label: "Production authenticated admin/operator-flow smoke",
    noteKey: "APEX_ADMIN_FLOW_SMOKE_NOTE",
    requiredConfirmation:
      "Authenticated production operator console was manually smoked by an authorized operator.",
    urlKey: "APEX_ADMIN_FLOW_SMOKE_URL"
  },
  "launch-approval": {
    approvedByKey: "APEX_FULLY_LIVE_LAUNCH_APPROVED_BY",
    evidenceKey: "APEX_FULLY_LIVE_LAUNCH_APPROVED_AT",
    label: "Fully live launch approval",
    noteKey: "APEX_FULLY_LIVE_LAUNCH_APPROVAL_NOTE",
    requiredConfirmation:
      "Final launch approval was explicitly granted after readiness evidence was reviewed."
  },
  "post-launch-review": {
    evidenceKey: "APEX_POST_LAUNCH_REVIEW_SCHEDULED_AT",
    label: "Post-launch review scheduled",
    noteKey: "APEX_POST_LAUNCH_REVIEW_NOTE",
    requiredConfirmation: "A 24-48 hour post-launch review was scheduled.",
    reviewWindowKey: "APEX_POST_LAUNCH_REVIEW_WINDOW"
  }
};

export function buildLaunchEvidenceRecord(
  options: LaunchEvidenceRecordOptions
): LaunchEvidenceRecord {
  const definition = LAUNCH_EVIDENCE_DEFINITIONS[options.type];
  const timestamp = options.timestamp ?? new Date();
  const isoTimestamp = timestamp.toISOString();
  const note = normaliseHumanText(options.note, "--note");
  const entries: Record<string, string> = {
    [definition.evidenceKey]: isoTimestamp,
    [definition.noteKey]: note
  };

  if (definition.urlKey) {
    entries[definition.urlKey] = normaliseUrl(options.url, "--url");
  }

  if (definition.reviewWindowKey) {
    entries[definition.reviewWindowKey] = normaliseHumanText(
      options.reviewWindow,
      "--review-window"
    );
  }

  if (definition.approvedByKey) {
    entries[definition.approvedByKey] = normaliseHumanText(options.approvedBy, "--approved-by");
  }

  return {
    entries,
    evidenceKey: definition.evidenceKey,
    humanOwned: true,
    label: definition.label,
    noDatabaseWrite: true,
    noProductionWrite: true,
    noteKey: definition.noteKey,
    recordedKeys: Object.keys(entries),
    requiredConfirmation: definition.requiredConfirmation,
    timestamp: isoTimestamp,
    type: options.type
  };
}

export function applyLaunchEvidenceToEnvContent(
  content: string,
  record: LaunchEvidenceRecord,
  options: { force?: boolean } = {}
): LaunchEvidenceEnvUpdate {
  const lines = content.split(/\r?\n/);
  const nextLines: string[] = [];
  const appendedKeys: string[] = [];
  const replacedKeys: string[] = [];
  const entries = record.entries;
  const evidenceKeys = new Set(Object.keys(entries));
  const seenKeys = new Set<string>();

  for (const [key, value] of Object.entries(entries)) {
    const existing = readEnvValue(content, key);

    if (existing && !options.force) {
      throw new Error(`${key} is already recorded. Use --force to replace it.`);
    }

    if (value.trim().length === 0) {
      throw new Error(`${key} cannot be empty.`);
    }
  }

  for (const line of lines) {
    const key = readEnvKey(line);

    if (!key || !evidenceKeys.has(key)) {
      nextLines.push(line);
      continue;
    }

    if (seenKeys.has(key)) {
      continue;
    }

    nextLines.push(`${key}=${formatDotenvValue(entries[key] ?? "")}`);
    seenKeys.add(key);
    replacedKeys.push(key);
  }

  for (const [key, value] of Object.entries(entries)) {
    if (seenKeys.has(key)) {
      continue;
    }

    nextLines.push(`${key}=${formatDotenvValue(value)}`);
    appendedKeys.push(key);
  }

  return {
    appendedKeys,
    content: `${trimTrailingEmptyLines(nextLines).join("\n")}\n`,
    recordedKeys: Object.keys(entries),
    replacedKeys
  };
}

function normaliseHumanText(value: string | undefined, flag: string) {
  const trimmed = value?.replace(/\s+/g, " ").trim();

  if (!trimmed) {
    throw new Error(`${flag} is required.`);
  }

  if (trimmed.length < 12) {
    throw new Error(`${flag} must be specific enough to be useful evidence.`);
  }

  return trimmed;
}

function normaliseUrl(value: string | undefined, flag: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`${flag} is required.`);
  }

  const url = new URL(trimmed);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${flag} must start with http:// or https://.`);
  }

  return url.toString();
}

function readEnvValue(content: string, key: string) {
  const line = content.split(/\r?\n/).find((candidate) => readEnvKey(candidate) === key);

  if (!line) {
    return undefined;
  }

  const separatorIndex = line.indexOf("=");
  return line.slice(separatorIndex + 1).trim();
}

function readEnvKey(line: string) {
  const match = /^([A-Z][A-Z0-9_]*)=/.exec(line);
  return match?.[1];
}

function formatDotenvValue(value: string) {
  if (/^[A-Za-z0-9_./:@+=-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function trimTrailingEmptyLines(lines: string[]) {
  const nextLines = [...lines];

  while (nextLines.length > 0 && nextLines[nextLines.length - 1] === "") {
    nextLines.pop();
  }

  return nextLines;
}
