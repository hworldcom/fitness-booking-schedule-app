import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MySessionsHeading,
  MySessionsNavigation,
} from "@/features/profile/my-sessions-navigation";

for (const active of ["private", "group"] as const) {
  test(`${active} view exposes both session routes and only its own current-page state`, () => {
    const html = renderToStaticMarkup(
      createElement(MySessionsNavigation, { active }),
    );
    assert.match(html, /<nav[^>]+aria-label="Session type"/);
    const links = [...html.matchAll(/<a\b([^>]+)>(.*?)<\/a>/g)];
    assert.equal(links.length, 2);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    for (const [index, href] of ["/sessions", "/sessions/groups"].entries()) {
      const [, attributes, content] = links[index];
      assert.ok(attributes.includes(`href="${href}"`));
      assert.equal(
        attributes.includes('aria-current="page"'),
        index === (active === "private" ? 0 : 1),
      );
      assert.ok(
        content.includes(index === 0 ? "Private sessions" : "Group sessions"),
      );
      assert.ok(
        content.includes(
          index === 0 ? "One-to-one coaching" : "Train with a group",
        ),
      );
    }
    assert.doesNotMatch(html, /role="tab/);
  });

  test(`${active} heading explains the selected session lifecycle`, () => {
    const html = renderToStaticMarkup(
      createElement(MySessionsHeading, { active }),
    );
    assert.match(html, /<h1>My sessions<\/h1>/);
    assert.ok(
      html.includes(
        active === "private"
          ? "Your one-to-one coaching: booking requests, confirmed sessions and past training."
          : "A seat reservation alone does not confirm a session.",
      ),
    );
  });
}
