"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, Eye, EyeOff, MapPin, Save, ShieldCheck } from "lucide-react";
import type {
  CoachAccessProjection,
  CoachGymOption,
  CoachProjection,
} from "@/domain/coaches";
import { COACH_DISCIPLINES } from "@/domain/coaches";
import type { LocationSearchConfiguration } from "@/location";
import {
  type CoachProfileActionState,
  updateCoachProfileAction,
} from "@/app/profile/coach/actions";
import { CoachLocationPicker } from "./coach-location-picker";
import { CoachApplicationBanner } from "./coach-application-gate";
import { CoachProfileLocations } from "./coach-profile-locations";
import { CoachProfilePreview } from "./coach-profile-preview";
import { ProfileImageUploader } from "@/features/profile/profile-image-uploader";
import { profileInitials } from "@/auth/profile-presentation";
import { CoachWorkspaceHeader } from "./coach-workspace-header";
import { CoachTrainingLocationManager } from "./coach-training-location-manager";
import { CoachPublicUrlSettings } from "./coach-public-url-settings";
import type { CoachPublicHandleResult } from "@/domain/coach-public-url";
import "./coach-public-url-settings.css";

const INITIAL_COACH_PROFILE_ACTION_STATE: CoachProfileActionState =
  Object.freeze({ status: "idle", message: "", errors: Object.freeze([]) });

export function CoachProfileEditor({
  coach,
  gyms,
  ownerDisplayName,
  coachAccess,
  locationSearchConfiguration,
  publicUrl,
}: {
  coach: CoachProjection | null;
  gyms: readonly CoachGymOption[];
  ownerDisplayName: string;
  coachAccess: CoachAccessProjection;
  locationSearchConfiguration: LocationSearchConfiguration;
  publicUrl?: CoachPublicHandleResult;
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
  const activeLocations =
    coach?.locations.filter((location) => location.status === "active") ?? [];

  return (
    <div className="coach-workspace coach-editor">
      <CoachWorkspaceHeader
        coach={coach}
        ownerDisplayName={ownerDisplayName}
        view="profile"
        profileReturnHref={publicationAllowed ? "/coach" : "/profile"}
      />
      <header className="coach-profile-view-heading">
        <div>
          <span className="eyebrow">
            {publicationAllowed
              ? "APPROVED COACH PROFILE"
              : "PRIVATE COACH APPLICATION DRAFT"}
          </span>
          <h2>
            {coach && publicationAllowed
              ? "Edit your public coach profile."
              : coach
                ? "Edit your private coach profile draft."
                : "Become discoverable as a coach."}
          </h2>
          <p>
            {publicationAllowed
              ? "Choose what athletes may see. MovX approval is separate from profile visibility and gives no gym control over your profile."
              : "Prepare the profile MovX will review. It remains private until the application is approved."}
          </p>
        </div>
      </header>

      <CoachApplicationBanner access={coachAccess} />
      {publicationAllowed && publicUrl && (
        <CoachPublicUrlSettings
          key={
            publicUrl.status === "ready"
              ? `${publicUrl.username}:${publicUrl.revision}:${publicUrl.confirmed}`
              : publicUrl.status
          }
          initial={publicUrl}
          visible={coach?.visibility === "visible"}
        />
      )}

      <div className={`coach-profile-layout${coach ? "" : " no-preview"}`}>
        <div className="coach-profile-editor-column">
          {publicationAllowed && coach && (
            <ProfileImageUploader
              endpoint="/api/coach/portrait"
              currentImageUrl={coach.portraitUrl}
              displayName={coach.displayName}
              initials={profileInitials(coach.displayName)}
              kind="coach"
            />
          )}

          <form className="coach-editor-form" action={formAction}>
            <section className="coach-editor-panel">
              <div className="coach-editor-section-title">
                <span>01</span>
                <div>
                  <h2>Your coaching identity</h2>
                  <p>
                    Use a public name, a useful biography and up to four
                    focuses.
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
                  <h2>
                    {coach
                      ? "Scheduling settings"
                      : "Your first training place"}
                  </h2>
                  <p>
                    {coach
                      ? "One timezone applies to every location and recurring hour. Manage places separately after saving profile details."
                      : "Create the first confirmed primary location for your coach profile. You can add more after this initial save."}
                  </p>
                </div>
              </div>
              {!coach && (
                <>
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
                      Reviewed gym
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
                    <label className="coach-field coach-field-wide">
                      <span>Select a reviewed gym</span>
                      <select name="selectedGymId" defaultValue="" required>
                        <option value="">Choose a gym</option>
                        {gyms.map((gym) => (
                          <option key={gym.id} value={gym.id}>
                            {gym.name} — {gym.locationLabel}
                          </option>
                        ))}
                      </select>
                      <small>
                        MovX copies its reviewed public label and coordinates.
                        The gym receives no account or authority.
                      </small>
                    </label>
                  ) : (
                    <>
                      <input type="hidden" name="selectedGymId" value="" />
                      <CoachLocationPicker
                        initialLocation={null}
                        searchConfiguration={locationSearchConfiguration}
                      />
                    </>
                  )}
                  {locationMode === "gym" && (
                    <>
                      <input type="hidden" name="locationLabel" value="" />
                      <input type="hidden" name="latitude" value="" />
                      <input type="hidden" name="longitude" value="" />
                      <input
                        type="hidden"
                        name="locationSource"
                        value="manual"
                      />
                      <input type="hidden" name="locationProvider" value="" />
                      <input
                        type="hidden"
                        name="locationConfirmation"
                        value="confirmed"
                      />
                    </>
                  )}
                </>
              )}
              {coach && (
                <>
                  <input
                    type="hidden"
                    name="selectedGymId"
                    value={coach.selectedGymId ?? ""}
                  />
                  <input
                    type="hidden"
                    name="locationLabel"
                    value={
                      coach.location.kind === "independent"
                        ? coach.location.label
                        : ""
                    }
                  />
                  <input
                    type="hidden"
                    name="latitude"
                    value={
                      coach.location.kind === "independent"
                        ? coach.location.latitude
                        : ""
                    }
                  />
                  <input
                    type="hidden"
                    name="longitude"
                    value={
                      coach.location.kind === "independent"
                        ? coach.location.longitude
                        : ""
                    }
                  />
                  <input
                    type="hidden"
                    name="locationSource"
                    value={
                      coach.location.kind === "independent"
                        ? coach.location.source === "permanent-geocoding"
                          ? "permanent-geocoding"
                          : "manual"
                        : "manual"
                    }
                  />
                  <input
                    type="hidden"
                    name="locationProvider"
                    value={
                      coach.location.kind === "independent" &&
                      coach.location.source === "permanent-geocoding"
                        ? (coach.location.provider ?? "")
                        : ""
                    }
                  />
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
                      <small>
                        Show the completed profile in public discovery.
                      </small>
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
                  <Link href={`/coaches/${state.slug}`}>
                    Open public profile
                  </Link>
                )}
              </div>
            )}

            <div className="coach-editor-submit">
              <div>
                <ShieldCheck size={20} aria-hidden="true" />
                <span>
                  {coach
                    ? "Profile details save separately from the explicit location controls below."
                    : "Saving confirms this first place. It does not publish availability."}
                </span>
              </div>
              <button className="button dark" type="submit" disabled={pending}>
                <Save size={16} aria-hidden="true" />
                {pending ? "Saving…" : "Save coach profile"}
              </button>
            </div>
          </form>
        </div>
        {coach && (
          <CoachProfilePreview
            coach={coach}
            publicationAllowed={publicationAllowed}
          />
        )}
      </div>

      {coach && publicationAllowed && activeLocations.length > 0 && (
        <div className="coach-profile-location-overview">
          <CoachProfileLocations
            coachName={coach.displayName}
            locations={activeLocations}
          />
        </div>
      )}

      {coach && (
        <CoachTrainingLocationManager
          coach={coach}
          gyms={gyms}
          searchConfiguration={locationSearchConfiguration}
          publicationAllowed={publicationAllowed}
        />
      )}

      <div className="coach-location-followup">
        <MapPin size={19} aria-hidden="true" />
        <p>
          Place search assists selection only. MovX stores the provider-neutral
          location you explicitly confirm, never device or live location.
        </p>
      </div>
    </div>
  );
}
