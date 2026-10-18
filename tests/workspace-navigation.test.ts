import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceNavigationItems } from "@/components/workspace-navigation";
import { COACH_WORKSPACE_DESTINATIONS } from "@/features/coaches/coach-workspace-navigation";
import { selectedCoachWorkspaceDestination } from "@/features/coaches/coach-workspace-view";

const cases = [
  ["/coach", [], "schedule"],
  ["/coach", ["bookings"], "bookings"],
  ["/coach", ["schedule"], "schedule"],
  ["/coach", ["unknown"], "schedule"],
  ["/coach", ["bookings", "bookings"], "schedule"],
  ["/coach/events", ["bookings"], "events"],
  ["/coach/events/new", [], "events"],
  ["/coach/events/example/edit", [], "events"],
  ["/coach/sessions/example", [], "bookings"],
  ["/coach/athletes/example", [], "bookings"],
  ["/coach-other", [], null],
  ["/coaches/daniel-park", [], null],
  ["/events/example", [], null],
  ["/coach/events-other", [], null],
] as const;

test("coach selection matches strict server query handling and exact nested routes", () => {
  for (const [path, values, expected] of cases)
    assert.equal(
      selectedCoachWorkspaceDestination(path, values),
      expected,
      `${path}: ${values}`,
    );
});
test("desktop and mobile expose one selected coach destination without ambiguous /coach prefix matching", () => {
  for (const mobile of [false, true])
    for (const [path, viewValues, expected] of cases) {
      const html = renderToStaticMarkup(
        createElement(WorkspaceNavigationItems, {
          navigation: COACH_WORKSPACE_DESTINATIONS,
          pathname: path,
          viewValues,
          mobile,
        }),
      );
      const links = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
      const current = links.filter((link) =>
        link.includes('aria-current="page"'),
      );
      const href = COACH_WORKSPACE_DESTINATIONS.find(
        (item) => item.id === expected,
      )?.href;
      assert.equal(current.length, href ? 1 : 0);
      if (href) assert.ok(current[0].includes(`href="${href}"`));
      assert.deepEqual(
        links.map((link) => /href="([^"]+)"/.exec(link)?.[1]),
        ["/coach", "/coach?view=bookings", "/coach/events"],
      );
    }
});
test("prerender fallback retains usable links without inventing query selection", () => {
  const html = renderToStaticMarkup(
    createElement(WorkspaceNavigationItems, {
      navigation: COACH_WORKSPACE_DESTINATIONS,
      pathname: "/coach",
      viewValues: null,
    }),
  );
  assert.equal((html.match(/<a /g) ?? []).length, 3);
  assert.doesNotMatch(html, /aria-current/);
});
