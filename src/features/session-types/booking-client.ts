import { sessionUuid } from "@/domain/session-types";
import type {
  CoachSessionCommand,
  SessionBookingDetail,
} from "@/domain/typed-sessions";

export const BOOKING_REQUEST_TIMEOUT_MS = 15_000;
type RequestOptions = {
  request?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) &&
  Number(value) >= 0 &&
  Number(value) <= 2147483647;

// Race the complete response body as well as fetch. Abort alone cannot fence a
// stalled body or a transport that completes after its signal was cancelled.
async function bookingResponse(
  path: string,
  init: RequestInit,
  options: RequestOptions,
) {
  if (options.signal?.aborted) throw Error("Booking request cancelled");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: () => void = () => {};
  const expired = new Promise<never>((_, reject) => {
    cancel = () => {
      controller.abort();
      reject(Error("Booking response could not be verified"));
    };
    timer = setTimeout(cancel, options.timeoutMs ?? BOOKING_REQUEST_TIMEOUT_MS);
    options.signal?.addEventListener("abort", cancel, { once: true });
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await (options.request ?? fetch)(path, {
          ...init,
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error",
          signal: controller.signal,
        });
        const body: unknown = await response.json();
        if (!record(body)) throw Error("Invalid booking response");
        return { code: response.status, body };
      })(),
      expired,
    ]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export async function saveCoachBooking(
  command: CoachSessionCommand,
  options: RequestOptions = {},
) {
  const { code, body } = await bookingResponse(
    "/api/session-bookings?coach=true",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    },
    options,
  );
  if (
    code === 200 &&
    body.status === "saved" &&
    sessionUuid(body.bookingId) &&
    revision(body.revision) &&
    (command.action === "create"
      ? body.revision === 0
      : body.bookingId === command.bookingId &&
        body.revision === Number(command.expectedRevision) + 1)
  ) {
    return {
      status: "saved" as const,
      bookingId: body.bookingId,
      revision: body.revision,
    };
  }
  const failures = {
    invalid: 400,
    conflict: 409,
    "outside-hours": 409,
    forbidden: 403,
    "signed-out": 401,
    unavailable: 503,
  } as const;
  for (const [status, expected] of Object.entries(failures))
    if (body.status === status && code === expected)
      return { status: status as keyof typeof failures };
  throw Error("Invalid booking save response");
}

export async function reviewCoachBooking(
  command: CoachSessionCommand,
  options: RequestOptions = {},
) {
  const { code, body } = await bookingResponse(
    "/api/session-bookings?coach=true&review=true",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    },
    options,
  );
  if (
    code === 200 &&
    body.status === "reviewed" &&
    typeof body.outsideWorkingHours === "boolean"
  )
    return { outsideWorkingHours: body.outsideWorkingHours };
  throw Error("The booking change could not be reviewed");
}

export async function reloadSavedBooking(
  bookingId: string,
  minimumRevision: number,
  options: RequestOptions = {},
): Promise<SessionBookingDetail> {
  const { code, body } = await bookingResponse(
    `/api/session-bookings?bookingId=${bookingId}`,
    {},
    options,
  );
  const detail = body.detail;
  if (
    code !== 200 ||
    body.status !== "ready" ||
    !record(detail) ||
    detail.bookingId !== bookingId ||
    !revision(detail.revision) ||
    detail.revision < minimumRevision ||
    typeof detail.startsAt !== "string" ||
    typeof detail.endsAt !== "string" ||
    !Number.isFinite(Date.parse(detail.startsAt)) ||
    !Number.isFinite(Date.parse(detail.endsAt)) ||
    Date.parse(detail.endsAt) <= Date.parse(detail.startsAt) ||
    !Array.isArray(detail.changes)
  )
    throw Error("Saved booking details could not be verified");
  return detail as unknown as SessionBookingDetail;
}
