"use client";

import {
  CalendarDays,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { signInHref } from "@/auth/return-to";
import {
  formatEurcBaseUnits,
  shortenChainReference,
} from "@/domain/coach-marketplace";
import {
  availableGroupEventActions,
  groupEventProgress,
  type GroupEventActorState,
  type GroupEventAvailableAction,
} from "@/domain/group-event-marketplace";
import type { GroupEventProjection } from "@/domain/group-events";
import { GroupEventOperationPanel } from "./group-event-operation-panel";

function eventSchedule(event: GroupEventProjection) {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: event.location.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(event.startsAt));
  const time = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: event.location.timezone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  return `${date}, ${time(event.startsAt)}–${time(event.endsAt)}`;
}

function deadline(event: GroupEventProjection) {
  if (!event.pool) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: event.location.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(event.pool.fundingDeadline));
}

function lifecycleCopy(event: GroupEventProjection, now: number) {
  if (!event.pool) {
    return "Verified pool state is temporarily unavailable. Funding controls stay disabled.";
  }
  switch (event.pool.lifecycleStatus) {
    case "funding":
      return new Date(event.pool.fundingDeadline).getTime() <= now
        ? "Funding is closed. Any signed-in linked wallet may settle the chain-derived result."
        : "Funding is open. Each participant funds exactly one seat at the fixed price.";
    case "succeeded":
      return "The minimum was reached and the pool settled successfully. The coach can claim the vault payout.";
    case "paid":
      return "The successful event payout has been claimed and verified.";
    case "failed":
      return "The minimum was not reached. Each participant can claim their own full seat refund.";
  }
}

function actionContent(action: GroupEventAvailableAction) {
  switch (action) {
    case "fund":
      return {
        label: "Review one-seat funding",
        description:
          "The full fixed seat price moves into the event vault. It becomes coach payout only if the threshold succeeds; otherwise your contribution is refundable.",
      };
    case "settle":
      return {
        label: "Review settlement",
        description:
          "Settlement reads the finalized participant count and records success or failure. The signer cannot choose the outcome.",
      };
    case "payout":
      return {
        label: "Review coach payout",
        description:
          "Only the current linked coach wallet can authorize transfer of the successful pool to its fixed payout recipient.",
      };
    case "refund":
      return {
        label: "Review my refund",
        description:
          "Only your linked participant wallet can return your contribution from this failed pool.",
      };
  }
}

export function GroupEventDetail({
  event,
  actor,
  now,
}: {
  event: GroupEventProjection;
  actor: GroupEventActorState;
  now: number;
}) {
  const progress = groupEventProgress(event);
  const actions = availableGroupEventActions(event, actor, new Date(now));
  return (
    <article className="group-event-detail">
      <header className="group-event-detail-hero">
        <div>
          <Link className="group-event-back" href="/events">
            ← All group events
          </Link>
          <span className="eyebrow">{event.discipline} · GROUP-FUNDED</span>
          <h1>
            {event.title}
            <span className="lime-text">.</span>
          </h1>
          <p>{event.description}</p>
          <Link
            className="group-event-coach-link"
            href={`/coaches/${event.coach.slug}`}
          >
            Led by {event.coach.displayName}
          </Link>
        </div>
        <aside className="group-event-state-card">
          <span>Pool state</span>
          <strong>{event.pool?.lifecycleStatus ?? "Unavailable"}</strong>
          <p>{lifecycleCopy(event, now)}</p>
        </aside>
      </header>

      <div className="group-event-detail-grid">
        <section className="group-event-detail-main">
          <div className="group-event-detail-facts">
            <div>
              <CalendarDays size={19} aria-hidden="true" />
              <span>
                <small>Schedule</small>
                <strong>{eventSchedule(event)}</strong>
              </span>
            </div>
            <div>
              <MapPin size={19} aria-hidden="true" />
              <span>
                <small>Training place</small>
                <strong>{event.location.label}</strong>
              </span>
            </div>
          </div>

          <section className="group-event-funding-card">
            <div className="group-event-funding-heading">
              <div>
                <span className="eyebrow">VERIFIED FUNDING</span>
                <h2>{progress.label}</h2>
              </div>
              <Users size={26} aria-hidden="true" />
            </div>
            <div
              className="group-event-progress large"
              role="progressbar"
              aria-label="Minimum funding progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
            >
              <span style={{ width: `${progress.percent}%` }} />
            </div>
            {event.pool && (
              <>
                <dl className="group-event-terms">
                  <div>
                    <dt>Fixed seat price</dt>
                    <dd>
                      {formatEurcBaseUnits(
                        event.pool.seatPriceBaseUnits.toString(),
                      )}{" "}
                      test EURC
                    </dd>
                  </div>
                  <div>
                    <dt>Minimum</dt>
                    <dd>{event.pool.minimumParticipants} participants</dd>
                  </div>
                  <div>
                    <dt>Maximum</dt>
                    <dd>{event.pool.maximumParticipants} participants</dd>
                  </div>
                  <div>
                    <dt>Funding closes</dt>
                    <dd>{deadline(event)}</dd>
                  </div>
                </dl>
                <p className="group-event-refund-rule">
                  Your full fixed seat price stays in the event vault. A
                  successful threshold makes the pool claimable by the coach; a
                  failed threshold makes your full seat refund claimable.
                </p>
              </>
            )}
          </section>

          {actor.status === "authorized" && actor.contribution && (
            <section className="group-event-contribution-card">
              <ShieldCheck size={21} aria-hidden="true" />
              <div>
                <span className="eyebrow">YOUR VERIFIED CONTRIBUTION</span>
                <h2>{actor.contribution.lifecycleStatus}</h2>
                <p>
                  {formatEurcBaseUnits(actor.contribution.amountBaseUnits)} test
                  EURC · contribution{" "}
                  {shortenChainReference(
                    actor.contribution.contributionAddress,
                  )}
                </p>
              </div>
            </section>
          )}

          <section className="group-event-action-card">
            <span className="eyebrow">AVAILABLE ACTIONS</span>
            {actor.status === "signed-out" || actor.status === "preview" ? (
              <>
                <h2>Sign in to fund or settle.</h2>
                <p>
                  Browsing is public. Wallet operations require a verified MovX
                  identity and linked Devnet wallet.
                </p>
                <Link
                  className="button dark"
                  href={signInHref(`/events/${event.slug}`)}
                >
                  Sign in
                </Link>
              </>
            ) : actor.status === "unavailable" ||
              actor.status === "forbidden" ? (
              <p className="group-event-operation-alert" role="alert">
                MovX could not verify an eligible actor for this event. No
                wallet action is shown.
              </p>
            ) : actions.length === 0 ? (
              <p>
                No action is currently available to this account. The verified
                pool and contribution states above remain read-only.
              </p>
            ) : (
              actions.map((action) => {
                const content = actionContent(action);
                return (
                  <GroupEventOperationPanel
                    key={action}
                    mode="prepare"
                    request={{ kind: action, eventId: event.id }}
                    label={content.label}
                    description={content.description}
                  />
                );
              })
            )}
          </section>
        </section>

        <aside className="group-event-chain-card">
          <span className="eyebrow">ON-CHAIN REFERENCES</span>
          <h2>Verify, don’t assume.</h2>
          <p>
            This preview uses Solana Devnet and test EURC. MovX sponsors SOL
            fees and rent; sponsorship does not grant purchase, settlement,
            payout or refund authority.
          </p>
          {event.pool && (
            <>
              <a
                href={`https://explorer.solana.com/address/${event.pool.eventPoolAddress}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                Event pool {shortenChainReference(event.pool.eventPoolAddress)}{" "}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
              <a
                href={`https://explorer.solana.com/tx/${event.pool.transactionSignature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                Latest verified transaction{" "}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </>
          )}
        </aside>
      </div>
    </article>
  );
}
