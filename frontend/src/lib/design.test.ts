import { describe, expect, it } from "vitest";

import { coverGradient, hashString } from "./cover";
import { slugify, withHeadingIds } from "./toc";

describe("coverGradient", () => {
  it("is deterministic per seed and varies between seeds", () => {
    expect(coverGradient("understanding-transformers")).toBe(coverGradient("understanding-transformers"));
    const seeds = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(new Set(seeds.map(coverGradient)).size).toBeGreaterThan(1);
    expect(coverGradient("x")).toMatch(/^linear-gradient\(\d+deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
    expect(hashString("abc")).toBe(hashString("abc"));
  });
});

describe("withHeadingIds", () => {
  it("adds unique ids to h2/h3 and builds the table of contents", () => {
    const { html, toc } = withHeadingIds(
      '<p>Intro</p><h2>What &amp; why</h2><p>x</p><h3 class="a">Details <em>here</em></h3><h2>What &amp; why</h2><h4>Skip</h4>',
    );
    expect(toc).toEqual([
      { id: "what-why", text: "What & why", level: 2 },
      { id: "details-here", text: "Details here", level: 3 },
      { id: "what-why-2", text: "What & why", level: 2 },
    ]);
    expect(html).toContain('<h2 id="what-why">What &amp; why</h2>');
    expect(html).toContain('<h3 id="details-here" class="a">Details <em>here</em></h3>');
    expect(html).toContain('<h2 id="what-why-2">');
    expect(html).toContain("<h4>Skip</h4>");
  });

  it("never injects anything but slug characters", () => {
    const { html } = withHeadingIds('<h2>"><script>alert(1)</script></h2>');
    expect(html).toMatch(/^<h2 id="[a-z0-9-]+">/);
    expect(slugify("Héllo, Wörld!")).toBe("hello-world");
    expect(slugify("!!!")).toBe("section");
  });
});
