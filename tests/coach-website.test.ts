import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCoachWebsiteContent,
  projectCoachWebsite,
} from "@/domain/coach-website";

test("optional website content stays compatible and enforces every content bound", () => {
  const empty = parseCoachWebsiteContent({});
  assert.ok(empty);
  assert.equal(projectCoachWebsite(empty, 0, false, "coach").banner, null);
  const full = {
    brandLabel: "x".repeat(80),
    introduction: "x".repeat(220),
    approach: "x".repeat(2000),
    experience: "x".repeat(2000),
    focusLabels: Array.from(
      { length: 8 },
      (_, i) => String(i) + "x".repeat(59),
    ),
    faqs: Array.from({ length: 6 }, () => ({
      question: "x".repeat(160),
      answer: "x".repeat(1000),
    })),
    links: Array.from({ length: 4 }, () => ({
      label: "x".repeat(60),
      url: "https://example.com/path",
    })),
  };
  assert.ok(parseCoachWebsiteContent(full));
  for (const [field, invalid] of Object.entries({
    brandLabel: "x".repeat(81),
    introduction: "x".repeat(221),
    approach: "x".repeat(2001),
    experience: "x".repeat(2001),
    focusLabels: [...full.focusLabels, "ninth"],
    faqs: [...full.faqs, full.faqs[0]],
    links: [...full.links, full.links[0]],
  })) {
    assert.equal(
      parseCoachWebsiteContent({ ...full, [field]: invalid }),
      null,
      field,
    );
  }
  assert.equal(parseCoachWebsiteContent({ focusLabels: ["a", "a"] }), null);
  for (const invalid of [
    { focusLabels: ["x".repeat(61)] },
    { faqs: [{ question: "x".repeat(161), answer: "ok" }] },
    { faqs: [{ question: "ok", answer: "x".repeat(1001) }] },
    { links: [{ label: "x".repeat(61), url: "https://example.com" }] },
  ])
    assert.equal(parseCoachWebsiteContent(invalid), null);
});

test("malformed content, injected fields, markup, hidden controls and unsafe URLs fail closed", () => {
  for (const invalid of [
    null,
    [],
    { privateAvatar: "/api/profile/avatar" },
    { brandLabel: 5 },
    { brandLabel: null },
    { focusLabels: null },
    { approach: "<script>alert(1)</script>" },
    { brandLabel: "A\u202eB" },
    { focusLabels: [" "] },
    { faqs: [{ question: "Q", answer: "A", actor: "other" }] },
    { links: [{ label: "Site", url: "https://example.com", path: "private" }] },
  ])
    assert.equal(parseCoachWebsiteContent(invalid), null);
  for (const url of [
    "javascript:alert(1)",
    "data:image/png,x",
    "http://example.com",
    "https://user:secret@example.com",
    "https://example.com\\@evil.com",
    "https://example.com/\nfoo",
    "https://localhost/",
  ])
    assert.equal(
      parseCoachWebsiteContent({ links: [{ label: "Site", url }] }),
      null,
      url,
    );
  const content = parseCoachWebsiteContent({
    approach: "First line\nSecond line",
    links: [{ label: "Site", url: "https://EXAMPLE.com" }],
  });
  assert.equal(content?.links[0].url, "https://example.com/");
  assert.equal(content?.approach, "First line\nSecond line");
});

test("owner/public banner projections expose versioned app routes without object paths", () => {
  const content = parseCoachWebsiteContent({
    introduction: "Coach-supplied introduction",
  })!;
  const owner = projectCoachWebsite(content, 12, true, null),
    publicView = projectCoachWebsite(content, 12, true, "public-coach");
  assert.equal(owner.banner?.hero.url, "/api/coach/website/banner/hero?v=12");
  assert.equal(
    publicView.banner?.card.url,
    "/api/coaches/public-coach/website/banner/card?v=12",
  );
  assert.equal(publicView.banner?.hero.width, 1600);
  assert.doesNotMatch(
    JSON.stringify(publicView),
    /storage|avatar|authUser|runId/,
  );
});
