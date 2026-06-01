export interface PubMedSearchResult {
  query: string;
  ids: string[];
  count: number;
  source: string;
}

export async function searchPubMed(term: string, retmax = 10): Promise<PubMedSearchResult> {
  const url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
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

  return {
    query: term,
    ids: data.esearchresult?.idlist ?? [],
    count: Number(data.esearchresult?.count ?? 0),
    source: "NCBI E-utilities"
  };
}
