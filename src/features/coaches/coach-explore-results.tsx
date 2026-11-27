"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  Home,
  LayoutGrid,
  LocateFixed,
  Map as MapIcon,
  MapPinned,
  MapPinOff,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { profileInitials } from "@/auth/profile-presentation";
import type {
  CoachDirectoryState,
  CoachDirectoryEntry,
} from "@/domain/coaches";
import type {
  LocationMapCamera,
  LocationDevicePosition,
  LocationSavedPlaceMarker,
  LocationMapViewport,
  LocationSearchConfiguration,
} from "@/location/contracts";
import { deviceAccuracyLabel } from "@/location/device-position";
import { CompactCoachCard } from "./compact-coach-card";
import { PublicMarketplaceSearch } from "./public-marketplace-search";
import {
  coachDirectoryHref,
  type CoachExploreView,
} from "./marketplace-search-contract";
import {
  BERLIN_SEARCH_ORIGIN,
  formatExploreDistance,
  selectExploreEntries,
  type ExploreBounds,
  type ExplorePlace,
} from "./explore-discovery-model";
import { useExplorePreferences } from "./use-explore-preferences";
import { ExploreSavedPlaces, readDeviceLocation } from "./explore-saved-places";

const LazyLocationResultsMap = dynamic(
  () =>
    import("@/location/components/location-results-map").then(
      (module) => module.LocationResultsMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="coach-map-state" role="status">
        <MapPinned size={24} aria-hidden="true" />
        <strong>Loading the coach map…</strong>
        <span>Profiles remain available while the map starts.</span>
      </div>
    ),
  },
);
const subscribeMobile = (change: () => void) => {
  const media = window.matchMedia("(max-width: 760px)");
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
};
const getMobile = () => window.matchMedia("(max-width: 760px)").matches;
const subscribeHydration = () => () => {};
const getHydrated = () => true;
const getServerSnapshot = () => false;
const EMPTY_ENTRIES: readonly CoachDirectoryEntry[] = Object.freeze([]);
type NearbyCoach = ReturnType<typeof selectExploreEntries>[number];
function ExploreResultCard({
  item,
  compact,
  selected,
  origin,
  saved,
  onSave,
  onMap,
  register,
  group,
}: {
  item: NearbyCoach;
  compact: boolean;
  selected: boolean;
  origin: string;
  saved: boolean;
  onSave?: (id: string) => void;
  onMap?: (id: string) => void;
  register?: (id: string, element: HTMLElement | null) => void;
  group: boolean;
}) {
  const id = item.entry.coach.profileId;
  return (
    <CompactCoachCard
      entry={item.entry}
      variant={compact ? "preview" : "result"}
      profileActionLabel="View profile"
      compactMapAction
      hideEmptyAvailability
      hidePrivateSessionDetails={group}
      focusable={Boolean(register)}
      selected={selected}
      cardRef={register ? (element) => register(id, element) : undefined}
      distanceLabel={formatExploreDistance(item.distance)}
      distanceOrigin={origin}
      saved={saved}
      onToggleSaved={onSave ? () => onSave(id) : undefined}
      formatLabel={group ? "Published group sessions" : "Private coaching"}
      onShowOnMap={onMap ? () => onMap(id) : undefined}
    />
  );
}
function plainClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function CoachExploreResults({
  state,
  requestedView,
  preferenceScope,
  locationSearchConfiguration,
}: {
  state: CoachDirectoryState;
  requestedView: CoachExploreView | null;
  preferenceScope: string | null;
  locationSearchConfiguration: LocationSearchConfiguration;
}) {
  const queryKey = coachDirectoryHref(state.filters, { savedOnly: false });
  const searchParams = useSearchParams();
  const mobile = useSyncExternalStore(
    subscribeMobile,
    getMobile,
    getServerSnapshot,
  );
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydrated,
    getServerSnapshot,
  );
  const saved = useExplorePreferences(preferenceScope);
  const liveView = searchParams?.get("view");
  const explicitView = searchParams
    ? liveView === "list" || liveView === "map"
      ? liveView
      : null
    : requestedView;
  const [providerUnavailable, setProviderUnavailable] = useState(false);
  const view =
    providerUnavailable || state.status === "unavailable"
      ? "list"
      : (explicitView ?? saved.preferences.view ?? (mobile ? "map" : "list"));
  const [visitedMap, setVisitedMap] = useState(false);
  if (view === "map" && !visitedMap) setVisitedMap(true);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectionRequest, setSelectionRequest] = useState(0);
  const [origin, setOrigin] = useState<ExplorePlace>(BERLIN_SEARCH_ORIGIN);
  const [savedPlaceKind, setSavedPlaceKind] = useState<"home" | "work" | null>(
    null,
  );
  const savedPlaceMarker = useMemo<LocationSavedPlaceMarker | null>(
    () =>
      savedPlaceKind
        ? {
            kind: savedPlaceKind,
            latitude: origin.latitude,
            longitude: origin.longitude,
          }
        : null,
    [savedPlaceKind, origin],
  );
  const [devicePosition, setDevicePosition] =
    useState<LocationDevicePosition | null>(null);
  const [camera, setCamera] = useState<LocationMapCamera | null>(null);
  const [areaSelection, setAreaSelection] = useState<{
    queryKey: string;
    area: ExploreBounds | null;
  }>({ queryKey, area: null });
  const area = areaSelection.queryKey === queryKey ? areaSelection.area : null;
  const setArea = useCallback(
    (next: ExploreBounds | null) => setAreaSelection({ queryKey, area: next }),
    [queryKey],
  );
  const [viewport, setViewport] = useState<LocationMapViewport | null>(null);
  const [areaChangeKey, setAreaChangeKey] = useState<string | null>(null);
  const areaChanged = areaChangeKey === queryKey;
  const setAreaChanged = useCallback(
    (changed: boolean) => setAreaChangeKey(changed ? queryKey : null),
    [queryKey],
  );
  const [expandedSelection, setExpandedSelection] = useState({
    queryKey,
    expanded: false,
  });
  const expanded =
    expandedSelection.queryKey === queryKey && expandedSelection.expanded;
  const setExpanded = useCallback(
    (next: boolean | ((previous: boolean) => boolean)) =>
      setExpandedSelection((previous) => ({
        queryKey,
        expanded:
          typeof next === "function"
            ? next(previous.queryKey === queryKey && previous.expanded)
            : next,
      })),
    [queryKey],
  );
  const [placesOpen, setPlacesOpen] = useState(false);
  const [placeEdit, setPlaceEdit] = useState<"home" | "work" | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const mapSurfaceRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const selectedPreviewRef = useRef<HTMLElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const focusSelection = useRef(false);
  const active = useRef(true);
  const generation = useRef(0);
  const requestedSavedOnly = searchParams
    ? searchParams.get("saved") === "1"
    : state.filters.savedOnly;
  const filters = useMemo(
    () => ({ ...state.filters, savedOnly: requestedSavedOnly }),
    [state.filters, requestedSavedOnly],
  );
  const savedOnly = Boolean(filters.savedOnly && hydrated && saved.ready);
  const entries = state.status === "ready" ? state.entries : EMPTY_ENTRIES;
  const visible = useMemo(
    () =>
      selectExploreEntries(
        entries,
        origin,
        area,
        saved.preferences.favorites,
        savedOnly,
      ),
    [entries, origin, area, saved.preferences.favorites, savedOnly],
  );
  const selected =
    visible.find(({ entry }) => entry.coach.profileId === selectedCoachId) ??
    visible[0] ??
    null;
  const selectedId = selected?.entry.coach.profileId ?? null;
  const showSelectedPreview = visible.some(
    ({ entry }) => entry.coach.profileId === selectedCoachId,
  );
  const listHref = coachDirectoryHref(filters, {}, "list");
  const mapHref = coachDirectoryHref(filters, {}, "map");
  useEffect(() => {
    if (!hydrated || !saved.ready || explicitView || !searchParams) return;
    // Record the responsive/remembered default before the first view change,
    // so Back returns to that actual view rather than a later preference.
    window.history.replaceState(
      null,
      "",
      coachDirectoryHref(filters, {}, view),
    );
  }, [hydrated, saved.ready, explicitView, searchParams, filters, view]);
  const mapPoints = useMemo(
    () =>
      visible.map(({ entry: { coach, primaryLocation } }) => ({
        id: coach.profileId,
        name: coach.displayName,
        label: primaryLocation.location.label,
        ariaLabel: `Select ${coach.displayName} at primary training location ${primaryLocation.publicName}, ${primaryLocation.location.label}`,
        latitude: primaryLocation.location.latitude,
        longitude: primaryLocation.location.longitude,
        initials: profileInitials(coach.displayName),
        imageUrl: coach.portraitUrl,
      })),
    [visible],
  );
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!mobile || !hydrated || !rootRef.current) return;
    const root = rootRef.current;
    const navigation = document.querySelector<HTMLElement>(".mobile-nav");
    const toolbar = root.querySelector<HTMLElement>(".explore-search-toolbar");
    const summary = root.querySelector<HTMLElement>(".coach-results-summary");
    const header = document.querySelector<HTMLElement>(".public-header");
    if (view === "map") window.scrollTo({ top: 0, behavior: "instant" });
    const measure = () => {
      const navigationHeight = navigation?.getBoundingClientRect().height ?? 0;
      const clearance = navigationHeight + 16;
      root.style.setProperty("--explore-nav-clearance", `${clearance}px`);
      if (view === "map") {
        const viewport = window.visualViewport;
        const top = Math.max(
          0,
          root.getBoundingClientRect().top - (viewport?.offsetTop ?? 0),
        );
        root.style.setProperty(
          "--explore-workspace-height",
          `${Math.max(180, (viewport?.height ?? window.innerHeight) - top - navigationHeight)}px`,
        );
      }
    };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    if (toolbar) observer.observe(toolbar);
    if (summary) observer.observe(summary);
    if (navigation) observer.observe(navigation);
    if (header) observer.observe(header);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [mobile, hydrated, view, locationMessage, saved.notice]);
  useEffect(() => {
    if (!sheetRef.current || !rootRef.current) return;
    const sheet = sheetRef.current,
      root = rootRef.current;
    const measure = () => {
      const height = `${sheet.getBoundingClientRect().height}px`;
      if (root.style.getPropertyValue("--explore-sheet-height") !== height)
        root.style.setProperty("--explore-sheet-height", height);
    };
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(sheet);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [
    hydrated,
    view,
    expanded,
    selectedId,
    visible.length,
    providerUnavailable,
    mapAttempt,
  ]);
  useEffect(() => {
    if (!focusSelection.current || view !== "map") return;
    focusSelection.current = false;
    if (mobile) {
      selectedPreviewRef.current?.focus({ preventScroll: true });
      selectedPreviewRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
    } else {
      const card = selectedId && cardRefs.current.get(selectedId);
      if (card) {
        card.focus({ preventScroll: true });
        card.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    }
  }, [selectedId, selectionRequest, view, mobile]);

  const changeView = (next: CoachExploreView, replace = false) => {
    const href = coachDirectoryHref(filters, {}, next);
    window.history[replace ? "replaceState" : "pushState"](null, "", href);
    saved.update((previous) => ({ ...previous, view: next }));
  };
  const viewClick =
    (next: CoachExploreView) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (next === "map" && !mapAvailable) {
        event.preventDefault();
        return;
      }
      if (!plainClick(event)) return;
      event.preventDefault();
      changeView(next);
    };
  const selectCoach = useCallback((id: string) => {
    focusSelection.current = true;
    setSelectedCoachId(id);
    setSelectionRequest((value) => value + 1);
  }, []);
  const showOnMap = (id: string) => {
    generation.current++;
    setLocating(false);
    const entry = entries.find((item) => item.coach.profileId === id);
    if (entry)
      setCamera((previous) => ({
        ...entry.primaryLocation.location,
        zoom: 12.5,
        revision: (previous?.revision ?? 0) + 1,
      }));
    setSelectedCoachId(id);
    focusSelection.current = true;
    setSelectionRequest((value) => value + 1);
    setExpanded(false);
    changeView("map");
  };
  const onViewportChange = useCallback(
    (next: LocationMapViewport, userInitiated: boolean) => {
      setViewport(next);
      if (userInitiated) setAreaChanged(true);
    },
    [setAreaChanged],
  );
  const unavailable = useCallback(() => {
    setProviderUnavailable(true);
    setVisitedMap(false);
    const url = new URL(window.location.href);
    if (url.searchParams.get("view") === "map") {
      url.searchParams.set("view", "list");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }, []);
  const applyPlace = (
    kind: "home" | "work" | "current",
    place: ExplorePlace & Partial<LocationDevicePosition>,
  ) => {
    generation.current++;
    setLocating(false);
    const label =
      kind === "home" ? "Home" : kind === "work" ? "Work" : "Current location";
    setOrigin({ latitude: place.latitude, longitude: place.longitude, label });
    setSavedPlaceKind(kind === "current" ? null : kind);
    setSelectedCoachId(null);
    setExpanded(false);
    if (kind !== "current") setDevicePosition(null);
    setArea(null);
    setAreaChanged(false);
    setLocationMessage("");
    setCamera((previous) => ({
      latitude: place.latitude,
      longitude: place.longitude,
      zoom: kind === "current" ? 15 : 12.5,
      accuracyMeters: kind === "current" ? place.accuracyMeters : undefined,
      revision: (previous?.revision ?? 0) + 1,
    }));
    setPlacesOpen(false);
  };
  const resetSearchOrigin = () => {
    generation.current++;
    setLocating(false);
    setSavedPlaceKind(null);
    setDevicePosition(null);
    setOrigin(BERLIN_SEARCH_ORIGIN);
    setArea(null);
    setAreaChanged(false);
    setSelectedCoachId(null);
    setExpanded(false);
    setLocationMessage("");
    setCamera((previous) => ({
      ...BERLIN_SEARCH_ORIGIN,
      zoom: 10.5,
      revision: (previous?.revision ?? 0) + 1,
    }));
  };
  const locate = async () => {
    const token = ++generation.current;
    setLocating(true);
    setLocationMessage("");
    try {
      const point = await readDeviceLocation();
      if (active.current && token === generation.current) {
        setDevicePosition(point);
        applyPlace("current", point);
      }
    } catch (error) {
      if (active.current && token === generation.current)
        setLocationMessage(
          error instanceof Error
            ? error.message
            : "Your location is unavailable.",
        );
    } finally {
      if (active.current && token === generation.current) setLocating(false);
    }
  };
  const openPlaces = (edit: "home" | "work" | null = null) => {
    generation.current++;
    setLocating(false);
    setPlaceEdit(edit);
    setPlacesOpen(true);
  };
  const favorite = (id: string) =>
    saved.update((previous) => ({
      ...previous,
      favorites: previous.favorites.includes(id)
        ? previous.favorites.filter((value) => value !== id)
        : [...previous.favorites, id].slice(-300),
    }));
  const registerMapCard = useCallback(
    (id: string, element: HTMLElement | null) => {
      if (element) cardRefs.current.set(id, element);
      else cardRefs.current.delete(id);
    },
    [],
  );
  const card = (item: NearbyCoach, compact: boolean, track = false) => (
    <ExploreResultCard
      key={item.entry.coach.profileId}
      item={item}
      compact={compact}
      selected={selectedId === item.entry.coach.profileId}
      origin={origin.label}
      saved={saved.preferences.favorites.includes(item.entry.coach.profileId)}
      onSave={saved.ready && preferenceScope ? favorite : undefined}
      onMap={!compact && !providerUnavailable ? showOnMap : undefined}
      register={track ? registerMapCard : undefined}
      group={filters.sessionFormat === "group"}
    />
  );
  const noResults = (
    <section className="coach-directory-state">
      <Search size={27} aria-hidden="true" />
      <h2>
        {savedOnly
          ? saved.notice && saved.preferences.favorites.length === 0
            ? "Saved coaches could not be loaded."
            : "No saved coaches match these filters."
          : "No coaches match these filters."}
      </h2>
      <p>
        {savedOnly
          ? "Save a coach with the heart button, or show all matching profiles."
          : "Try another category, training place or map area."}
      </p>
      {area && (
        <button
          type="button"
          onClick={() => {
            setArea(null);
            setAreaChanged(false);
          }}
        >
          Show all matching coaches
        </button>
      )}
      <Link
        className="button secondary"
        href={coachDirectoryHref(
          filters,
          {
            query: "",
            discipline: null,
            location: "",
            sessionFormat: null,
            savedOnly: false,
          },
          view,
        )}
        scroll={false}
      >
        Clear filters
      </Link>
    </section>
  );
  const mapAvailable = state.status === "ready" && !providerUnavailable;
  const locationFeedback = locationMessage ? (
    <div className="explore-notice" role="alert">
      <span>{locationMessage}</span>
      {locationMessage.includes("permission") && (
        <details className="explore-location-permission-help">
          <summary>Allow location on iPhone</summary>
          <p>
            In Safari, open the page menu, choose Website Settings, then set
            Location to Allow. Also check that iPhone Location Services allows
            Safari Websites. Return here and tap the location button again.
          </p>
        </details>
      )}
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`coach-discovery explore-discovery ${hydrated ? "explore-enhanced" : ""} explore-${view}-view`}
    >
      <div className="explore-page-heading">
        <h1>Explore</h1>
        <button
          type="button"
          className="explore-browser-places"
          disabled={!saved.ready || !preferenceScope}
          onClick={() => openPlaces()}
        >
          <Home size={16} aria-hidden="true" />
          Saved places
        </button>
      </div>
      <PublicMarketplaceSearch
        filters={filters}
        view={hydrated ? view : requestedView}
        onSearch={() => {
          setArea(null);
          setAreaChanged(false);
        }}
      >
        <button
          className={`explore-saved-filter${savedOnly ? " active" : ""}`}
          type="button"
          aria-label="Show saved coaches"
          aria-pressed={savedOnly}
          disabled={!saved.ready || !preferenceScope}
          onClick={() =>
            window.history.pushState(
              null,
              "",
              coachDirectoryHref(
                filters,
                { savedOnly: !filters.savedOnly },
                view,
              ),
            )
          }
        >
          <Heart
            size={18}
            fill={savedOnly ? "currentColor" : "none"}
            aria-hidden="true"
          />
          <span>Saved</span>
        </button>
      </PublicMarketplaceSearch>
      <noscript>
        <p className="explore-notice">
          Map and saved-coach preferences need JavaScript. Matching profiles and
          search remain available below.
        </p>
      </noscript>
      {saved.notice && (
        <div className="explore-notice" role="status">
          <span>{saved.notice}</span>
          {preferenceScope && (
            <button
              type="button"
              onClick={() => {
                saved.reset();
                if (savedPlaceKind) resetSearchOrigin();
              }}
            >
              Reset browser settings
            </button>
          )}
        </div>
      )}
      {(!mobile || view !== "map") && locationFeedback}
      <section
        className="coach-results"
        aria-label={
          state.status === "ready"
            ? `${visible.length} matching coaches`
            : "Coach discovery"
        }
      >
        <div className="coach-results-summary">
          <div>
            <h2>
              {state.status === "ready" ? (
                <>
                  {visible.length} coach{visible.length === 1 ? "" : "es"}
                </>
              ) : (
                "Coaches"
              )}
            </h2>
            <small>
              Nearest to {origin.label}
              {area ? " · In this map area" : ""}
            </small>
            {view === "list" && (
              <button
                type="button"
                className="explore-use-location"
                aria-label="Use current location"
                disabled={!hydrated || locating}
                onClick={() => void locate()}
              >
                <LocateFixed size={16} aria-hidden="true" />
                {locating ? "Finding your location…" : "Use current location"}
              </button>
            )}
            {devicePosition && origin.label === "Current location" && (
              <small role="status">
                {deviceAccuracyLabel(devicePosition.accuracyMeters)}
              </small>
            )}
          </div>
          <nav
            className="explore-results-view-control"
            aria-label="Explore results view"
          >
            <Link
              prefetch={false}
              href={mapHref}
              scroll={false}
              onClick={viewClick("map")}
              aria-current={view === "map" ? "page" : undefined}
              aria-disabled={!mapAvailable}
              className={view === "map" ? "active" : ""}
            >
              <MapIcon size={16} aria-hidden="true" />
              Map
            </Link>
            <Link
              prefetch={false}
              href={listHref}
              scroll={false}
              onClick={viewClick("list")}
              aria-current={view === "list" ? "page" : undefined}
              className={view === "list" ? "active" : ""}
            >
              <LayoutGrid size={16} aria-hidden="true" />
              Profiles
            </Link>
          </nav>
        </div>
        {providerUnavailable && (
          <div className="explore-notice" role="status">
            <MapPinOff size={18} aria-hidden="true" />
            <span>
              Map unavailable. The same coach results are available in Profiles.
            </span>
            <button
              type="button"
              onClick={() => {
                setProviderUnavailable(false);
                setMapAttempt((value) => value + 1);
                changeView("map");
              }}
            >
              Retry map
            </button>
          </div>
        )}
        {state.status === "unavailable" ? (
          <section className="coach-directory-state" role="alert">
            <MapPinOff size={27} aria-hidden="true" />
            <h2>Coach discovery is temporarily unavailable.</h2>
            <p>
              Coach profiles could not be loaded. Please try your search again.
            </p>
            <Link
              className="button secondary"
              href={coachDirectoryHref(filters, {}, view)}
            >
              Try again
            </Link>
          </section>
        ) : (
          <>
            <div className="explore-profiles">
              <div className="coach-card-grid">
                {visible.map((item) => card(item, false))}
              </div>
              {!visible.length && noResults}
            </div>
            {mapAvailable && hydrated && (view === "map" || visitedMap) && (
              <div className="explore-map-layout" hidden={view !== "map"}>
                <aside
                  className="explore-map-list"
                  aria-label="Matching coach profiles"
                >
                  {visible.map((item) => card(item, true, true))}
                  {!visible.length && noResults}
                </aside>
                <div className="explore-map-surface" ref={mapSurfaceRef}>
                  <LazyLocationResultsMap
                    key={mapAttempt}
                    points={mapPoints}
                    selectedPointId={selectedId}
                    onSelectPoint={selectCoach}
                    onUnavailable={unavailable}
                    camera={camera}
                    devicePosition={devicePosition}
                    savedPlace={savedPlaceMarker}
                    autoFit={false}
                    recenterOnSelection={false}
                    cooperativeGestures={false}
                    onViewportChange={onViewportChange}
                  />
                  {mobile && (
                    <>
                      <p className="explore-map-origin">
                        Nearest to {origin.label}
                        {devicePosition &&
                          origin.label === "Current location" && (
                            <small>
                              {deviceAccuracyLabel(
                                devicePosition.accuracyMeters,
                              )}
                            </small>
                          )}
                      </p>
                      <div className="explore-map-feedback">
                        {locationFeedback}
                      </div>
                    </>
                  )}
                  {areaChanged && viewport && (
                    <button
                      className="explore-search-area"
                      type="button"
                      onClick={() => {
                        generation.current++;
                        setLocating(false);
                        setDevicePosition(null);
                        setSavedPlaceKind(null);
                        setArea(viewport);
                        setOrigin({
                          latitude: viewport.latitude,
                          longitude:
                            ((((viewport.longitude + 180) % 360) + 360) % 360) -
                            180,
                          label: "Map centre",
                        });
                        setAreaChanged(false);
                      }}
                    >
                      <Search size={16} aria-hidden="true" />
                      Search this area
                    </button>
                  )}
                  <div className="explore-map-tools">
                    <button
                      type="button"
                      aria-label="Use current location"
                      title="Current location"
                      disabled={locating}
                      onClick={() => void locate()}
                    >
                      <LocateFixed size={20} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Search near home"
                      title="Near home"
                      disabled={!saved.ready || !preferenceScope}
                      onClick={() =>
                        saved.preferences.places.home
                          ? applyPlace("home", saved.preferences.places.home)
                          : openPlaces("home")
                      }
                    >
                      <Home size={20} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Manage Home and Work locations"
                      title="Saved places"
                      disabled={!saved.ready || !preferenceScope}
                      onClick={() => openPlaces()}
                    >
                      <MoreHorizontal size={21} aria-hidden="true" />
                    </button>
                  </div>
                  {locating && (
                    <p className="explore-map-message" role="status">
                      Finding your location…
                    </p>
                  )}
                  <div
                    className={`explore-map-sheet${expanded ? " expanded" : ""}`}
                    ref={sheetRef}
                  >
                    <button
                      type="button"
                      className="explore-sheet-handle"
                      aria-expanded={expanded}
                      onClick={() => setExpanded((value) => !value)}
                    >
                      <span className="explore-sheet-grip" />
                      {expanded
                        ? "Back to map"
                        : `${visible.length} coach${visible.length === 1 ? "" : "es"}`}
                      {expanded ? (
                        <ChevronDown size={16} aria-hidden="true" />
                      ) : (
                        <ChevronUp size={16} aria-hidden="true" />
                      )}
                    </button>
                    <section
                      hidden={mobile && !expanded && !showSelectedPreview}
                      ref={selectedPreviewRef}
                      tabIndex={-1}
                      aria-label={
                        selected
                          ? `${selected.entry.coach.displayName} map details`
                          : "Map results"
                      }
                    >
                      {expanded
                        ? visible.map((item) => card(item, true))
                        : selected
                          ? card(selected, true)
                          : noResults}
                    </section>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      {hydrated && state.status === "ready" && (
        <Link
          className="explore-floating-view"
          prefetch={false}
          href={view === "map" ? listHref : mapHref}
          scroll={false}
          onClick={
            providerUnavailable && view === "list"
              ? (event) => event.preventDefault()
              : viewClick(view === "map" ? "list" : "map")
          }
          aria-disabled={providerUnavailable && view === "list"}
        >
          {view === "map" ? (
            <>
              <LayoutGrid size={17} aria-hidden="true" />
              Show profiles
            </>
          ) : (
            <>
              <MapIcon size={17} aria-hidden="true" />
              {providerUnavailable ? "Map unavailable" : "Show map"}
            </>
          )}
        </Link>
      )}
      {placesOpen && (
        <ExploreSavedPlaces
          places={saved.preferences.places}
          initialEdit={placeEdit}
          configuration={locationSearchConfiguration}
          mapCentre={viewport ?? origin}
          onSave={(kind, place) => {
            saved.update((previous) => ({
              ...previous,
              places: { ...previous.places, [kind]: place },
            }));
            if (savedPlaceKind === kind) {
              if (place) applyPlace(kind, place);
              else resetSearchOrigin();
            }
          }}
          onUse={applyPlace}
          onClose={() => setPlacesOpen(false)}
        />
      )}
    </div>
  );
}
