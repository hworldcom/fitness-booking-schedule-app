import type { PrivateBookingProjection } from "@/domain/coach-bookings";
import {
  parsePublicReview,
  parseReviewCommand,
  parseReviewSummary,
  REVIEW_UUID,
  reviewObject,
  reviewRevision,
  type OwnedReview,
  type PublishReview,
  type ReviewFailure,
  type ReviewState,
  type ReviewSummary,
  type WithdrawReview,
} from "@/domain/coach-reviews";

export type ReviewDraft = {
  rating: number;
  comment: string;
  attribution: string;
};
export type AuthorCommand = PublishReview | WithdrawReview;
export type AuthorResult = ReviewState | ReviewFailure;
export type PairWorkspace = {
  slug: string;
  name: string;
  bookingId: string;
  saved: ReviewState | null;
  draft: ReviewDraft | null;
  draftRevision: number;
  phase: "view" | "edit" | "preview";
  consent: boolean;
  loading: boolean;
  busy: boolean;
  readFailed: boolean;
  recovery: "conflict" | "uncertain" | null;
  pending: AuthorCommand | null;
  message: string | null;
  summary: ReviewSummary | "loading" | "unavailable" | null;
};
export type ReviewWorkspaceSnapshot = {
  pairs: Readonly<Record<string, PairWorkspace>>;
  active: string | null;
  accessLost: boolean;
};

export function reviewEntryCandidate(
  booking: PrivateBookingProjection,
  referenceTime: string,
): boolean {
  return (
    booking.status !== "cancelled" &&
    REVIEW_UUID.test(booking.id) &&
    Date.parse(booking.scheduledEndAt) <= Date.parse(referenceTime)
  );
}

export function parseAuthorResult(value: unknown): AuthorResult | null {
  if (!reviewObject(value)) return null;
  if (value.status === "ready" || value.status === "saved") {
    if (typeof value.eligible !== "boolean") return null;
    let review: OwnedReview | null = null;
    if (value.review !== null) {
      const publicFields = parsePublicReview(value.review);
      const row = value.review;
      if (
        !publicFields ||
        !reviewObject(row) ||
        typeof row.id !== "string" ||
        !REVIEW_UUID.test(row.id) ||
        typeof row.published !== "boolean" ||
        typeof row.moderationHidden !== "boolean" ||
        !reviewRevision(row.revision) ||
        row.revision < 1
      )
        return null;
      review = {
        ...publicFields,
        id: row.id,
        published: row.published,
        moderationHidden: row.moderationHidden,
        revision: row.revision,
      };
    }
    return { status: value.status, eligible: value.eligible, review };
  }
  return [
    "invalid",
    "conflict",
    "not-eligible",
    "not-found",
    "signed-out",
    "forbidden",
    "unavailable",
  ].includes(String(value.status))
    ? { status: value.status as ReviewFailure["status"] }
    : null;
}

export function previewCommand(pair: PairWorkspace): PublishReview | null {
  if (!pair.draft) return null;
  const parsed = parseReviewCommand({
    action: "publish",
    bookingId: pair.bookingId,
    ...pair.draft,
    consent: true,
    expectedRevision: pair.draftRevision,
  });
  return parsed?.action === "publish" ? parsed : null;
}

export type ReviewTransport = {
  read: (slug: string) => Promise<AuthorResult>;
  write: (command: AuthorCommand) => Promise<AuthorResult>;
  summary: (slug: string) => Promise<ReviewSummary | null>;
};

async function authorRequest(
  url: string,
  command?: AuthorCommand,
): Promise<AuthorResult> {
  const response = await fetch(url, {
    method: command ? "POST" : "GET",
    cache: "no-store",
    credentials: "same-origin",
    ...(command
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        }
      : {}),
  });
  if (response.status === 401) return { status: "signed-out" };
  const result = parseAuthorResult(await response.json());
  if (
    !result ||
    (response.ok && result.status !== (command ? "saved" : "ready")) ||
    (!response.ok && (result.status === "ready" || result.status === "saved"))
  )
    throw new Error("Unverified review response");
  return result;
}
export const browserReviewTransport: ReviewTransport = {
  read: (slug) =>
    authorRequest(`/api/coach-reviews?coach=${encodeURIComponent(slug)}`),
  write: (command) => authorRequest("/api/coach-reviews", command),
  summary: async (slug) => {
    const response = await fetch(
      `/api/coaches/${encodeURIComponent(slug)}/reviews`,
      { cache: "no-store", credentials: "same-origin" },
    );
    const value: unknown = await response.json();
    return response.ok && reviewObject(value) && value.status === "ready"
      ? parseReviewSummary(value.summary)
      : null;
  },
};

// One instance belongs to one verified subject, application profile and dataset.
// It stores no browser-persistent data and ignores late responses after disposal.
export class ReviewWorkspace {
  private snapshot: ReviewWorkspaceSnapshot = {
    pairs: {},
    active: null,
    accessLost: false,
  };
  private listeners = new Set<() => void>();
  private disposed = false;
  constructor(private transport: ReviewTransport) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(next: ReviewWorkspaceSnapshot) {
    if (this.disposed) return;
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
  private patch(slug: string, patch: Partial<PairWorkspace>) {
    const pair = this.snapshot.pairs[slug];
    if (pair)
      this.emit({
        ...this.snapshot,
        pairs: { ...this.snapshot.pairs, [slug]: { ...pair, ...patch } },
      });
  }
  private denied(result: AuthorResult) {
    if (result.status !== "signed-out" && result.status !== "forbidden")
      return false;
    this.emit({ pairs: {}, active: null, accessLost: true });
    return true;
  }
  dispose() {
    this.disposed = true;
    this.snapshot = { pairs: {}, active: null, accessLost: false };
    this.listeners.clear();
  }
  ensure(booking: PrivateBookingProjection) {
    if (
      this.disposed ||
      this.snapshot.accessLost ||
      this.snapshot.pairs[booking.coachSlug]
    )
      return;
    const pair: PairWorkspace = {
      slug: booking.coachSlug,
      name: booking.coachDisplayName,
      bookingId: booking.id,
      saved: null,
      draft: null,
      draftRevision: 0,
      phase: "view",
      consent: false,
      loading: false,
      busy: false,
      readFailed: false,
      recovery: null,
      pending: null,
      message: null,
      summary: null,
    };
    this.emit({
      ...this.snapshot,
      pairs: { ...this.snapshot.pairs, [pair.slug]: pair },
    });
    void this.load(pair.slug);
  }
  open(slug: string, bookingId?: string) {
    if (!this.snapshot.pairs[slug] || this.snapshot.accessLost) return;
    if (bookingId && REVIEW_UUID.test(bookingId))
      this.patch(slug, { bookingId });
    this.emit({ ...this.snapshot, active: slug });
    void this.load(slug);
  }
  close() {
    this.emit({ ...this.snapshot, active: null });
  }
  async load(slug: string) {
    const pair = this.snapshot.pairs[slug];
    if (!pair || pair.loading || pair.busy || this.disposed) return;
    this.patch(slug, { loading: true, summary: null });
    try {
      const result = await this.transport.read(slug);
      if (this.disposed || this.denied(result)) return;
      if (result.status !== "ready" && result.status !== "saved") {
        this.patch(slug, {
          loading: false,
          readFailed: true,
          message:
            result.status === "not-found"
              ? "This coach review is no longer available. Your draft is kept on this page."
              : "Review access could not be checked. Your draft is kept. Try again.",
        });
        return;
      }
      const current = this.snapshot.pairs[slug];
      if (!current) return;
      const changed =
        current.draft &&
        current.draftRevision !== (result.review?.revision ?? 0);
      this.patch(slug, {
        saved: result,
        loading: false,
        readFailed: false,
        ...(changed || current.pending
          ? {
              recovery: "conflict",
              consent: false,
              message:
                "The latest saved review is shown below. Choose how to continue with your draft.",
            }
          : { message: null }),
      });
    } catch {
      this.patch(slug, {
        loading: false,
        readFailed: true,
        message:
          "Review access could not be checked. Your draft is kept. Try again.",
      });
    }
  }
  edit(slug: string) {
    const pair = this.snapshot.pairs[slug];
    if (
      !pair?.saved?.eligible ||
      pair.loading ||
      pair.busy ||
      pair.recovery ||
      pair.readFailed
    )
      return;
    this.patch(slug, {
      draft: pair.draft ?? {
        rating: pair.saved.review?.rating ?? 0,
        comment: pair.saved.review?.comment ?? "",
        attribution: pair.saved.review?.attribution ?? "",
      },
      draftRevision: pair.saved.review?.revision ?? 0,
      phase: "edit",
      consent: false,
      message: null,
    });
  }
  change(slug: string, patch: Partial<ReviewDraft>) {
    const pair = this.snapshot.pairs[slug];
    if (!pair?.draft || pair.busy || pair.recovery || pair.loading) return;
    this.patch(slug, {
      draft: { ...pair.draft, ...patch },
      phase: "edit",
      consent: false,
      message: null,
    });
  }
  preview(slug: string) {
    const pair = this.snapshot.pairs[slug];
    if (!pair || pair.busy || pair.loading || pair.recovery || pair.readFailed)
      return;
    const command = previewCommand(pair);
    if (!command) {
      this.patch(slug, {
        message:
          "Choose 1–5 stars, a public name of 2–80 characters and a plain-text comment of up to 2,000 characters.",
      });
      return;
    }
    this.patch(slug, {
      draft: {
        rating: command.rating,
        attribution: command.attribution,
        comment: command.comment,
      },
      phase: "preview",
      consent: false,
      message: null,
    });
  }
  consent(slug: string, consent: boolean) {
    const pair = this.snapshot.pairs[slug];
    if (
      pair?.phase === "preview" &&
      !pair.busy &&
      !pair.recovery &&
      !pair.loading
    )
      this.patch(slug, { consent });
  }
  // A fresh read is required before discarding an uncertain command or rebasing.
  useLatest(slug: string, keepDraft: boolean) {
    const pair = this.snapshot.pairs[slug];
    if (
      !pair?.saved ||
      pair.loading ||
      pair.busy ||
      pair.readFailed ||
      pair.recovery !== "conflict"
    )
      return;
    this.patch(slug, {
      pending: null,
      recovery: null,
      consent: false,
      draftRevision: pair.saved.review?.revision ?? 0,
      draft: keepDraft ? pair.draft : null,
      phase: keepDraft && pair.draft ? "edit" : "view",
      message: null,
    });
  }
  discard(slug: string) {
    const pair = this.snapshot.pairs[slug];
    if (!pair || pair.busy || pair.loading || pair.recovery) return;
    this.patch(slug, {
      draft: null,
      phase: "view",
      consent: false,
      message: null,
    });
  }
  async publish(slug: string) {
    const pair = this.snapshot.pairs[slug];
    if (
      !pair ||
      !pair.saved?.eligible ||
      pair.phase !== "preview" ||
      !pair.consent ||
      pair.recovery ||
      pair.readFailed ||
      pair.loading
    )
      return;
    const command = previewCommand(pair);
    if (command) await this.send(slug, command);
  }
  async withdraw(slug: string) {
    const pair = this.snapshot.pairs[slug];
    if (
      !pair?.saved?.review?.published ||
      pair.recovery ||
      pair.readFailed ||
      pair.loading
    )
      return;
    await this.send(slug, {
      action: "withdraw",
      coachSlug: slug,
      expectedRevision: pair.saved.review.revision,
    });
  }
  async retry(slug: string) {
    const pair = this.snapshot.pairs[slug];
    if (pair?.recovery === "uncertain" && pair.pending && !pair.loading)
      await this.send(slug, pair.pending);
  }
  private async send(slug: string, command: AuthorCommand) {
    const pair = this.snapshot.pairs[slug];
    if (!pair || pair.busy || this.disposed) return;
    // Set the lock synchronously, before any await or React render.
    this.patch(slug, { busy: true, pending: command, message: null });
    let result: AuthorResult;
    try {
      result = await this.transport.write(command);
    } catch {
      result = { status: "unavailable" };
    }
    if (this.disposed || this.denied(result)) return;
    if (result.status === "saved") {
      this.patch(slug, {
        saved: result,
        draft: null,
        pending: null,
        recovery: null,
        phase: "view",
        consent: false,
        busy: false,
        readFailed: false,
        message:
          command.action === "withdraw"
            ? "Your review has been withdrawn."
            : "Your review has been saved.",
        summary: "loading",
      });
      try {
        const summary = (await this.transport.summary(slug)) ?? "unavailable";
        if (
          this.snapshot.pairs[slug]?.saved?.review?.revision ===
          result.review?.revision
        )
          this.patch(slug, { summary });
      } catch {
        if (
          this.snapshot.pairs[slug]?.saved?.review?.revision ===
          result.review?.revision
        )
          this.patch(slug, { summary: "unavailable" });
      }
      return;
    }
    if (result.status === "conflict") {
      this.patch(slug, {
        busy: false,
        recovery: "conflict",
        consent: false,
        readFailed: true,
      });
      await this.load(slug);
    } else if (result.status === "unavailable" || result.status === "ready") {
      this.patch(slug, {
        busy: false,
        recovery: "uncertain",
        consent: false,
        message:
          "The save could not be confirmed. Retry the same save or check the latest review before making changes.",
      });
    } else {
      this.patch(slug, {
        busy: false,
        pending: null,
        consent: false,
        phase: pair.draft ? "edit" : "view",
        readFailed: result.status !== "invalid",
        message:
          result.status === "invalid"
            ? "The review was not accepted. Check the fields and preview it again."
            : "You can no longer publish this review. Your draft is kept; check review access again.",
      });
    }
  }
}
