import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCoachWebsiteContent,
  validateCoachWebsiteContent,
  projectCoachWebsite,
  publicCoachSocialLinks,
  publicCoachProfileLinks,
} from "@/domain/coach-website";

test("a personal website is explicit, independent of four generic links, clearable and safe in drafts", () => {
  const legacy = parseCoachWebsiteContent({
    links: Array.from({ length: 4 }, (_, i) => ({
      label: `Site ${i}`,
      url: `https://example.com/${i}`,
    })),
  })!;
  assert.equal(Object.hasOwn(legacy, "websiteUrl"), false);
  const content = parseCoachWebsiteContent({
    ...legacy,
    websiteUrl: "https://COACH.EXAMPLE.com",
    socialLinks: { instagram: "https://instagram.com/coach" },
  })!;
  assert.equal(content.websiteUrl, "https://coach.example.com/");
  assert.deepEqual(content.links, legacy.links);
  assert.deepEqual(
    publicCoachProfileLinks(content).map((p) => p.label),
    ["Website", "Instagram"],
  );
  assert.equal(
    parseCoachWebsiteContent({ ...content, websiteUrl: "" })?.websiteUrl,
    "",
  );
  for (const websiteUrl of [
    null,
    42,
    "http://example.com",
    "javascript:alert(1)",
    "https://user:secret@example.com",
    "https://example.com/a b",
    "https://site.localhost",
    "https://example.com/" + "x".repeat(2048),
  ]) {
    const result = validateCoachWebsiteContent({ ...legacy, websiteUrl });
    assert.equal(result.content, null);
    assert.equal(result.issues[0].field, "websiteUrl");
  }
  assert.deepEqual(
    publicCoachProfileLinks({ ...legacy, websiteUrl: "javascript:alert(1)" }),
    [],
  );
});

test("public socials and languages are optional, bounded and separate from existing links", () => {
  const legacy = parseCoachWebsiteContent({
    links: [{ label: "My site", url: "https://example.com" }],
  })!;
  assert.equal(Object.hasOwn(legacy, "socialLinks"), false);
  assert.equal(Object.hasOwn(legacy, "languages"), false);
  const content = parseCoachWebsiteContent({
    ...legacy,
    languages: [" English ", "Deutsch", "Tiếng Việt"],
    socialLinks: {
      instagram: "https://WWW.INSTAGRAM.COM/coach",
      facebook: "",
      linkedin: "https://linkedin.com/in/coach",
    },
  })!;
  assert.deepEqual(content.languages, ["English", "Deutsch", "Tiếng Việt"]);
  assert.deepEqual(content.links, legacy.links);
  assert.deepEqual(content.socialLinks, {
    instagram: "https://www.instagram.com/coach",
    linkedin: "https://linkedin.com/in/coach",
  });
  assert.deepEqual(
    publicCoachSocialLinks(content).map((p) => p.label),
    ["Instagram", "LinkedIn"],
  );
  assert.deepEqual(
    parseCoachWebsiteContent({ ...content, socialLinks: {}, languages: [] })
      ?.socialLinks,
    {},
  );
  for (const invalid of [
    { languages: null },
    { languages: ["English", "english"] },
    { languages: [""] },
    { languages: ["English\nDeutsch"] },
    { languages: ["<b>English</b>"] },
    { languages: ["E".repeat(61)] },
    { languages: Array.from({ length: 9 }, (_, i) => String(i)) },
    { socialLinks: null },
    { socialLinks: { instagram: null } },
    { socialLinks: { phone: "+123456789" } },
    { phone: "+123456789" },
    { instagramUrl: "https://instagram.com/private-application-contact" },
  ])
    assert.equal(
      parseCoachWebsiteContent({ ...legacy, ...invalid }),
      null,
      JSON.stringify(invalid),
    );
});

test("platform URLs reject spoofed hosts, credentials and unsafe draft links", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://instagram.com/coach",
    "https://instagram.com.evil.test/coach",
    "https://evilinstagram.com/coach",
    "https://instagram.com@evil.test/coach",
    "https://evil.test@instagram.com/coach",
    "https://instagram.com:8080/coach",
    "https://a..instagram.com/coach",
    "https://-bad.instagram.com/coach",
    "https://a_b.instagram.com/coach",
    "https://facebook.com/coach",
    "https://instagram.com/white space",
    "https://instagram.com\\evil",
    "https://instagram.com/" + "x".repeat(2048),
  ]) {
    const draft = {
      ...parseCoachWebsiteContent({})!,
      socialLinks: { instagram: url },
    };
    const result = validateCoachWebsiteContent(draft);
    assert.equal(result.content, null, url);
    assert.equal(result.issues[0].field, "socialLinks.instagram");
    assert.deepEqual(publicCoachSocialLinks(draft), [], url);
    assert.doesNotMatch(
      JSON.stringify(result.issues),
      /evil|white space|alert\(1\)/,
    );
  }
});

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

test("website diagnostics identify every blank FAQ field and incomplete link without dropping rows", () => {
  const draft = {
    brandLabel: "My coaching",
    faqs: [
      { question: "Where?", answer: "Berlin" },
      { question: " ", answer: "" },
    ],
    links: [{ label: "", url: "" }],
  };
  const original = structuredClone(draft);
  const { content, issues } = validateCoachWebsiteContent(draft);
  assert.equal(content, null);
  assert.deepEqual(
    issues.map((issue) => issue.field),
    ["faqs.1.question", "faqs.1.answer", "links.0.label", "links.0.url"],
  );
  assert.match(issues[0].message, /FAQ 2 question is empty.*remove FAQ 2/);
  assert.match(issues[1].message, /FAQ 2 answer is empty.*remove FAQ 2/);
  assert.match(issues[3].message, /Link 1 address is empty/);
  assert.deepEqual(draft, original);
  assert.equal(parseCoachWebsiteContent(draft), null);
  assert.ok(
    validateCoachWebsiteContent({ ...draft, faqs: [draft.faqs[0]], links: [] })
      .content,
  );
  assert.ok(
    validateCoachWebsiteContent({
      ...draft,
      faqs: [
        ...draft.faqs.slice(0, 1),
        { question: "Who?", answer: "Beginners" },
      ],
      links: [{ label: "Site", url: "https://example.com" }],
    }).content,
  );
});

test("website diagnostics combine normalized duplicates, line numbers, character limits and unsafe URLs", () => {
  const result = validateCoachWebsiteContent({
    brandLabel: "😀".repeat(81),
    introduction: "one\ntwo",
    approach: "<b>unsafe</b>",
    focusLabels: [" Beginners ", "Beginners", "", "x".repeat(61)],
    faqs: [{ question: "Question", answer: "x".repeat(1001) }],
    links: [{ label: "Site", url: "http://example.com" }],
  });
  assert.equal(result.content, null);
  assert.deepEqual(
    result.issues.map((issue) => issue.field),
    [
      "brandLabel",
      "introduction",
      "approach",
      "focusLabels",
      "focusLabels",
      "focusLabels",
      "faqs.0.answer",
      "links.0.url",
    ],
  );
  assert.match(result.issues[0].message, /80.*currently 81/);
  assert.match(result.issues[3].message, /line 2 duplicates line 1/);
  assert.match(result.issues[4].message, /line 3 is empty/);
  assert.match(result.issues[5].message, /line 4.*60/);
  assert.match(result.issues[6].message, /FAQ 1 answer.*1,000/);
  assert.match(result.issues[7].message, /Link 1 address.*HTTPS/);
});

test("valid website diagnostics preserve optional sections, Unicode normalization and accepted parsing", () => {
  const value = {
    brandLabel: "  " + "😀".repeat(80) + "  ",
    approach: "First\r\nSecond",
    focusLabels: ["  Beginner  "],
    links: [{ label: " Site ", url: "https://EXAMPLE.com" }],
  };
  const result = validateCoachWebsiteContent(value);
  assert.deepEqual(result.issues, []);
  assert.equal(result.content?.brandLabel, "😀".repeat(80));
  assert.equal(result.content?.approach, "First\nSecond");
  assert.deepEqual(result.content?.focusLabels, ["Beginner"]);
  assert.equal(result.content?.links[0].url, "https://example.com/");
  assert.deepEqual(parseCoachWebsiteContent(value), result.content);
  assert.deepEqual(validateCoachWebsiteContent({}).issues, []);
});

test("malformed website diagnostics fail closed with bounded field references", () => {
  for (const value of [
    null,
    [],
    { privateAvatar: "secret" },
    { focusLabels: null },
    { faqs: [{ question: "Q", answer: "A", secret: true }] },
    { links: [{ label: "Site", url: "https://user:secret@example.com" }] },
  ]) {
    const result = validateCoachWebsiteContent(value);
    assert.equal(result.content, null);
    assert.ok(result.issues.length);
    assert.doesNotMatch(
      JSON.stringify(result.issues),
      /secret|privateAvatar|user:/,
    );
  }
});

test("external-link diagnostics identify the actual invalid URL rule without a checklist", () => {
  for (const [url, expected] of [
    ["http://example.com", /must use HTTPS/],
    ["https://user:secret@example.com", /contains login details/],
    ["https://localhost", /needs a public domain/],
    ["example.com", /not a complete URL/],
    ["https://example.com/a b", /contains spaces/],
    ["https://example.com\\path", /contains a backslash/],
    ["https://example.com/" + "a".repeat(2048), /too long/],
  ] as const) {
    const result = validateCoachWebsiteContent({
      links: [{ label: "Site", url }],
    });
    assert.equal(result.content, null);
    assert.equal(result.issues.length, 1, url);
    assert.equal(result.issues[0].field, "links.0.url");
    assert.match(result.issues[0].message, expected);
    assert.doesNotMatch(
      result.issues[0].message,
      /secret|Check the field limits/,
    );
  }
});
