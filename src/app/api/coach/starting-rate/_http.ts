import type {
  OwnedStartingRateResult,
  PublicStartingRateResult,
} from "@/domain/coach-starting-rate";
export function startingRateResponse(
  result: OwnedStartingRateResult | PublicStartingRateResult,
) {
  const codes = {
    ready: 200,
    saved: 200,
    invalid: 400,
    conflict: 409,
    "signed-out": 401,
    forbidden: 403,
    "not-found": 404,
    unavailable: 503,
  };
  return Response.json(result, {
    status: codes[result.status],
    headers: { "cache-control": "private, no-store", vary: "Cookie" },
  });
}
