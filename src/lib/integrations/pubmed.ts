export interface PubMedArticleSummary {
  pmid: string;
  title: string | null;
  journal: string | null;
  publicationDate: string | null;
  publicationYear: string | null;
  authors: string[];
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

export async function searchPubMed(term: string, retmax = 10): Promise<PubMedSearchResult> {
  const url = new URL(`${PUBMED_EUTILS_BASE_URL}/esearch.fcgi`);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("retmode", "json");
  url.searchParams.set("retmax", String(retmax));
  url.searchParams.set("term", term);

  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    },
    next: {
      revalidate: 60 * 60
    }
  });

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
  const summaryById = await fetchPubMedSummaries(ids);

  return {
    query: term,
    ids,
    count: Number(data.esearchresult?.count ?? 0),
    source: PUBMED_SOURCE,
    articles: ids.map((id) => summaryById.get(id) ?? createPubMedArticleFallback(id))
  };
}

async function fetchPubMedSummaries(ids: string[]): Promise<Map<string, PubMedArticleSummary>> {
  if (ids.length === 0) {
    return new Map();
  }

  const url = new URL(`${PUBMED_EUTILS_BASE_URL}/esummary.fcgi`);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("retmode", "json");
  url.searchParams.set("id", ids.join(","));

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json"
      },
      next: {
        revalidate: 60 * 60
      }
    });

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
        summaries.set(id, mapPubMedSummary(id, record));
      }

      return summaries;
    }, new Map<string, PubMedArticleSummary>());
  } catch {
    return new Map();
  }
}

function mapPubMedSummary(pmid: string, record: PubMedSummaryRecord): PubMedArticleSummary {
  const publicationDate = firstText(record.pubdate, record.epubdate, record.sortpubdate);

  return {
    ...createPubMedArticleFallback(pmid),
    title: firstText(record.title),
    journal: firstText(record.fulljournalname, record.source),
    publicationDate,
    publicationYear: firstYear(record.pubdate, record.epubdate, record.sortpubdate),
    authors: readAuthorNames(record.authors)
  };
}

function createPubMedArticleFallback(pmid: string): PubMedArticleSummary {
  return {
    pmid,
    title: null,
    journal: null,
    publicationDate: null,
    publicationYear: null,
    authors: [],
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

function isPubMedSummaryRecord(
  value: PubMedSummaryRecord | string[] | undefined
): value is PubMedSummaryRecord {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}
