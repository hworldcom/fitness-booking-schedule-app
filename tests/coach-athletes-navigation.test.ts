import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { coachAthletesSection } from "@/domain/coach-athletes-navigation";
import { CoachAthletesWorkspace } from "@/features/coaches/coach-athletes-workspace";
import {
  connectionSectionsForView,
  isConnectionListView,
} from "@/features/connections/connection-model";

test("My athletes defaults safely to connected; only a single explicit requests value selects requests", () => {
  assert.equal(coachAthletesSection("requests"), "requests");
  for (const value of [
    undefined,
    "connected",
    "external",
    "unknown",
    ["requests", "requests"],
  ])
    assert.equal(coachAthletesSection(value), "connected");
  for (const view of ["all", "connected", "requests"])
    assert.equal(isConnectionListView(view), true);
  for (const view of [undefined, "external", ["requests"], null, {}])
    assert.equal(isConnectionListView(view), false);
  assert.deepEqual(connectionSectionsForView("connected"), ["accepted"]);
  assert.deepEqual(connectionSectionsForView("requests"), [
    "incoming",
    "outgoing",
    "history",
  ]);
  assert.deepEqual(connectionSectionsForView(), [
    "accepted",
    "incoming",
    "outgoing",
    "history",
  ]);
});

test("My athletes sections preserve URLs, one page heading/current tab and pending-save navigation fences", () => {
  for (const active of ["connected", "external", "requests"] as const) {
    const html = renderToStaticMarkup(
      createElement(CoachAthletesWorkspace, { active }, "Selected panel"),
    );
    assert.deepEqual(
      [...html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]),
      [
        "/coach/athletes",
        "/coach/athletes/external",
        "/coach/athletes?section=requests",
      ],
    );
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.equal((html.match(/<h1>/g) ?? []).length, 1);
    assert.ok(
      html.indexOf("Connected athletes") < html.indexOf("External athletes"),
    );
  }
  const blocked = renderToStaticMarkup(
    createElement(CoachAthletesWorkspace, {
      active: "external",
      navigationDisabled: true,
    }),
  );
  assert.equal((blocked.match(/aria-disabled="true"/g) ?? []).length, 3);
  assert.equal((blocked.match(/tabindex="-1"/g) ?? []).length, 3);
});
