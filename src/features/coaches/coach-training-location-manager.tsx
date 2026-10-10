"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Star,
} from "lucide-react";
import type {
  CoachGymOption,
  CoachProjection,
  CoachTrainingLocation,
} from "@/domain/coaches";
import type { LocationSearchConfiguration } from "@/location";
import {
  createCoachTrainingLocationAction,
  deactivateCoachTrainingLocationAction,
  setCoachPrimaryLocationAction,
  updateCoachTrainingLocationAction,
  type CoachTrainingLocationActionState,
} from "@/app/profile/coach/actions";
import { CoachLocationPicker } from "./coach-location-picker";

const INITIAL_LOCATION_ACTION_STATE: CoachTrainingLocationActionState =
  Object.freeze({ status: "idle", message: "", errors: Object.freeze([]) });

function LocationActionResult({
  state,
}: {
  state: CoachTrainingLocationActionState;
}) {
  if (state.status === "idle") return null;
  return (
    <div
      className={`coach-location-action-result ${state.status}`}
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
    </div>
  );
}

function EmptyPickerFields() {
  return (
    <>
      <input type="hidden" name="publicName" value="" />
      <input type="hidden" name="locationLabel" value="" />
      <input type="hidden" name="latitude" value="" />
      <input type="hidden" name="longitude" value="" />
      <input type="hidden" name="locationSource" value="manual" />
      <input type="hidden" name="locationProvider" value="" />
      <input type="hidden" name="locationConfirmation" value="confirmed" />
    </>
  );
}

function LocationFields({
  location,
  gyms,
  searchConfiguration,
}: {
  location: CoachTrainingLocation | null;
  gyms: readonly CoachGymOption[];
  searchConfiguration: LocationSearchConfiguration;
}) {
  const [kind, setKind] = useState<"gym" | "independent">(
    location?.location.kind ?? (gyms.length > 0 ? "gym" : "independent"),
  );
  const [selectedGymId, setSelectedGymId] = useState(
    location?.selectedGymId ?? "",
  );
  const [publicName, setPublicName] = useState(location?.publicName ?? "");

  return (
    <>
      <input type="hidden" name="kind" value={kind} />
      <div
        className="coach-location-mode"
        role="group"
        aria-label="Training location type"
      >
        <button
          type="button"
          className={kind === "gym" ? "active" : ""}
          aria-pressed={kind === "gym"}
          onClick={() => setKind("gym")}
        >
          Reviewed gym
        </button>
        <button
          type="button"
          className={kind === "independent" ? "active" : ""}
          aria-pressed={kind === "independent"}
          onClick={() => setKind("independent")}
        >
          Independent place
        </button>
      </div>

      {kind === "gym" ? (
        <>
          <label className="coach-field coach-field-wide">
            <span>Select a reviewed gym</span>
            <select
              name="selectedGymId"
              value={selectedGymId}
              onChange={(event) => setSelectedGymId(event.target.value)}
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
              MovX copies the reviewed public label and coordinates. The gym
              receives no account access or authority.
            </small>
          </label>
          <EmptyPickerFields />
        </>
      ) : (
        <>
          <input type="hidden" name="selectedGymId" value="" />
          <label className="coach-field coach-field-wide">
            <span>Short public location name</span>
            <input
              name="publicName"
              value={publicName}
              onChange={(event) => setPublicName(event.target.value)}
              minLength={2}
              maxLength={240}
              placeholder="For example: Tempelhofer outdoor training"
              required
            />
            <small>
              This short name appears in your location list; the confirmed label
              below can include the exact entrance or meeting point.
            </small>
          </label>
          <CoachLocationPicker
            initialLocation={
              location?.location.kind === "independent"
                ? location.location
                : null
            }
            searchConfiguration={searchConfiguration}
          />
        </>
      )}
    </>
  );
}

function AddLocationForm({
  gyms,
  searchConfiguration,
}: {
  gyms: readonly CoachGymOption[];
  searchConfiguration: LocationSearchConfiguration;
}) {
  const [state, formAction, pending] = useActionState(
    createCoachTrainingLocationAction,
    INITIAL_LOCATION_ACTION_STATE,
  );
  const [open, setOpen] = useState(false);
  return (
    <details
      className="coach-location-disclosure coach-location-add"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <Plus size={17} aria-hidden="true" /> Add training location
      </summary>
      {open && (
        <form action={formAction} className="coach-location-edit-form">
          <LocationFields
            location={null}
            gyms={gyms}
            searchConfiguration={searchConfiguration}
          />
          <LocationActionResult state={state} />
          <button className="button dark" type="submit" disabled={pending}>
            <Save size={15} aria-hidden="true" />
            {pending ? "Adding…" : "Add location"}
          </button>
        </form>
      )}
    </details>
  );
}

function ActiveLocationCard({
  location,
  primary,
  activeLocations,
  gyms,
  searchConfiguration,
  deactivateAction,
  deactivating,
}: {
  location: CoachTrainingLocation;
  primary: CoachTrainingLocation;
  activeLocations: readonly CoachTrainingLocation[];
  gyms: readonly CoachGymOption[];
  searchConfiguration: LocationSearchConfiguration;
  deactivateAction: (formData: FormData) => void;
  deactivating: boolean;
}) {
  const [updateState, updateAction, updating] = useActionState(
    updateCoachTrainingLocationAction,
    INITIAL_LOCATION_ACTION_STATE,
  );
  const [primaryState, primaryAction, settingPrimary] = useActionState(
    setCoachPrimaryLocationAction,
    INITIAL_LOCATION_ACTION_STATE,
  );
  const replacementLocations = activeLocations.filter(
    (candidate) => candidate.id !== location.id,
  );
  const [replacementId, setReplacementId] = useState(
    replacementLocations[0]?.id ?? "",
  );
  const [editOpen, setEditOpen] = useState(false);
  const replacement = replacementLocations.find(
    (candidate) => candidate.id === replacementId,
  );
  const mayDeactivate = !location.isPrimary || replacementLocations.length > 0;

  return (
    <article className="coach-training-location-card">
      <header>
        <div className="coach-training-location-icon">
          {location.isPrimary ? (
            <Star size={18} aria-hidden="true" />
          ) : (
            <MapPin size={18} aria-hidden="true" />
          )}
        </div>
        <div>
          <div className="coach-training-location-title">
            <h3>{location.publicName}</h3>
            {location.isPrimary && <span>Primary</span>}
          </div>
          <p>{location.location.label}</p>
          <small>
            {location.location.kind === "gym"
              ? "Reviewed gym snapshot"
              : "Coach-confirmed independent place"}
            {location.isPrimary
              ? " · public training base, not live presence"
              : ""}
          </small>
        </div>
      </header>

      {!location.isPrimary && (
        <form action={primaryAction} className="coach-location-inline-action">
          <input type="hidden" name="locationId" value={location.id} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={location.updatedAt}
          />
          <input type="hidden" name="primaryLocationId" value={primary.id} />
          <input
            type="hidden"
            name="primaryUpdatedAt"
            value={primary.updatedAt}
          />
          <button
            className="button secondary"
            type="submit"
            disabled={settingPrimary}
          >
            <Star size={14} aria-hidden="true" />
            {settingPrimary ? "Changing…" : "Set as primary"}
          </button>
          <LocationActionResult state={primaryState} />
        </form>
      )}

      <div className="coach-training-location-actions">
        <details
          className="coach-location-disclosure"
          onToggle={(event) => setEditOpen(event.currentTarget.open)}
        >
          <summary>
            <Pencil size={15} aria-hidden="true" /> Edit
          </summary>
          {editOpen && (
            <form action={updateAction} className="coach-location-edit-form">
              <input type="hidden" name="locationId" value={location.id} />
              <input
                type="hidden"
                name="expectedUpdatedAt"
                value={location.updatedAt}
              />
              <LocationFields
                location={location}
                gyms={gyms}
                searchConfiguration={searchConfiguration}
              />
              <LocationActionResult state={updateState} />
              <button className="button dark" type="submit" disabled={updating}>
                <Save size={15} aria-hidden="true" />
                {updating ? "Saving…" : "Save location"}
              </button>
            </form>
          )}
        </details>

        <details className="coach-location-disclosure danger">
          <summary
            aria-disabled={!mayDeactivate}
            title={
              mayDeactivate
                ? undefined
                : "Add another active location before deactivating the only primary location."
            }
          >
            <Archive size={15} aria-hidden="true" /> Deactivate
          </summary>
          {mayDeactivate ? (
            <form
              action={deactivateAction}
              className="coach-location-deactivate-form"
            >
              <input type="hidden" name="locationId" value={location.id} />
              <input
                type="hidden"
                name="expectedUpdatedAt"
                value={location.updatedAt}
              />
              <p>
                Future open availability at this location will be withdrawn.
                Existing bookings and history keep their saved venue snapshot.
              </p>
              {location.isPrimary && (
                <label className="coach-field">
                  <span>Replacement primary location</span>
                  <select
                    name="replacementId"
                    value={replacementId}
                    onChange={(event) => setReplacementId(event.target.value)}
                    required
                  >
                    {replacementLocations.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.publicName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <input
                type="hidden"
                name="replacementUpdatedAt"
                value={location.isPrimary ? (replacement?.updatedAt ?? "") : ""}
              />
              <button
                className="button danger"
                type="submit"
                disabled={deactivating || (location.isPrimary && !replacement)}
              >
                <Archive size={15} aria-hidden="true" />
                {deactivating ? "Deactivating…" : "Deactivate location"}
              </button>
            </form>
          ) : (
            <p className="coach-location-protected-primary" role="status">
              This is your only active primary location. Add another location
              before deactivating it.
            </p>
          )}
        </details>
      </div>
    </article>
  );
}

export function CoachTrainingLocationManager({
  coach,
  gyms,
  searchConfiguration,
  publicationAllowed,
}: {
  coach: CoachProjection;
  gyms: readonly CoachGymOption[];
  searchConfiguration: LocationSearchConfiguration;
  publicationAllowed: boolean;
}) {
  const [deactivateState, deactivateAction, deactivating] = useActionState(
    deactivateCoachTrainingLocationAction,
    INITIAL_LOCATION_ACTION_STATE,
  );
  const activeLocations = useMemo(
    () =>
      [...coach.locations]
        .filter((location) => location.status === "active")
        .sort(
          (left, right) =>
            Number(right.isPrimary) - Number(left.isPrimary) ||
            left.sortOrder - right.sortOrder,
        ),
    [coach.locations],
  );
  const inactiveLocations = useMemo(
    () =>
      [...coach.locations]
        .filter((location) => location.status === "inactive")
        .sort((left, right) => left.sortOrder - right.sortOrder),
    [coach.locations],
  );
  const primary = activeLocations.find((location) => location.isPrimary);
  if (!primary) return null;

  return (
    <section
      className="coach-location-manager"
      aria-labelledby="locations-title"
    >
      <header className="coach-location-manager-heading">
        <div>
          <span className="eyebrow">TRAINING LOCATIONS</span>
          <h2 id="locations-title">Manage where you coach.</h2>
          <p>
            {publicationAllowed
              ? "Active locations appear on your public profile. Your primary location is the permanent Explore map base, not your live position."
              : "These locations stay inside your private application draft until MovX approves the application and you choose to publish."}
          </p>
        </div>
        <div className="coach-location-count">
          <strong>{activeLocations.length}</strong>
          <span>active</span>
        </div>
      </header>

      <LocationActionResult state={deactivateState} />

      <div className="coach-training-location-list">
        {activeLocations.map((location) => (
          <ActiveLocationCard
            key={location.id}
            location={location}
            primary={primary}
            activeLocations={activeLocations}
            gyms={gyms}
            searchConfiguration={searchConfiguration}
            deactivateAction={deactivateAction}
            deactivating={deactivating}
          />
        ))}
      </div>

      <AddLocationForm gyms={gyms} searchConfiguration={searchConfiguration} />

      {inactiveLocations.length > 0 && (
        <details className="coach-inactive-locations">
          <summary>Inactive locations ({inactiveLocations.length})</summary>
          <ul>
            {inactiveLocations.map((location) => (
              <li key={location.id}>
                <Archive size={15} aria-hidden="true" />
                <span>
                  <strong>{location.publicName}</strong>
                  <small>
                    {location.location.label} · retained for booking and
                    schedule history
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="coach-location-manager-note">
        <CheckCircle2 size={18} aria-hidden="true" />
        <p>
          Location edits are local until you use their Save button. Search helps
          select a place, but MovX stores only the provider-neutral snapshot you
          explicitly confirm.
        </p>
      </div>
    </section>
  );
}
