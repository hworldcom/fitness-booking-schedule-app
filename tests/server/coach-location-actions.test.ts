import assert from "node:assert/strict";
import test from "node:test";
import {
  createCoachTrainingLocationAction,
  deactivateCoachTrainingLocationAction,
  setCoachPrimaryLocationAction,
  updateCoachTrainingLocationAction,
  type CoachTrainingLocationActionState,
} from "@/app/profile/coach/actions";

const idle: CoachTrainingLocationActionState = Object.freeze({
  status: "idle",
  message: "",
  errors: Object.freeze([]),
});

function validIndependentLocation() {
  const form = new FormData();
  form.set("kind", "independent");
  form.set("publicName", "Outdoor boxing spot");
  form.set("selectedGymId", "");
  form.set("locationLabel", "Tempelhofer Feld — north entrance");
  form.set("latitude", "52.473086");
  form.set("longitude", "13.403665");
  form.set("locationSource", "manual");
  form.set("locationProvider", "");
  form.set("locationConfirmation", "confirmed");
  return form;
}

test("location create action rejects unconfirmed input before mutation", async () => {
  const form = validIndependentLocation();
  form.set("locationConfirmation", "");
  const result = await createCoachTrainingLocationAction(idle, form);
  assert.equal(result.status, "invalid");
  assert.match(result.errors.join(" "), /Confirm the public location/);
});

test("location update action rejects missing optimistic identity while retaining validation errors separately", async () => {
  const form = validIndependentLocation();
  form.set("locationId", "not-a-location-id");
  form.set("expectedUpdatedAt", "2026-10-10T10:00:00.000Z");
  const result = await updateCoachTrainingLocationAction(idle, form);
  assert.equal(result.status, "conflict");
  assert.match(result.message, /Reload the profile/);
});

test("primary and deactivation actions reject forged version tokens before mutation", async () => {
  const primary = new FormData();
  primary.set("locationId", "60000000-0000-4000-8000-000000000002");
  primary.set("expectedUpdatedAt", "not-a-timestamp");
  primary.set("primaryLocationId", "60000000-0000-4000-8000-000000000001");
  primary.set("primaryUpdatedAt", "2026-10-10T10:00:00.000Z");
  assert.equal(
    (await setCoachPrimaryLocationAction(idle, primary)).status,
    "conflict",
  );

  const deactivate = new FormData();
  deactivate.set("locationId", "not-owned-or-valid");
  deactivate.set("expectedUpdatedAt", "2026-10-10T10:00:00.000Z");
  assert.equal(
    (await deactivateCoachTrainingLocationAction(idle, deactivate)).status,
    "conflict",
  );
});
