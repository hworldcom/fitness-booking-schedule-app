import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MySessionsHeading,
  MySessionsNavigation,
} from "@/features/profile/my-sessions-navigation";

for (const active of ["calendar", "routine", "private", "group"] as const) {
  test(`${active} view exposes all training routes and only its own current-page state`, () => {
    const html = renderToStaticMarkup(
      createElement(MySessionsNavigation, { active }),
    );
    assert.match(html, /<nav[^>]+aria-label="Session type"/);
    const links = [...html.matchAll(/<a\b([^>]+)>(.*?)<\/a>/g)];
    assert.equal(links.length, 4);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    for (const [index, href] of [
      "/sessions/calendar",
      "/sessions/routine",
      "/sessions",
      "/sessions/groups",
    ].entries()) {
      const [, attributes, content] = links[index];
      assert.ok(attributes.includes(`href="${href}"`));
      assert.equal(
        attributes.includes('aria-current="page"'),
        index === ["calendar", "routine", "private", "group"].indexOf(active),
      );
      assert.ok(
        content.includes(
          ["Calendar", "Plan routine", "Private sessions", "Group sessions"][
            index
          ],
        ),
      );
    }
    assert.doesNotMatch(html, /role="tab/);
  });

  test(`${active} heading explains the selected session lifecycle`, () => {
    const html = renderToStaticMarkup(
      createElement(MySessionsHeading, { active }),
    );
    assert.match(html, /<h1>My training<\/h1>/);
    assert.ok(
      html.includes(
        active === "calendar"
          ? "Your personal workouts and coaching sessions, together in one calendar."
          : active === "routine"
            ? "Build your weekly routine and make time for your personal workouts."
            : active === "private"
              ? "Your one-to-one coaching: booking requests, confirmed sessions and past training."
              : "A seat reservation alone does not confirm a session.",
      ),
    );
  });
}
