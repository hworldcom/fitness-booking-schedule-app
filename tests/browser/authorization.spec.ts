import { test, expect, type Page } from "@playwright/test";

async function requireConfiguredGuest(page: Page) {
  const response = await page.request.get("/api/auth/actor");
  const actor: unknown = await response.json();
  test.skip(
    response.status() === 200 &&
      typeof actor === "object" &&
      actor !== null &&
      "status" in actor &&
      actor.status === "preview",
    "This check requires the configured local Auth/database mode.",
  );
  expect(response.status()).toBe(401);
  expect(actor).toEqual({ status: "signed-out" });
}

test("configured guests keep public routes and are redirected from private pages", async ({
  page,
}) => {
  await requireConfiguredGuest(page);

  for (const path of ["/", "/how-it-works", "/coming-soon", "/sign-in"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
    expect(new URL(page.url()).pathname).toBe(path);
  }

  for (const path of ["/profile"]) {
    await page.goto(path);
    const destination = new URL(page.url());
    expect(destination.pathname).toBe("/sign-in");
    expect(destination.searchParams.get("returnTo")).toBe(path);
  }
});

test("legacy membership and gym-wallet routes are unavailable", async ({
  page,
}) => {
  for (const path of [
    "/membership/setup",
    "/my-access",
    "/membership-card/devnet/rehearsal",
    "/clubs/sign-in",
    "/explore",
    "/search",
    "/users/max",
  ]) {
    const response = await page.request.get(path);
    expect(response.status(), path).toBe(404);
  }

  for (const path of [
    "/api/membership",
    "/api/membership/activation/prepare",
    "/api/membership/check-ins",
    "/api/membership/reservations",
    "/api/membership-card/devnet/prepare",
    "/api/staff/check-ins/confirm",
    "/api/wallet/club",
  ]) {
    const response = await page.request.post(path, { data: {} });
    expect(response.status(), path).toBe(404);
  }
});
