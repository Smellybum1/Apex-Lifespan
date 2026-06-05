export interface PubMedArticleSummary {
  pmid: string;
  title: string | null;
  journal: string | null;
  publicationDate: string | null;
  publicationYear: string | null;
  publicationTypes: string[];
  doi: string | null;
  hasAbstract: boolean | null;
  authors: string[];
  relevanceScore: number;
  relevanceReasons: string[];
  url: string;
}

export interface PubMedSearchResult {
  query: string;
  ids: string[];
  count: number;
  source: string;
  articles: PubMedArticleSummary[];
}

type PubMedSummaryRecord = Record<string, unknown>;

const PUBMED_EUTILS_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const PUBMED_SOURCE = "NCBI E-utilities";
const LIVE_SOURCE_FETCH_INIT = {
  headers: {
    accept: "application/json"
  },
  cache: "no-store"
} satisfies RequestInit;

export async function searchPubMed(term: string, retmax = 10): Promise<PubMedSearchResult> {
  const url = new URL(`${PUBMED_EUTILS_BASE_URL}/esearch.fcgi`);
  const safeRetmax = normaliseRetmax(retmax);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("retmode", "json");
  url.searchParams.set("retmax", String(safeRetmax));
  url.searchParams.set("term", term);

  const response = await fetch(url, LIVE_SOURCE_FETCH_INIT);

  if (!response.ok) {
    throw new Error(`PubMed search failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    esearchresult?: {
      count?: string;
      idlist?: string[];
    };
  };

  const ids = data.esearchresult?.idlist ?? [];
  const summaryById = await fetchPubMedSummaries(ids, term);

  return {
    query: term,
    ids,
    count: Number(data.esearchresult?.count ?? 0),
    source: PUBMED_SOURCE,
    articles: ids.map((id) => summaryById.get(id) ?? createPubMedArticleFallback(id))
  };
}

async function fetchPubMedSummaries(
  ids: string[],
  term: string
): Promise<Map<string, PubMedArticleSummary>> {
  if (ids.length === 0) {
    return new Map();
  }

  const url = new URL(`${PUBMED_EUTILS_BASE_URL}/esummary.fcgi`);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("retmode", "json");
  url.searchParams.set("id", ids.join(","));

  try {
    const response = await fetch(url, LIVE_SOURCE_FETCH_INIT);

    if (!response.ok) {
      return new Map();
    }

    const data = (await response.json()) as {
      result?: {
        uids?: string[];
      } & Record<string, PubMedSummaryRecord | string[] | undefined>;
    };

    return ids.reduce((summaries, id) => {
      const record = data.result?.[id];

      if (isPubMedSummaryRecord(record)) {
        summaries.set(id, mapPubMedSummary(id, record, term));
      }

      return summaries;
    }, new Map<string, PubMedArticleSummary>());
  } catch {
    return new Map();
  }
}

function mapPubMedSummary(
  pmid: string,
  record: PubMedSummaryRecord,
  term: string
): PubMedArticleSummary {
  const publicationDate = firstText(record.pubdate, record.epubdate, record.sortpubdate);
  const article = {
    ...createPubMedArticleFallback(pmid),
    title: firstText(record.title),
    journal: firstText(record.fulljournalname, record.source),
    publicationDate,
    publicationYear: firstYear(record.pubdate, record.epubdate, record.sortpubdate),
    publicationTypes: readStringArray(record.pubtype),
    doi: readDoi(record.articleids, record.elocationid),
    hasAbstract: readHasAbstract(record.hasabstract),
    authors: readAuthorNames(record.authors)
  };
  const triage = triagePubMedArticle(article, term);

  return {
    ...article,
    relevanceScore: triage.score,
    relevanceReasons: triage.reasons
  };
}

function createPubMedArticleFallback(pmid: string): PubMedArticleSummary {
  return {
    pmid,
    title: null,
    journal: null,
    publicationDate: null,
    publicationYear: null,
    publicationTypes: [],
    doi: null,
    hasAbstract: null,
    authors: [],
    relevanceScore: 0,
    relevanceReasons: ["Summary metadata unavailable"],
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
  };
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();

    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

function readAuthorNames(authors: unknown): string[] {
  if (!Array.isArray(authors)) {
    return [];
  }

  return authors.flatMap((author) => {
    if (!author || typeof author !== "object") {
      return [];
    }

    const name = firstText((author as { name?: unknown }).name);
    return name ? [name] : [];
  });
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function readDoi(articleIds: unknown, elocationId: unknown): string | null {
  if (Array.isArray(articleIds)) {
    for (const articleId of articleIds) {
      if (!articleId || typeof articleId !== "object") {
        continue;
      }

      const record = articleId as { idtype?: unknown; value?: unknown };

      if (firstText(record.idtype)?.toLowerCase() === "doi") {
        return firstText(record.value);
      }
    }
  }

  const elocationText = firstText(elocationId);

  if (!elocationText) {
    return null;
  }

  const normalised = elocationText.replace(/^doi:\s*/i, "").trim();
  return normalised.startsWith("10.") ? normalised : null;
}

function readHasAbstract(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    if (value === "1" || value.toLowerCase() === "true") {
      return true;
    }

    if (value === "0" || value.toLowerCase() === "false") {
      return false;
    }
  }

  return null;
}

function triagePubMedArticle(article: PubMedArticleSummary, term: string) {
  const reasons: string[] = [];
  let score = 20;
  const title = article.title?.toLowerCase() ?? "";
  const queryTokens = term
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);

  if (queryTokens.some((token) => title.includes(token))) {
    score += 25;
    reasons.push("Title matches query");
  }

  if (article.publicationTypes.some(isReviewType)) {
    score += 20;
    reasons.push("Review-level source");
  }

  if (article.publicationTypes.some(isHumanTrialType)) {
    score += 15;
    reasons.push("Human trial signal");
  }

  if (article.hasAbstract) {
    score += 10;
    reasons.push("Abstract available");
  }

  if (article.doi) {
    score += 5;
    reasons.push("DOI available");
  }

  const year = article.publicationYear ? Number(article.publicationYear) : 0;

  if (year >= 2020) {
    score += 10;
    reasons.push("Recent literature");
  }

  return {
    score: Math.min(score, 100),
    reasons: reasons.length > 0 ? reasons : ["Needs manual relevance review"]
  };
}

function isReviewType(value: string) {
  const normalised = value.toLowerCase();
  return normalised.includes("meta-analysis") || normalised.includes("review");
}

function isHumanTrialType(value: string) {
  const normalised = value.toLowerCase();
  return normalised.includes("randomized") || normalised.includes("clinical trial");
}

function firstYear(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const year = value.match(/\b\d{4}\b/)?.[0];

    if (year) {
      return year;
    }
  }

  return null;
}

function normaliseRetmax(retmax: number) {
  if (!Number.isFinite(retmax)) {
    return 10;
  }

  return Math.min(Math.max(Math.trunc(retmax), 1), 20);
}

function isPubMedSummaryRecord(
  value: PubMedSummaryRecord | string[] | undefined
): value is PubMedSummaryRecord {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}
