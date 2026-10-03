"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, Eye, EyeOff, MapPin, Save, ShieldCheck } from "lucide-react";
import type { CoachGymOption, CoachProjection } from "@/domain/coaches";
import { COACH_DISCIPLINES } from "@/domain/coaches";
import {
  INITIAL_COACH_PROFILE_ACTION_STATE,
  updateCoachProfileAction,
} from "@/app/profile/coach/actions";

export function CoachProfileEditor({
  coach,
  gyms,
  ownerDisplayName,
}: {
  coach: CoachProjection | null;
  gyms: readonly CoachGymOption[];
  ownerDisplayName: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateCoachProfileAction,
    INITIAL_COACH_PROFILE_ACTION_STATE,
  );
  const [locationMode, setLocationMode] = useState<"gym" | "independent">(
    coach?.location.kind ?? "gym",
  );
  const initialDisciplines = new Set(coach?.disciplines ?? []);

  return (
    <div className="coach-editor">
      <header className="coach-editor-heading">
        <div>
          <span className="eyebrow">SELF-DECLARED COACH PROFILE</span>
          <h1>
            {coach
              ? "Edit your public coach profile."
              : "Become discoverable as a coach."}
          </h1>
          <p>
            Choose what clients may see. This does not verify credentials and
            does not give a gym control over your profile.
          </p>
        </div>
        {coach?.visibility === "visible" && (
          <Link className="button secondary" href={`/coaches/${coach.slug}`}>
            <Eye size={16} aria-hidden="true" /> View public profile
          </Link>
        )}
      </header>

      <form className="coach-editor-form" action={formAction}>
        <section className="coach-editor-panel">
          <div className="coach-editor-section-title">
            <span>01</span>
            <div>
              <h2>Your coaching identity</h2>
              <p>
                Use a public name, a useful biography and up to four focuses.
              </p>
            </div>
          </div>
          <label className="coach-field">
            <span>Public display name</span>
            <input
              name="displayName"
              defaultValue={coach?.displayName ?? ownerDisplayName}
              minLength={2}
              maxLength={80}
              required
            />
          </label>
          <label className="coach-field">
            <span>Biography</span>
            <textarea
              name="bio"
              defaultValue={coach?.bio ?? ""}
              minLength={40}
              maxLength={1200}
              rows={6}
              placeholder="Explain who you help, how you coach and what a private session feels like."
              required
            />
            <small>
              40–1,200 characters. Do not claim unverified credentials.
            </small>
          </label>
          <fieldset className="coach-discipline-fieldset">
            <legend>Disciplines</legend>
            <p>Choose one to four.</p>
            <div>
              {COACH_DISCIPLINES.map((discipline) => (
                <label key={discipline}>
                  <input
                    type="checkbox"
                    name="disciplines"
                    value={discipline}
                    defaultChecked={initialDisciplines.has(discipline)}
                  />
                  <span>
                    <Check size={14} aria-hidden="true" /> {discipline}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="coach-editor-panel">
          <div className="coach-editor-section-title">
            <span>02</span>
            <div>
              <h2>Your public training place</h2>
              <p>One coach-confirmed discovery point, never live location.</p>
            </div>
          </div>
          <div
            className="coach-location-mode"
            role="group"
            aria-label="Location type"
          >
            <button
              type="button"
              className={locationMode === "gym" ? "active" : ""}
              aria-pressed={locationMode === "gym"}
              onClick={() => setLocationMode("gym")}
            >
              Fictional gym
            </button>
            <button
              type="button"
              className={locationMode === "independent" ? "active" : ""}
              aria-pressed={locationMode === "independent"}
              onClick={() => setLocationMode("independent")}
            >
              Independent place
            </button>
          </div>

          {locationMode === "gym" ? (
            <label className="coach-field">
              <span>Select a fictional gym</span>
              <select
                name="selectedGymId"
                defaultValue={coach?.selectedGymId ?? ""}
                required
              >
                <option value="">Choose a gym</option>
                {gyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name} — {gym.locationLabel}
                  </option>
                ))}
              </select>
              <small>
                MovX copies its reviewed public label and coordinates. The gym
                receives no account or authority.
              </small>
            </label>
          ) : (
            <div className="coach-independent-fields">
              <input type="hidden" name="selectedGymId" value="" />
              <input type="hidden" name="locationSource" value="manual" />
              <input type="hidden" name="locationProvider" value="" />
              <label className="coach-field coach-field-wide">
                <span>Public location label</span>
                <input
                  name="locationLabel"
                  defaultValue={
                    coach?.location.kind === "independent"
                      ? coach.location.label
                      : ""
                  }
                  maxLength={240}
                  placeholder="For example: Tempelhofer Feld — main entrance"
                  required
                />
              </label>
              <label className="coach-field">
                <span>Latitude</span>
                <input
                  name="latitude"
                  type="number"
                  step="0.000001"
                  min="-90"
                  max="90"
                  defaultValue={
                    coach?.location.kind === "independent"
                      ? coach.location.latitude
                      : ""
                  }
                  required
                />
              </label>
              <label className="coach-field">
                <span>Longitude</span>
                <input
                  name="longitude"
                  type="number"
                  step="0.000001"
                  min="-180"
                  max="180"
                  defaultValue={
                    coach?.location.kind === "independent"
                      ? coach.location.longitude
                      : ""
                  }
                  required
                />
              </label>
            </div>
          )}
          {locationMode === "gym" && (
            <>
              <input type="hidden" name="locationLabel" value="" />
              <input type="hidden" name="latitude" value="" />
              <input type="hidden" name="longitude" value="" />
              <input type="hidden" name="locationSource" value="manual" />
              <input type="hidden" name="locationProvider" value="" />
            </>
          )}
          <label className="coach-field">
            <span>Profile timezone</span>
            <input
              name="timezone"
              defaultValue={coach?.timezone ?? "Europe/Berlin"}
              maxLength={80}
              required
            />
            <small>Used later to review weekly training times.</small>
          </label>
        </section>

        <section className="coach-editor-panel">
          <div className="coach-editor-section-title">
            <span>03</span>
            <div>
              <h2>Discovery visibility</h2>
              <p>Hidden profiles remain available only to their owner.</p>
            </div>
          </div>
          <div className="coach-visibility-options">
            <label>
              <input
                type="radio"
                name="visibility"
                value="visible"
                defaultChecked={coach?.visibility === "visible"}
              />
              <span>
                <Eye size={18} aria-hidden="true" />
                <strong>Visible</strong>
                <small>Show the completed profile in public discovery.</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="visibility"
                value="hidden"
                defaultChecked={!coach || coach.visibility === "hidden"}
              />
              <span>
                <EyeOff size={18} aria-hidden="true" />
                <strong>Hidden</strong>
                <small>Save the profile without publishing it.</small>
              </span>
            </label>
          </div>
        </section>

        {state.status !== "idle" && (
          <div
            className={`coach-editor-result ${state.status}`}
            role={state.status === "saved" ? "status" : "alert"}
            aria-live="polite"
          >
            <strong>{state.message}</strong>
            {state.errors.length > 0 && (
              <ul>
                {state.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            {state.status === "saved" && state.slug && (
              <Link href={`/coaches/${state.slug}`}>Open public profile</Link>
            )}
          </div>
        )}

        <div className="coach-editor-submit">
          <div>
            <ShieldCheck size={20} aria-hidden="true" />
            <span>
              Saving confirms this place for public discovery. It does not
              publish availability.
            </span>
          </div>
          <button className="button dark" type="submit" disabled={pending}>
            <Save size={16} aria-hidden="true" />
            {pending ? "Saving…" : "Save coach profile"}
          </button>
        </div>
      </form>

      <div className="coach-mapbox-followup">
        <MapPin size={19} aria-hidden="true" />
        <p>
          Map-assisted location search arrives in a separate ticket. This form
          stores only the provider-neutral location contract needed now.
        </p>
      </div>
    </div>
  );
}
