import { afterEach, describe, expect, it, vi } from "vitest";

import { searchPubMed } from "@/lib/integrations/pubmed";

describe("searchPubMed", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ids plus article summary metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        esearchresult: {
          count: "42",
          idlist: ["28615996"]
        }
      })
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        result: {
          uids: ["28615996"],
          "28615996": {
            title: "Creatine position stand",
            fulljournalname: "Journal of the International Society of Sports Nutrition",
            pubdate: "2017 Jun 13",
            pubtype: ["Journal Article", "Review"],
            hasabstract: "1",
            articleids: [
              {
                idtype: "doi",
                value: "10.1186/s12970-017-0173-z"
              }
            ],
            authors: [{ name: "Kreider RB" }, { name: "Kalman DS" }]
          }
        }
      })
    );

    const result = await searchPubMed("creatine");

    expect(result.ids).toEqual(["28615996"]);
    expect(result.count).toBe(42);
    expect(result.articles).toEqual([
      {
        pmid: "28615996",
        title: "Creatine position stand",
        journal: "Journal of the International Society of Sports Nutrition",
        publicationDate: "2017 Jun 13",
        publicationYear: "2017",
        publicationTypes: ["Journal Article", "Review"],
        doi: "10.1186/s12970-017-0173-z",
        hasAbstract: true,
        authors: ["Kreider RB", "Kalman DS"],
        relevanceScore: 80,
        relevanceReasons: [
          "Title matches query",
          "Review-level source",
          "Abstract available",
          "DOI available"
        ],
        url: "https://pubmed.ncbi.nlm.nih.gov/28615996/"
      }
    ]);
  });

  it("adds trial and recent-literature triage cues", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        esearchresult: {
          count: "1",
          idlist: ["999"]
        }
      })
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        result: {
          uids: ["999"],
          "999": {
            title: "Omega-3 randomized clinical trial",
            source: "Nutrition Journal",
            sortpubdate: "2024/05/01",
            pubtype: ["Randomized Controlled Trial"],
            hasabstract: true,
            authors: []
          }
        }
      })
    );

    const result = await searchPubMed("omega-3");

    expect(result.articles[0]).toMatchObject({
      publicationYear: "2024",
      publicationTypes: ["Randomized Controlled Trial"],
      hasAbstract: true,
      relevanceScore: 80,
      relevanceReasons: [
        "Title matches query",
        "Human trial signal",
        "Abstract available",
        "Recent literature"
      ]
    });
  });

  it("keeps response usable when summary fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        esearchresult: {
          count: "1",
          idlist: ["123"]
        }
      })
    );

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("NCBI summary timeout"));

    const result = await searchPubMed("omega-3");

    expect(result.articles).toEqual([
      {
        pmid: "123",
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
        url: "https://pubmed.ncbi.nlm.nih.gov/123/"
      }
    ]);
  });

  it("ignores malformed PubMed ids and sanitizes malformed counts", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          esearchresult: {
            count: "not-a-number",
            idlist: ["123", 456, ""]
          }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          result: {
            uids: ["123"],
            "123": {
              title: "Creatine trial",
              authors: []
            }
          }
        })
      );

    const result = await searchPubMed("creatine");

    expect(result).toMatchObject({
      ids: ["123"],
      count: 0
    });
    expect(result.articles.map((article) => article.pmid)).toEqual(["123"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("treats non-array PubMed id lists as empty public previews", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        esearchresult: {
          count: "7",
          idlist: "123,456"
        }
      })
    );

    const result = await searchPubMed("creatine");

    expect(result).toMatchObject({
      ids: [],
      count: 7,
      articles: []
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not cache live search or summary fetches", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          esearchresult: {
            count: "1",
            idlist: ["123"]
          }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          result: {
            uids: ["123"],
            "123": {
              title: "Creatine trial",
              authors: []
            }
          }
        })
      );

    await searchPubMed("creatine");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchSpy.mock.calls) {
      expect(init).toMatchObject({
        cache: "no-store",
        headers: {
          accept: "application/json"
        }
      });
      expect((init as RequestInit & { next?: unknown }).next).toBeUndefined();
    }
  });

  it("caps retmax to keep public searches bounded", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        esearchresult: {
          count: "0",
          idlist: []
        }
      })
    );

    await searchPubMed("creatine", 500);

    const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(url.searchParams.get("retmax")).toBe("20");
  });

  it("caps returned ids when PubMed over-returns despite the requested retmax", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          esearchresult: {
            count: "3",
            idlist: ["111", "222", "333"]
          }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          result: {
            uids: ["111", "222"],
            "111": {
              title: "Creatine trial",
              authors: []
            },
            "222": {
              title: "Creatine review",
              authors: []
            }
          }
        })
      );

    const result = await searchPubMed("creatine", 2);

    expect(result.ids).toEqual(["111", "222"]);
    expect(result.articles.map((article) => article.pmid)).toEqual(["111", "222"]);
    const summaryUrl = new URL(String(fetchSpy.mock.calls[1]?.[0]));
    expect(summaryUrl.searchParams.get("id")).toBe("111,222");
  });
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body
  } as Response;
}
