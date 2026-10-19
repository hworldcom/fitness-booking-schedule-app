"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Building2,
  LocateFixed,
  MapPin,
  MapPinOff,
  Search,
} from "lucide-react";
import type { CoachProjection } from "@/domain/coaches";
import {
  LocationSearchError,
  isPersistedLocationProvider,
  locationProviderLabel,
  searchLocations,
  type LocationCandidate,
  type LocationSearchConfiguration,
  type PersistedLocationProvider,
} from "@/location";
import { LocationSearchAttribution } from "@/location/components/location-search-attribution";

const LazyLocationPickerMap = dynamic(
  () =>
    import("@/location/components/location-picker-map").then(
      (module) => module.LocationPickerMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="coach-location-map-state" role="status">
        Loading the pin editor…
      </div>
    ),
  },
);

type LocationDraft = Readonly<{
  label: string;
  latitude: number;
  longitude: number;
  source: "manual" | "permanent-geocoding";
  provider: PersistedLocationProvider | null;
}>;

function initialDraft(
  location: CoachProjection["location"] | null,
): LocationDraft | null {
  if (!location) return null;
  const provider = isPersistedLocationProvider(location.provider)
    ? location.provider
    : null;
  const providerResult =
    location.source === "permanent-geocoding" && provider !== null;
  return Object.freeze({
    label: location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    source: providerResult ? "permanent-geocoding" : "manual",
    provider: providerResult ? provider : null,
  });
}

function searchFailureMessage(error: unknown) {
  if (!(error instanceof LocationSearchError)) {
    return "Location search could not be completed. Try again.";
  }
  if (error.reason === "configuration") {
    return "Location search is not configured for this site. Use manual coordinates or try again later.";
  }
  if (error.reason === "quota") {
    return "Location search has reached its current request limit. Try again later or use manual coordinates.";
  }
  return "Location search is temporarily unavailable. Try again or use manual coordinates.";
}

export function CoachLocationPicker({
  initialLocation,
  searchConfiguration,
}: {
  initialLocation: CoachProjection["location"] | null;
  searchConfiguration: LocationSearchConfiguration;
}) {
  const existing = initialDraft(initialLocation);
  const startsWithSearch =
    searchConfiguration.status === "ready" &&
    (!existing || existing.source === "permanent-geocoding");
  const [entryMode, setEntryMode] = useState<"facility" | "address" | "manual">(
    startsWithSearch ? "facility" : "manual",
  );
  const [draft, setDraft] = useState<LocationDraft | null>(existing);
  const [confirmed, setConfirmed] = useState(Boolean(existing));
  const [query, setQuery] = useState(existing?.label ?? "");
  const [candidates, setCandidates] = useState<readonly LocationCandidate[]>(
    Object.freeze([]),
  );
  const [searchStatus, setSearchStatus] = useState<
    "idle" | "searching" | "empty" | "error"
  >("idle");
  const [searchMessage, setSearchMessage] = useState("");
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  const chooseManual = () => {
    requestRef.current?.abort();
    setEntryMode("manual");
    setCandidates(Object.freeze([]));
    setSearchStatus("idle");
    setSearchMessage("");
    setConfirmed(false);
    setDraft((current) =>
      current
        ? Object.freeze({ ...current, source: "manual", provider: null })
        : current,
    );
  };

  const chooseSearch = (mode: "facility" | "address") => {
    if (searchConfiguration.status !== "ready") return;
    requestRef.current?.abort();
    setEntryMode(mode);
    setQuery("");
    setCandidates(Object.freeze([]));
    setSearchStatus("idle");
    setSearchMessage("");
    setConfirmed(false);
    setDraft(null);
  };

  const runSearch = useCallback(async () => {
    if (searchConfiguration.status !== "ready") return;
    if (query.trim().length < 3) {
      setSearchStatus("error");
      setSearchMessage("Enter at least three characters before searching.");
      return;
    }
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    setSearchStatus("searching");
    setSearchMessage("");
    try {
      const nextCandidates = await searchLocations(
        query,
        searchConfiguration.apiKey,
        entryMode === "facility" ? "facility" : "place",
        request.signal,
      );
      if (request.signal.aborted) return;
      setCandidates(nextCandidates);
      setSearchStatus(nextCandidates.length === 0 ? "empty" : "idle");
      setSearchMessage(
        nextCandidates.length === 0
          ? entryMode === "facility"
            ? "No facility matched in Berlin. Refine the facility name or choose Own address."
            : "No address matched in Berlin. Refine the address or enter coordinates manually."
          : "",
      );
    } catch (error) {
      if (request.signal.aborted) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      setCandidates(Object.freeze([]));
      setSearchStatus("error");
      setSearchMessage(searchFailureMessage(error));
    }
  }, [entryMode, query, searchConfiguration]);

  const chooseCandidate = (candidate: LocationCandidate) => {
    setDraft(
      Object.freeze({
        label: candidate.label,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        source: "permanent-geocoding",
        provider: candidate.provider,
      }),
    );
    setConfirmed(false);
    setMapUnavailable(false);
  };

  const updateManual = (
    field: "label" | "latitude" | "longitude",
    value: string,
  ) => {
    const current = draft ?? {
      label: "",
      latitude: Number.NaN,
      longitude: Number.NaN,
      source: "manual" as const,
      provider: null,
    };
    setDraft(
      Object.freeze({
        ...current,
        [field]:
          field === "label"
            ? value
            : value.trim() === ""
              ? Number.NaN
              : Number(value),
        source: "manual",
        provider: null,
      }),
    );
    setConfirmed(false);
  };

  const selectedLocationValid =
    Boolean(draft?.label.trim()) &&
    Number.isFinite(draft?.latitude) &&
    Number.isFinite(draft?.longitude);

  return (
    <div className="coach-independent-location">
      {searchConfiguration.status === "ready" ? (
        <div
          className="coach-location-entry-mode"
          role="group"
          aria-label="Independent location entry method"
        >
          <button
            type="button"
            className={entryMode === "facility" ? "active" : ""}
            aria-pressed={entryMode === "facility"}
            onClick={() => chooseSearch("facility")}
          >
            <Building2 size={15} aria-hidden="true" /> Facility search
          </button>
          <button
            type="button"
            className={entryMode !== "facility" ? "active" : ""}
            aria-pressed={entryMode !== "facility"}
            onClick={() => chooseSearch("address")}
          >
            <MapPin size={15} aria-hidden="true" /> Own address
          </button>
        </div>
      ) : (
        <div
          className="coach-location-provider-note"
          role="status"
          data-location-search-configuration={searchConfiguration.status}
        >
          <MapPinOff size={18} aria-hidden="true" />
          <span>
            Facility and address search is not configured. Manual coordinates
            remain available and are stored without a provider claim.
          </span>
        </div>
      )}

      {entryMode !== "manual" && searchConfiguration.status === "ready" ? (
        <div className="coach-location-search">
          <label className="coach-field coach-field-wide">
            <span>
              {entryMode === "facility"
                ? "Search for a facility in Berlin"
                : "Find your training address in Berlin"}
            </span>
            <div className="coach-location-search-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  void runSearch();
                }}
                maxLength={160}
                placeholder={
                  entryMode === "facility"
                    ? "For example: Chimosa or Futurium"
                    : "For example: Linienstraße 127, Berlin"
                }
                autoComplete={
                  entryMode === "address" ? "street-address" : "off"
                }
              />
              <button
                className="button secondary"
                type="button"
                onClick={() => void runSearch()}
                disabled={searchStatus === "searching"}
              >
                <Search size={15} aria-hidden="true" />
                {searchStatus === "searching" ? "Searching…" : "Search"}
              </button>
            </div>
            <small>
              {entryMode === "facility"
                ? "Search by name for any facility within Berlin. If yours is missing, choose Own address."
                : "Search for your own meeting address within Berlin, then select and confirm it. You can also enter coordinates manually."}
            </small>
            <small>
              <LocationSearchAttribution />
            </small>
          </label>

          {entryMode === "address" && (
            <button
              className="button secondary"
              type="button"
              onClick={chooseManual}
            >
              <LocateFixed size={15} aria-hidden="true" /> Enter coordinates
              manually
            </button>
          )}

          {searchMessage && (
            <p
              className={`coach-location-search-message ${searchStatus}`}
              role={searchStatus === "error" ? "alert" : "status"}
            >
              {searchMessage}
            </p>
          )}
          {candidates.length > 0 && (
            <div
              className="coach-location-candidates"
              aria-label="Location results"
            >
              {candidates.map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  className={
                    draft?.label === candidate.label &&
                    draft.latitude === candidate.latitude &&
                    draft.longitude === candidate.longitude
                      ? "selected"
                      : ""
                  }
                  onClick={() => chooseCandidate(candidate)}
                >
                  {candidate.kind === "facility" ? (
                    <Building2 size={16} aria-hidden="true" />
                  ) : (
                    <MapPin size={16} aria-hidden="true" />
                  )}
                  <span>
                    <strong>{candidate.label}</strong>
                    <small>
                      {candidate.kind === "facility"
                        ? "Facility"
                        : "Address or public place"}
                      {" · "}
                      {candidate.latitude.toFixed(6)},{" "}
                      {candidate.longitude.toFixed(6)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {draft?.source === "permanent-geocoding" && draft.provider && (
            <div className="coach-location-confirmation">
              <div className="coach-location-confirmation-copy">
                <span>Selected public location</span>
                <strong>{draft.label}</strong>
                <small>
                  {draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)} ·
                  stored {locationProviderLabel(draft.provider)} result
                </small>
              </div>
              {!mapUnavailable ? (
                <LazyLocationPickerMap
                  latitude={draft.latitude}
                  longitude={draft.longitude}
                  onMove={({ latitude, longitude }) => {
                    setDraft(Object.freeze({ ...draft, latitude, longitude }));
                    setConfirmed(false);
                  }}
                  onUnavailable={() => setMapUnavailable(true)}
                />
              ) : (
                <div
                  className="coach-location-map-state unavailable"
                  role="status"
                >
                  The interactive pin could not load. You may keep the selected
                  result or switch to manual coordinates.
                </div>
              )}
              <p>
                Drag the pin only to clarify the coach-selected meeting point,
                then confirm what will be public.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="coach-independent-fields">
          <label className="coach-field coach-field-wide">
            <span>Public location label</span>
            <input
              value={draft?.label ?? ""}
              onChange={(event) => updateManual("label", event.target.value)}
              maxLength={240}
              placeholder="For example: Tempelhofer Feld — main entrance"
              required
            />
          </label>
          <label className="coach-field">
            <span>Latitude</span>
            <input
              type="number"
              step="0.000001"
              min="-90"
              max="90"
              value={Number.isFinite(draft?.latitude) ? draft?.latitude : ""}
              onChange={(event) => updateManual("latitude", event.target.value)}
              required
            />
          </label>
          <label className="coach-field">
            <span>Longitude</span>
            <input
              type="number"
              step="0.000001"
              min="-180"
              max="180"
              value={Number.isFinite(draft?.longitude) ? draft?.longitude : ""}
              onChange={(event) =>
                updateManual("longitude", event.target.value)
              }
              required
            />
          </label>
        </div>
      )}

      <input type="hidden" name="locationLabel" value={draft?.label ?? ""} />
      <input
        type="hidden"
        name="latitude"
        value={Number.isFinite(draft?.latitude) ? draft?.latitude : ""}
      />
      <input
        type="hidden"
        name="longitude"
        value={Number.isFinite(draft?.longitude) ? draft?.longitude : ""}
      />
      <input
        type="hidden"
        name="locationSource"
        value={
          draft?.source ??
          (entryMode !== "manual" ? "permanent-geocoding" : "manual")
        }
      />
      <input
        type="hidden"
        name="locationProvider"
        value={draft?.provider ?? ""}
      />
      <input
        type="hidden"
        name="locationConfirmation"
        value={confirmed ? "confirmed" : ""}
      />

      <div className={`coach-location-confirm ${confirmed ? "confirmed" : ""}`}>
        <div>
          {confirmed ? (
            <CheckCircle2 size={19} aria-hidden="true" />
          ) : (
            <MapPin size={19} aria-hidden="true" />
          )}
          <span>
            {confirmed
              ? "Public location confirmed."
              : "Confirm the exact label and pin before saving."}
          </span>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={!selectedLocationValid || confirmed}
          onClick={() => setConfirmed(true)}
        >
          {confirmed ? "Confirmed" : "Confirm public location"}
        </button>
      </div>
    </div>
  );
}
