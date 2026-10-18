export const COACH_STARTING_RATE_MAX_CENTS = 2_147_483_647;
export type PublicCoachStartingRate = Readonly<{
  schemaVersion: 1;
  amountCents: number;
  currency: "EUR";
  context: "private-session";
  label: string;
}>;
export type OwnedCoachStartingRate = Readonly<{
  schemaVersion: 1;
  revision: number;
  amountCents: number | null;
  currency: "EUR";
  showPublicly: boolean;
  context: "private-session";
}>;
export type CoachStartingRateInput = Readonly<{
  schemaVersion: 1;
  expectedRevision: number;
  amountCents: number | null;
  currency: "EUR";
  showPublicly: boolean;
}>;
export type StartingRateFailure = Readonly<{
  status:
    | "invalid"
    | "conflict"
    | "signed-out"
    | "forbidden"
    | "unavailable"
    | "not-found";
}>;
export type OwnedStartingRateResult =
  | Readonly<{
      status: "ready" | "saved";
      startingRate: OwnedCoachStartingRate;
    }>
  | StartingRateFailure;
export type PublicStartingRateResult =
  | Readonly<{
      status: "ready";
      schemaVersion: 1;
      startingRate?: PublicCoachStartingRate;
    }>
  | StartingRateFailure;

export function isStartingRateAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= COACH_STARTING_RATE_MAX_CENTS
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function parseCoachStartingRateInput(
  value: unknown,
): CoachStartingRateInput | null {
  if (
    !record(value) ||
    Object.keys(value).length !== 5 ||
    Object.keys(value).some(
      (key) =>
        ![
          "schemaVersion",
          "expectedRevision",
          "amountCents",
          "currency",
          "showPublicly",
        ].includes(key),
    ) ||
    value.schemaVersion !== 1 ||
    value.currency !== "EUR" ||
    typeof value.showPublicly !== "boolean" ||
    !Number.isSafeInteger(value.expectedRevision) ||
    Number(value.expectedRevision) < 0 ||
    Number(value.expectedRevision) >= 2_147_483_647 ||
    (value.amountCents !== null && !isStartingRateAmount(value.amountCents))
  )
    return null;
  return Object.freeze({
    schemaVersion: 1,
    expectedRevision: Number(value.expectedRevision),
    amountCents: value.amountCents,
    currency: "EUR",
    showPublicly: value.showPublicly,
  });
}

// For the later owner form: exact decimal conversion, with no floating rounding.
// null is an invalid draft; {amountCents:null} is an explicit empty/clear value.
export function parseCoachStartingRateText(
  value: unknown,
): Readonly<{ amountCents: number | null }> | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text === "") return Object.freeze({ amountCents: null });
  const match = /^(0|[1-9]\d{0,7})(?:[.,](\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const cents =
    BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
  return cents > BigInt(COACH_STARTING_RATE_MAX_CENTS)
    ? null
    : Object.freeze({ amountCents: Number(cents) });
}
export function publicCoachStartingRate(
  amountCents: number,
): PublicCoachStartingRate {
  if (!isStartingRateAmount(amountCents))
    throw new RangeError("Invalid starting rate.");
  const amount = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
  return Object.freeze({
    schemaVersion: 1,
    amountCents,
    currency: "EUR",
    context: "private-session",
    label: `Sessions start from ${amount}${amountCents === 0 ? " (Free)" : ""}`,
  });
}
export function parsePublicCoachStartingRate(
  value: unknown,
): PublicCoachStartingRate | null {
  if (
    !record(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          "schemaVersion",
          "amountCents",
          "currency",
          "context",
          "label",
        ].includes(key),
    ) ||
    value.schemaVersion !== 1 ||
    value.currency !== "EUR" ||
    value.context !== "private-session" ||
    !isStartingRateAmount(value.amountCents)
  )
    return null;
  const result = publicCoachStartingRate(value.amountCents);
  return value.label !== undefined && value.label !== result.label
    ? null
    : result;
}
