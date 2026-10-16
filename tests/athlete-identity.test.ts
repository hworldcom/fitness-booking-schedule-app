import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AthleteIdentity } from "@/features/coaches/athlete-identity";
import { privateAthleteHref } from "@/domain/coach-athlete-connections";

const pairId = "9a250000-0000-4000-8000-000000000001";
test("connected athlete identity links photo/name together with an accessible private destination", () => {
  const href = privateAthleteHref(pairId)!;
  const markup = renderToStaticMarkup(
    createElement(AthleteIdentity, {
      name: "Max Athlete",
      imageUrl: "/api/connections/" + pairId + "/athlete-avatar?v=version",
      href,
    }),
  );
  assert.ok(markup.includes(`href="${href}"`));
  assert.ok(markup.includes("View Max Athlete’s athlete details"));
  assert.ok(markup.includes("<h3>Max Athlete</h3>"));
  // Private images are mounted after hydration with failure handlers installed.
  assert.ok(markup.includes("MA"));
  assert.ok(!markup.includes("<img"));
});
test("unconnected identity has initials/name without a profile link; malformed pair IDs cannot become hrefs", () => {
  for (const id of ["bad", "../profile", "https://unrelated.test/"])
    assert.equal(privateAthleteHref(id), null);
  const markup = renderToStaticMarkup(
    createElement(AthleteIdentity, {
      name: "Max Athlete",
      imageUrl: null,
      href: null,
    }),
  );
  assert.ok(!markup.includes("<a "));
  assert.ok(markup.includes("Max Athlete"));
  assert.ok(markup.includes("MA"));
});
