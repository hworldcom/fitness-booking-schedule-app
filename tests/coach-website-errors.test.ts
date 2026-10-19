import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { validateCoachWebsiteContent } from "@/domain/coach-website";
import {
  WebsiteContentErrorSummary,
  WebsiteFieldErrors,
} from "@/features/coaches/website/website-content-errors";

test("website error summary announces actual numbered problems and links each field to its inline error", () => {
  const { issues } = validateCoachWebsiteContent({
    faqs: [{ question: "", answer: "" }],
  });
  const summary = renderToStaticMarkup(
    createElement(WebsiteContentErrorSummary, { prefix: "website", issues }),
  );
  assert.match(summary, /role="alert"/);
  assert.match(summary, /tabindex="-1"/);
  assert.match(summary, /aria-labelledby="website-errors-title"/);
  assert.match(summary, /href="#website-faqs-0-question"/);
  assert.match(summary, /href="#website-faqs-0-answer"/);
  assert.match(summary, /Your draft is retained/);
  assert.doesNotMatch(summary, /duplicate|HTTPS|field limits/);
  const inline = renderToStaticMarkup(
    createElement(WebsiteFieldErrors, {
      id: "website-faqs-0-answer-errors",
      issues: issues.filter((issue) => issue.field === "faqs.0.answer"),
    }),
  );
  assert.match(inline, /id="website-faqs-0-answer-errors"/);
  assert.match(inline, /FAQ 1 answer is empty/);
  assert.doesNotMatch(inline, /question is empty/);
  assert.equal(
    renderToStaticMarkup(
      createElement(WebsiteContentErrorSummary, {
        prefix: "website",
        issues: [],
      }),
    ),
    "",
  );
});
