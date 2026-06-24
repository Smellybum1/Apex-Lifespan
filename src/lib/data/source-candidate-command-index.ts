export type SourceCandidateCommandMode =
  | "explicit-write-after-approval"
  | "read-only";

export interface SourceCandidateCommandIndexEntry {
  command: string;
  guardrail: string;
  id: string;
  label: string;
  mode: SourceCandidateCommandMode;
  purpose: string;
  relatedOptions: string[];
}

export interface SourceCandidateCommandIndexQuery {
  limit?: number;
  mode?: SourceCandidateCommandMode;
  query?: string;
}

export const SOURCE_CANDIDATE_COMMAND_INDEX: SourceCandidateCommandIndexEntry[] = [
  {
    command: "npm run ingest:sources -- --summary",
    guardrail: "Read-only workflow counts and next-command hints.",
    id: "summary",
    label: "Workflow summary",
    mode: "read-only",
    purpose: "Start here for source-candidate queue shape before choosing a focused command.",
    relatedOptions: ["--summary"]
  },
  {
    command: "npm run ingest:sources -- --db-status",
    guardrail: "Connectivity check only; does not read review data.",
    id: "db-status",
    label: "Database status",
    mode: "read-only",
    purpose: "Check local PostgreSQL connectivity before Prisma-backed inspection.",
    relatedOptions: ["--db-status", "--env-file"]
  },
  {
    command: "npm run ingest:sources -- --candidates --candidates-limit 10",
    guardrail: "Review rows only; candidate decisions stay explicit operator actions.",
    id: "candidate-review-queue",
    label: "Candidate review queue",
    mode: "read-only",
    purpose: "Inspect pending source candidates with triage, claim-fit, and curation hints.",
    relatedOptions: [
      "--candidates",
      "--candidates-limit",
      "--candidate-source",
      "--candidate-decision",
      "--candidate-duplicates"
    ]
  },
  {
    command: "npm run ingest:sources -- --candidate-review-overview",
    guardrail: "Read-only grouped overview; does not accept or reject candidates.",
    id: "candidate-review-overview",
    label: "Candidate review overview",
    mode: "read-only",
    purpose: "Summarize pending review groups before opening individual candidates.",
    relatedOptions: [
      "--candidate-review-overview",
      "--candidate-review-overview-limit",
      "--candidate-source"
    ]
  },
  {
    command: "npm run ingest:sources -- --candidate-review-flags",
    guardrail: "Read-only flagged groups; no candidate decisions are written.",
    id: "candidate-review-flags",
    label: "Candidate review flags",
    mode: "read-only",
    purpose: "Find broad-query, low-title-overlap, or other high-risk review groups.",
    relatedOptions: [
      "--candidate-review-flags",
      "--candidate-review-flag",
      "--candidate-review-flags-limit"
    ]
  },
  {
    command: "npm run ingest:sources -- --candidate-review-packet <dedupe-key>",
    guardrail: "Read-only packet with detail, accepted-reference matches, siblings, and curation hints.",
    id: "candidate-review-packet",
    label: "Candidate review packet",
    mode: "read-only",
    purpose: "Open the smallest complete context for one source candidate.",
    relatedOptions: ["--candidate-review-packet", "--candidate-detail", "--candidate-siblings"]
  },
  {
    command: "npm run ingest:sources -- --candidate-curation-status <dedupe-key>",
    guardrail: "Read-only curation handoff status; no references, claim links, or studies are written.",
    id: "candidate-curation-status",
    label: "Candidate curation status",
    mode: "read-only",
    purpose: "Check what is missing before a candidate can affect evidence-map impact.",
    relatedOptions: [
      "--candidate-curation-status",
      "--candidate-curation-draft",
      "--candidate-reference-matches"
    ]
  },
  {
    command: "npm run ingest:sources -- --candidate-curation-handoff",
    guardrail: "Read-only accepted-candidate handoff rows and next actions.",
    id: "candidate-curation-handoff",
    label: "Candidate curation handoff",
    mode: "read-only",
    purpose: "Batch accepted candidates by reference, claim-link, extraction, and promotion readiness.",
    relatedOptions: [
      "--candidate-curation-handoff",
      "--candidate-curation-handoff-status",
      "--candidate-curation-handoff-limit"
    ]
  },
  {
    command: "npm run ingest:sources -- --jobs --jobs-limit 10",
    guardrail: "Read-only ingestion job state.",
    id: "ingestion-jobs",
    label: "Ingestion jobs",
    mode: "read-only",
    purpose: "Inspect recent source-candidate ingestion jobs and failure hints.",
    relatedOptions: ["--jobs", "--jobs-status", "--jobs-source", "--jobs-limit"]
  },
  {
    command:
      "npm run ingest:sources -- --queue-claim-sources <claim-id> --region AU --pubmed-retmax 20 --clinical-trial-page-size 20",
    guardrail: "Queues source-candidate jobs only after explicit operator approval; no candidate decisions or evidence writes.",
    id: "queue-claim-sources",
    label: "Queue claim source leads",
    mode: "explicit-write-after-approval",
    purpose: "Create bounded PubMed and ClinicalTrials.gov jobs from one claim context.",
    relatedOptions: [
      "--queue-claim-sources",
      "--region",
      "--pubmed-retmax",
      "--clinical-trial-page-size"
    ]
  },
  {
    command:
      "npm run ingest:sources -- --accept-candidate <dedupe-key> --accepted-reference-id <id> --review-note <note>",
    guardrail: "Explicit audited candidate decision; requires curated reference id and review note.",
    id: "accept-candidate",
    label: "Accept candidate",
    mode: "explicit-write-after-approval",
    purpose: "Mark a reviewed source candidate accepted after claim fit and reference checks.",
    relatedOptions: ["--accept-candidate", "--accepted-reference-id", "--review-note"]
  },
  {
    command: "npm run ingest:sources -- --reject-candidate <dedupe-key> --review-note <note>",
    guardrail: "Explicit audited candidate decision; requires a review note.",
    id: "reject-candidate",
    label: "Reject candidate",
    mode: "explicit-write-after-approval",
    purpose: "Mark a reviewed source candidate rejected with traceable rationale.",
    relatedOptions: ["--reject-candidate", "--review-note"]
  },
  {
    command:
      "npm run ingest:sources -- --link-candidate-claim <dedupe-key> --claim-link-note <note>",
    guardrail: "Explicit claim-link write for an accepted candidate reference.",
    id: "link-candidate-claim",
    label: "Link candidate claim",
    mode: "explicit-write-after-approval",
    purpose: "Connect an accepted reference to its claim before extraction or promotion readiness.",
    relatedOptions: ["--link-candidate-claim", "--claim-link-note", "--claim-link-relevance"]
  },
  {
    command:
      "npm run ingest:sources -- --extract-candidate-study <dedupe-key> --study-sample-size <text> --study-population <text> --study-intervention-name <text> --study-outcome <text> --study-adverse-events <text> --study-funding-conflicts <text> --study-risk-of-bias <text>",
    guardrail: "Explicit structured extraction write for an accepted, claim-linked candidate.",
    id: "extract-candidate-study",
    label: "Extract candidate study",
    mode: "explicit-write-after-approval",
    purpose: "Write structured study fields after accepted-reference and claim-link prerequisites are satisfied.",
    relatedOptions: [
      "--extract-candidate-study",
      "--study-source-type",
      "--study-sample-size",
      "--study-population",
      "--study-outcome"
    ]
  }
];

export function listSourceCandidateCommandIndex({
  limit = SOURCE_CANDIDATE_COMMAND_INDEX.length,
  mode,
  query
}: SourceCandidateCommandIndexQuery = {}) {
  const terms = query
    ?.toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  return SOURCE_CANDIDATE_COMMAND_INDEX.filter((entry) => !mode || entry.mode === mode)
    .map((entry) => ({
      entry,
      score: scoreSourceCandidateCommandIndexEntry(entry, terms)
    }))
    .filter((item) => !terms?.length || item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        modePriority(left.entry.mode) - modePriority(right.entry.mode) ||
        left.entry.label.localeCompare(right.entry.label)
    )
    .slice(0, Math.max(1, limit))
    .map((item) => item.entry);
}

export function formatSourceCandidateCommandIndex(
  entries: SourceCandidateCommandIndexEntry[]
) {
  const lines = [
    "Source-candidate command index",
    "",
    "Use this compact index before opening the full source-candidate CLI implementation."
  ];

  for (const entry of entries) {
    lines.push(
      "",
      `## ${entry.label}`,
      `- Mode: ${entry.mode}`,
      `- Purpose: ${entry.purpose}`,
      `- Guardrail: ${entry.guardrail}`,
      `- Command: ${entry.command}`,
      `- Options: ${entry.relatedOptions.join(", ")}`
    );
  }

  return lines.join("\n");
}

function scoreSourceCandidateCommandIndexEntry(
  entry: SourceCandidateCommandIndexEntry,
  terms: string[] | undefined
) {
  if (!terms?.length) {
    return 1;
  }

  const haystack = [
    entry.id,
    entry.label,
    entry.mode,
    entry.purpose,
    entry.guardrail,
    entry.command,
    ...entry.relatedOptions
  ]
    .join(" ")
    .toLowerCase();

  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function modePriority(mode: SourceCandidateCommandMode) {
  return mode === "read-only" ? 0 : 1;
}
