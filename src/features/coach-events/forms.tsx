"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveCoachEventDraftAction,
  decideCoachEventAction,
} from "@/app/coach/events/actions";
import {
  coachEventHref,
  ownerIssueMessage,
  type CoachEventContext,
  type DraftFormState,
  type DraftValues,
  berlinLocalInstant,
  berlinLocalInput,
} from "./contract";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button dark" disabled={pending}>
      {pending ? "Checking saved status…" : children}
    </button>
  );
}
export function CoachEventDraftForm({
  id,
  revision,
  context,
  initial,
  permalink,
  sessionType,
}: {
  id: string;
  sessionType?: import("@/domain/session-types").SessionType | null;
  revision: number | null;
  context: CoachEventContext;
  initial: DraftValues;
  permalink: string;
}) {
  const [selectedType, setSelectedType] = useState(sessionType?.id ?? "");
  const type =
    context.sessionTypes?.find((t) => t.id === selectedType) ??
    (sessionType?.id === selectedType ? sessionType : null);
  const [state, action] = useActionState<DraftFormState, FormData>(
    saveCoachEventDraftAction,
    { issue: null },
    permalink,
  );
  const values = state.values ?? initial;
  if (
    state.issue &&
    ["actor-changed", "forbidden", "signed-out"].includes(state.issue)
  )
    return (
      <section role="alert" className="coach-event-notice">
        <p>
          {ownerIssueMessage(state.issue) ??
            "Your access changed. Reload before continuing."}
        </p>
        <a href={permalink}>Reload and verify access</a>
      </section>
    );
  return (
    <form action={action} className="coach-event-form">
      <input type="hidden" name="intent" value="save-draft" />
      <label>
        Session type
        <select
          name="sessionTypeId"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="">Custom group · no type</option>
          {context.sessionTypes
            ?.filter((t) => t.format === "group" && !t.archived)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.durationMinutes} min
                {!t.bookable ? " · Coach draft only" : ""}
              </option>
            ))}
          {sessionType?.archived && (
            <option value={sessionType.id}>{sessionType.name} · Removed</option>
          )}
        </select>
      </label>
      <input
        type="hidden"
        name="sessionTypeRevision"
        value={type?.revision ?? ""}
      />
      {type && (
        <button
          type="button"
          className="button secondary"
          onClick={(e) => {
            const form = e.currentTarget.form;
            if (!form) return;
            const set = (name: string, value: string) => {
              const field = form.elements.namedItem(name);
              if (
                field instanceof HTMLInputElement ||
                field instanceof HTMLTextAreaElement ||
                field instanceof HTMLSelectElement
              )
                field.value = value;
            };
            set("title", type.name);
            set("description", type.description);
            if (type.defaultLocationId)
              set("locationId", type.defaultLocationId);
            const start = form.elements.namedItem("startsAt");
            if (start instanceof HTMLInputElement) {
              const instant = berlinLocalInstant(start.value);
              if (instant)
                set(
                  "endsAt",
                  berlinLocalInput(
                    new Date(
                      Date.parse(instant) + type.durationMinutes * 60000,
                    ).toISOString(),
                  ),
                );
            }
          }}
        >
          Use type defaults · review before saving
        </button>
      )}
      {type && (
        <p>
          Prefills title, description and default venue. Choose a start first to
          prefill the {type.durationMinutes}-minute end. Capacity, deadline and
          publication still require your review.
        </p>
      )}
      <input type="hidden" name="sessionId" value={id} />
      <input type="hidden" name="revision" value={revision ?? ""} />
      <input type="hidden" name="actorScope" value={context.scope} />
      {state.issue && (
        <div role="alert" className="coach-event-notice">
          <p>{ownerIssueMessage(state.issue)}</p>
          <Link href={coachEventHref(id)}>
            Check the saved draft before retrying
          </Link>
          <p>
            Your proposed fields remain here. A stale save cannot overwrite a
            newer revision.
          </p>
        </div>
      )}
      <label>
        Session title
        <input
          name="title"
          required
          minLength={3}
          maxLength={120}
          defaultValue={values.title}
        />
      </label>
      <label>
        Description
        <textarea
          name="description"
          aria-label="Description"
          aria-describedby="coach-event-description-help"
          rows={4}
          maxLength={2000}
          defaultValue={values.description}
        />
        <small id="coach-event-description-help">
          Plain text, up to 2,000 characters. Include what athletes should
          bring.
        </small>
      </label>
      <div className="coach-event-fields">
        <label>
          Discipline
          <select
            name="discipline"
            required
            defaultValue={values.discipline || context.disciplines[0]}
          >
            {context.disciplines.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Intended level
          <input
            name="intendedLevel"
            required
            maxLength={80}
            defaultValue={values.intendedLevel}
          />
        </label>
      </div>
      <label>
        Training venue
        <select
          name="locationId"
          required
          defaultValue={values.locationId || context.locations[0]?.id}
        >
          {!context.locations.some(
            (location) => location.id === values.locationId,
          ) &&
            values.locationId && (
              <option value={values.locationId} disabled>
                Previously selected venue is inactive — choose a current venue
              </option>
            )}
          {context.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} · {location.label}
            </option>
          ))}
        </select>
      </label>
      <p className="coach-event-hint">
        All times use Europe/Berlin. Choose a decision deadline before the
        session starts. Times skipped or repeated when clocks change cannot be
        used.
      </p>
      <div className="coach-event-fields">
        <label>
          Starts at
          <input
            type="datetime-local"
            name="startsAt"
            required
            defaultValue={values.startsAt}
          />
        </label>
        <label>
          Ends at
          <input
            type="datetime-local"
            name="endsAt"
            required
            defaultValue={values.endsAt}
          />
        </label>
      </div>
      <label>
        Coach decision deadline
        <input
          type="datetime-local"
          name="decisionDeadlineAt"
          aria-label="Coach decision deadline"
          aria-describedby="coach-event-deadline-help"
          required
          defaultValue={values.decisionDeadlineAt}
        />
        <small id="coach-event-deadline-help">
          Without your explicit confirmation before this time, the session
          becomes Not confirmed.
        </small>
      </label>
      <div className="coach-event-fields">
        <label>
          Minimum participants
          <input
            type="number"
            name="minimumParticipants"
            required
            min={1}
            max={100}
            step={1}
            defaultValue={values.minimumParticipants}
          />
        </label>
        <label>
          Maximum participants
          <input
            type="number"
            name="maximumParticipants"
            required
            min={1}
            max={100}
            step={1}
            defaultValue={values.maximumParticipants}
          />
        </label>
      </div>
      <label>
        Price per person (EUR)
        <input
          name="price"
          aria-label="Price per person (EUR)"
          aria-describedby="coach-event-price-help"
          inputMode="decimal"
          required
          pattern="(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?"
          defaultValue={values.price}
        />
        <small id="coach-event-price-help">
          Enter 0 for Free, or an amount such as 15.50. Include all required
          venue/participation costs. Athletes pay you at the session; MovX does
          not collect or verify payment.
        </small>
      </label>
      <div className="coach-event-actions">
        <Submit>Save draft and review</Submit>
        <Link href="/coach/events">Back to Events</Link>
      </div>
      <p>Saving a draft does not publish it or reserve your time.</p>
      {revision === null && (
        <p>After saving the draft, you can add its optional event banner.</p>
      )}
    </form>
  );
}
export function CoachEventDecisionForm({
  id,
  scope,
  revision,
  intent,
  label,
  acknowledgement,
}: {
  id: string;
  scope: string;
  revision: number;
  intent: "publish" | "confirm" | "cancel" | "delete-draft";
  label: string;
  acknowledgement: string;
}) {
  return (
    <form action={decideCoachEventAction} className="coach-event-decision">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="sessionId" value={id} />
      <input type="hidden" name="actorScope" value={scope} />
      {(intent === "publish" || intent === "delete-draft") && (
        <input type="hidden" name="revision" value={revision} />
      )}
      <label className="coach-event-ack">
        <input type="checkbox" name="acknowledge" value="yes" required />
        <span>{acknowledgement}</span>
      </label>
      <Submit>{label}</Submit>
    </form>
  );
}
