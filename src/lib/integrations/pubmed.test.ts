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
        authors: ["Kreider RB", "Kalman DS"],
        url: "https://pubmed.ncbi.nlm.nih.gov/28615996/"
      }
    ]);
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
        authors: [],
        url: "https://pubmed.ncbi.nlm.nih.gov/123/"
      }
    ]);
  });
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body
  } as Response;
}
