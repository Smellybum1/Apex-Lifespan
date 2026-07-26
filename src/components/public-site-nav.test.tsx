import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicSiteNav } from "@/components/public-site-nav";

describe("PublicSiteNav", () => {
  it("renders the public destinations and identifies the active section", () => {
    const html = renderToStaticMarkup(<PublicSiteNav activeSection="lifespan" />);

    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('href="/">Supplements</a>');
    expect(html).toContain('href="/lifespan">Lifespan</a>');
    expect(html).toContain('href="/methodology">Methodology</a>');
    expect(html).toContain('aria-current="page"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).not.toContain("Biohacking");
  });
});
