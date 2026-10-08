import assert from "node:assert/strict";
import test from "node:test";
import { coachAccountEntry } from "@/features/profile/profile";

test("ordinary accounts have no coach entry on Profile", () => {
  assert.equal(coachAccountEntry("not-applied"), null);
});

test("coach application states link to their bounded destinations", () => {
  assert.deepEqual(coachAccountEntry("pending"), {
    title: "Coach application pending",
    description:
      "Your private coach profile remains editable while MovX reviews the application.",
    href: "/profile/coach",
    action: "Open coach application",
  });
  assert.deepEqual(coachAccountEntry("rejected"), {
    title: "Coach application needs changes",
    description:
      "Update your private coach profile and resubmit it for MovX review.",
    href: "/profile/coach",
    action: "Update coach application",
  });
  assert.deepEqual(coachAccountEntry("suspended"), {
    title: "Coach access suspended",
    description:
      "Review your coach status and retain access to permitted existing-session actions.",
    href: "/coach",
    action: "Review coach access",
  });
});

test("approved and demo coaches receive the coach workspace entry", () => {
  for (const status of ["approved", "demo"] as const) {
    assert.deepEqual(coachAccountEntry(status), {
      title: "Coach workspace",
      description:
        "Manage your approved coach profile, client sessions and published availability.",
      href: "/coach",
      action: "Open coach workspace",
    });
  }
});
