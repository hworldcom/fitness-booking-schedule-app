import assert from "node:assert/strict";
import test from "node:test";
import { trainingEmail } from "../../src/server/notifications/training";
test("reminder contains bounded training identity and safe authorized destination without notes", () => {
  const p = {
    kind: "training" as const,
    id: "12000000-0000-4000-8000-000000000001",
    email: "athlete@example.test",
    title: "<Boxing>",
    startsAt: "2026-11-03T18:00:00Z",
    timezone: "Europe/Berlin",
    href: "/sessions/calendar?date=2026-11-03&selected=manual:12000000-0000-4000-8000-000000000001",
  };
  const email = trainingEmail(p, "https://movx.club");
  assert.match(email.html, /&lt;Boxing&gt;/);
  assert.match(email.text, /19:00/);
  assert.match(email.text, /https:\/\/movx.club\/sessions\/calendar/);
  assert.throws(() =>
    trainingEmail({ ...p, href: "https://evil.test" }, "https://movx.club"),
  );
});
