import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HowItWorksStory } from "@/features/public/how-it-works";

const html = renderToStaticMarkup(createElement(HowItWorksStory));
const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

test("audience navigation has one link per focusable, labelled section", () => {
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((html.match(/<nav\b/g) ?? []).length, 1);
  assert.match(html, /<nav[^>]+aria-label="On this page"/);
  for (const audience of ["athletes", "coaches", "questions"]) {
    assert.equal(
      (html.match(new RegExp(`href="#${audience}"`, "g")) ?? []).length,
      1,
    );
    assert.match(
      html,
      new RegExp(
        `<section[^>]+id="${audience}"[^>]+tabindex="-1"[^>]+aria-labelledby="${audience}-title"`,
      ),
    );
    assert.match(html, new RegExp(`<h2 id="${audience}-title">`));
  }
  assert.match(text, /Your time\. Your coach\./);
  assert.match(text, /Find your kind of group\./);
  assert.match(text, /Coach one-to-one/);
  assert.match(text, /Bring a group together/);
});

test("athlete and coach actions reach real discovery and application routes", () => {
  const links = [
    ...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g),
  ].map(([, href, label]) => ({
    href: href.replaceAll("&amp;", "&"),
    label: label.replace(/<[^>]*>/g, "").trim(),
  }));
  for (const [label, href] of [
    ["Find a coach", "/explore"],
    ["Explore coaches", "/explore"],
    ["Explore group classes", "/events"],
    ["Find a group class", "/events"],
    ["Become a coach", "/sign-in?intent=coach&returnTo=%2Fprofile%2Fcoach"],
    ["Plan my routine", "/sessions/routine"],
    ["Open my calendar", "/sessions/calendar"],
  ])
    assert.deepEqual(
      links.find((link) => link.label === label),
      { label, href },
    );
  assert.doesNotMatch(
    html,
    /data-preview|<dialog|<button|Design preview|TRY THE PREVIEW/,
  );
});

test("group explanation distinguishes a reserved seat, minimum and coach decision", () => {
  assert.match(
    text,
    /Joining a group holds your seat while the coach reviews your participation/,
  );
  assert.match(
    text,
    /minimum number of approved participants before the coach/,
  );
  assert.match(
    text,
    /Reaching the minimum does not confirm the class automatically/,
  );
  assert.match(text, /decision deadline, the class becomes Not confirmed/);
  assert.match(text, /Invite a friend and check the latest status/);
  assert.match(text, /Class sizes vary/);
  assert.match(text, /choose a smaller class and check its maximum group size/);
  assert.doesNotMatch(text, /\b100\b|instant booking|every group is small/i);
});

test("native FAQs expose payment, cancellation and confirmation guidance without client state", () => {
  assert.equal((html.match(/<details>/g) ?? []).length, 6);
  assert.equal((html.match(/<summary>/g) ?? []).length, 6);
  assert.match(
    text,
    /A private session is confirmed when the coach accepts your request/,
  );
  assert.match(text, /MovX does not collect payments/);
  assert.match(text, /coach collects payment at the venue/);
  assert.match(text, /cancel a confirmed private session before it starts/);
  assert.match(text, /leave a group before its start time/);
});
