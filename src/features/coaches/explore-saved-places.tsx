"use client";

import { useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Home,
  LocateFixed,
  MapPin,
  Search,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/ui";
import {
  searchLocations,
  type LocationCandidate,
  type LocationSearchConfiguration,
} from "@/location";
import { LocationSearchAttribution } from "@/location/components/location-search-attribution";
import {
  isExplorePlace,
  type ExplorePlace,
  type ExplorePoint,
  type ExplorePreferences,
} from "./explore-discovery-model";

export function readDeviceLocation(): Promise<ExplorePlace> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new Error(
          "Location is unavailable in this browser. Choose a saved place or search by area.",
        ),
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          label: "Current location",
        }),
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? "Location permission was denied. You can search by area or use a saved place."
              : "Your location could not be found. Try again or choose a saved place.",
          ),
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

export function ExploreSavedPlaces({
  places,
  initialEdit,
  configuration,
  mapCentre,
  onSave,
  onUse,
  onClose,
}: {
  places: ExplorePreferences["places"];
  initialEdit: "home" | "work" | null;
  configuration: LocationSearchConfiguration;
  mapCentre: ExplorePoint;
  onSave: (kind: "home" | "work", place: ExplorePlace | null) => void;
  onUse: (kind: "home" | "work", place: ExplorePlace) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(initialEdit);
  const [query, setQuery] = useState(
    initialEdit ? (places[initialEdit]?.label ?? "") : "",
  );
  const [draft, setDraft] = useState<ExplorePlace | null>(
    initialEdit ? places[initialEdit] : null,
  );
  const [candidates, setCandidates] = useState<readonly LocationCandidate[]>(
    [],
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  const edit = (kind: "home" | "work") => {
    generation.current++;
    request.current?.abort();
    setBusy(false);
    setEditing(kind);
    setQuery(places[kind]?.label ?? "");
    setDraft(places[kind]);
    setCandidates([]);
    setMessage("");
  };
  const search = async () => {
    if (configuration.status !== "ready") return;
    if (query.trim().length < 3) {
      setMessage("Enter at least three characters to search.");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const token = ++generation.current;
    setBusy(true);
    setMessage("");
    setCandidates([]);
    try {
      const result = await searchLocations(
        query,
        configuration.apiKey,
        "place",
        controller.signal,
      );
      if (token !== generation.current) return;
      setCandidates(result);
      if (!result.length)
        setMessage(
          "No Berlin addresses matched. Try another area, the map centre, or manual coordinates.",
        );
    } catch {
      if (token !== generation.current || controller.signal.aborted) return;
      setMessage(
        "Address search is unavailable. Try again, use the map centre, or enter coordinates.",
      );
    } finally {
      if (token === generation.current) setBusy(false);
    }
  };
  const locate = async () => {
    const token = ++generation.current;
    request.current?.abort();
    setBusy(true);
    setMessage("");
    try {
      const point = await readDeviceLocation();
      if (token === generation.current) {
        setDraft({ ...point, label: query.trim() || "My saved location" });
        setCandidates([]);
      }
    } catch (error) {
      if (token === generation.current)
        setMessage(
          error instanceof Error ? error.message : "Location is unavailable.",
        );
    } finally {
      if (token === generation.current) setBusy(false);
    }
  };
  return (
    <Modal
      title="Saved places"
      eyebrow="EXPLORE"
      onClose={onClose}
      className="explore-places-dialog"
    >
      <p className="dialog-copy">
        Home and Work are optional search shortcuts saved only in this browser.
        Signed-in accounts keep separate shortcuts.
      </p>
      <div className="explore-saved-place-list">
        {(["home", "work"] as const).map((kind) => {
          const place = places[kind],
            Icon = kind === "home" ? Home : BriefcaseBusiness;
          return (
            <section
              key={kind}
              aria-label={`${kind === "home" ? "Home" : "Work"} shortcut`}
            >
              <Icon size={20} aria-hidden="true" />
              <div>
                <h3>{kind === "home" ? "Home" : "Work"}</h3>
                <p>{place?.label ?? "Not set"}</p>
              </div>
              <div className="explore-saved-place-actions">
                {place && (
                  <button type="button" onClick={() => onUse(kind, place)}>
                    Use
                  </button>
                )}
                <button type="button" onClick={() => edit(kind)}>
                  {place ? "Edit" : "Set location"}
                </button>
                {place && (
                  <button
                    type="button"
                    aria-label={`Remove ${kind} location`}
                    onClick={() => {
                      onSave(kind, null);
                      if (editing === kind) {
                        setEditing(null);
                        setDraft(null);
                      }
                    }}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {editing && (
        <form
          className="explore-place-editor"
          onSubmit={(event) => {
            event.preventDefault();
            const place = draft && {
              ...draft,
              label: query.trim() || draft.label,
            };
            if (!place || !isExplorePlace(place)) {
              setMessage(
                "Choose a location or enter valid coordinates before saving.",
              );
              return;
            }
            onSave(editing, place);
            setEditing(null);
            setMessage("");
          }}
        >
          <h3>{editing === "home" ? "Home location" : "Work location"}</h3>
          <label>
            Address or area
            <input
              ref={inputRef}
              value={query}
              maxLength={240}
              placeholder="Address or area in Berlin"
              onChange={(event) => {
                generation.current++;
                request.current?.abort();
                setBusy(false);
                setQuery(event.target.value);
                setDraft(null);
                setCandidates([]);
                setMessage("");
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy || configuration.status !== "ready"}
            onClick={() => void search()}
          >
            <Search size={17} aria-hidden="true" />
            Search address
          </button>
          {configuration.status === "ready" ? (
            <LocationSearchAttribution />
          ) : (
            <p className="explore-location-help">
              Address search is unavailable. Choose the map centre, use your
              location, or enter coordinates.
            </p>
          )}
          {candidates.length > 0 && (
            <ul
              className="explore-place-candidates"
              aria-label="Matching addresses"
            >
              {candidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(candidate);
                      setQuery(candidate.label);
                      setCandidates([]);
                      setMessage("");
                    }}
                  >
                    <MapPin size={16} aria-hidden="true" />
                    {candidate.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="explore-location-choice-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                generation.current++;
                request.current?.abort();
                setDraft({
                  ...mapCentre,
                  label: query.trim() || "Selected map centre",
                });
                setCandidates([]);
                setMessage("");
              }}
            >
              <MapPin size={17} aria-hidden="true" />
              Use map centre
            </button>
            <button type="button" disabled={busy} onClick={() => void locate()}>
              <LocateFixed size={17} aria-hidden="true" />
              Use current location
            </button>
          </div>
          <details>
            <summary>Enter coordinates</summary>
            <div className="explore-coordinate-fields">
              <label>
                Latitude
                <input
                  aria-label="Saved place latitude"
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  value={
                    draft && Number.isFinite(draft.latitude)
                      ? draft.latitude
                      : ""
                  }
                  onChange={(e) =>
                    setDraft({
                      label: query.trim() || "Saved place",
                      longitude: draft?.longitude ?? mapCentre.longitude,
                      latitude:
                        e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Longitude
                <input
                  aria-label="Saved place longitude"
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  value={
                    draft && Number.isFinite(draft.longitude)
                      ? draft.longitude
                      : ""
                  }
                  onChange={(e) =>
                    setDraft({
                      label: query.trim() || "Saved place",
                      latitude: draft?.latitude ?? mapCentre.latitude,
                      longitude:
                        e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          </details>
          {draft && isExplorePlace(draft) && (
            <p className="explore-location-help">
              Selected: {draft.label} · {draft.latitude.toFixed(5)},{" "}
              {draft.longitude.toFixed(5)}
            </p>
          )}
          {busy && <p role="status">Finding your location…</p>}
          {message && <p role="alert">{message}</p>}
          <div className="explore-location-choice-actions">
            <button
              className="button dark"
              type="submit"
              disabled={busy || !draft || !isExplorePlace(draft)}
            >
              Save {editing === "home" ? "Home" : "Work"}
            </button>
            <button
              type="button"
              onClick={() => {
                generation.current++;
                request.current?.abort();
                setBusy(false);
                setEditing(null);
                setMessage("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
