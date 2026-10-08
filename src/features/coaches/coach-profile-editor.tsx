"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  CalendarClock,
  Check,
  Eye,
  EyeOff,
  MapPin,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type {
  CoachAccessProjection,
  CoachGymOption,
  CoachProjection,
} from "@/domain/coaches";
import { COACH_DISCIPLINES } from "@/domain/coaches";
import type { MapboxBrowserConfiguration } from "@/mapbox/provider";
import {
  type CoachProfileActionState,
  updateCoachProfileAction,
} from "@/app/profile/coach/actions";
import { CoachLocationPicker } from "./coach-location-picker";
import { CoachApplicationBanner } from "./coach-application-gate";

const INITIAL_COACH_PROFILE_ACTION_STATE: CoachProfileActionState =
  Object.freeze({ status: "idle", message: "", errors: Object.freeze([]) });

export function CoachProfileEditor({
  coach,
  gyms,
  ownerDisplayName,
  coachAccess,
  mapboxConfiguration,
}: {
  coach: CoachProjection | null;
  gyms: readonly CoachGymOption[];
  ownerDisplayName: string;
  coachAccess: CoachAccessProjection;
  mapboxConfiguration: MapboxBrowserConfiguration;
}) {
  const [state, formAction, pending] = useActionState(
    updateCoachProfileAction,
    INITIAL_COACH_PROFILE_ACTION_STATE,
  );
  const [locationMode, setLocationMode] = useState<"gym" | "independent">(
    coach?.location.kind ?? "gym",
  );
  const initialDisciplines = new Set(coach?.disciplines ?? []);
  const publicationAllowed =
    coachAccess.status === "approved" || coachAccess.status === "demo";

  return (
    <div className="coach-editor">
      <nav className="coach-workspace-nav" aria-label="Coach workspace">
        <Link href="/coach">
          <CalendarClock size={17} aria-hidden="true" /> Availability
        </Link>
        <Link href="/profile/coach" aria-current="page" className="active">
          <UserRound size={17} aria-hidden="true" /> Profile
        </Link>
      </nav>
      <header className="coach-editor-heading">
        <div>
          <span className="eyebrow">
            {publicationAllowed
              ? "APPROVED COACH PROFILE"
              : "PRIVATE COACH APPLICATION DRAFT"}
          </span>
          <h1>
            {coach
              ? "Edit your public coach profile."
              : "Become discoverable as a coach."}
          </h1>
          <p>
            {publicationAllowed
              ? "Choose what clients may see. MovX approval is separate from profile visibility and gives no gym control over your profile."
              : "Prepare the profile MovX will review. It remains private until the application is approved."}
          </p>
        </div>
        {publicationAllowed && coach?.visibility === "visible" && (
          <Link className="button secondary" href={`/coaches/${coach.slug}`}>
            <Eye size={16} aria-hidden="true" /> View public profile
          </Link>
        )}
      </header>

      <CoachApplicationBanner access={coachAccess} />

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
            <>
              <input type="hidden" name="selectedGymId" value="" />
              <CoachLocationPicker
                initialLocation={
                  coach?.location.kind === "independent" ? coach.location : null
                }
                mapboxConfiguration={mapboxConfiguration}
              />
            </>
          )}
          {locationMode === "gym" && (
            <>
              <input type="hidden" name="locationLabel" value="" />
              <input type="hidden" name="latitude" value="" />
              <input type="hidden" name="longitude" value="" />
              <input type="hidden" name="locationSource" value="manual" />
              <input type="hidden" name="locationProvider" value="" />
              <input
                type="hidden"
                name="locationConfirmation"
                value="confirmed"
              />
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
          {publicationAllowed ? (
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
          ) : (
            <div className="coach-editor-draft-visibility">
              <EyeOff size={18} aria-hidden="true" />
              <div>
                <strong>Private while under review</strong>
                <small>
                  MovX will unlock public visibility only after approval.
                </small>
              </div>
              <input type="hidden" name="visibility" value="hidden" />
            </div>
          )}
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
          Mapbox assists selection only. MovX stores the provider-neutral
          location you explicitly confirm, never device or live location.
        </p>
      </div>
    </div>
  );
}
