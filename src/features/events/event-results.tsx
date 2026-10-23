"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { List, Map as MapIcon, MapPinOff } from "lucide-react";
import {
  appendEventPage,
  eventDirectoryHref,
  eventMapPoints,
  fetchEventPage,
} from "./directory-contract";
import {
  type EventDirectory,
  type EventDirectoryPage,
} from "@/events/contracts";
import { EventCard } from "./event-ui";

const subscribe = () => () => {};
const LocationMap = dynamic(
  () =>
    import("@/location/components/location-results-map").then(
      (module) => module.LocationResultsMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="coach-map-state" role="status">
        Loading session map… The session list remains available.
      </div>
    ),
  },
);
export function EventResults({
  initial,
  directory,
}: {
  initial: EventDirectoryPage;
  directory: EventDirectory;
}) {
  const { filters, view } = directory;
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const previewRef = useRef<HTMLElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const listHref = eventDirectoryHref(filters, filters.after, "list");
  const mapHref = eventDirectoryHref(filters, filters.after, "map");
  const selected = data.page.items.find((session) => session.id === selectedId);
  const points = useMemo(
    () => eventMapPoints(data.page.items, data.presentations),
    [data],
  );
  useEffect(() => {
    const id = pendingFocus.current;
    if (id) {
      cardRefs.current.get(id)?.focus({ preventScroll: false });
      pendingFocus.current = null;
    }
  }, [data]);
  useEffect(() => {
    if (
      view === "map" &&
      selectedId &&
      window.matchMedia("(max-width: 980px)").matches
    )
      previewRef.current?.focus({ preventScroll: false });
  }, [selectedId, view]);
  const providerFailed = useCallback(() => {
    setMapFailed(true);
  }, []);
  function selectFromMap(id: string) {
    setSelectedId(id);
    if (!window.matchMedia("(max-width: 980px)").matches) {
      const node = cardRefs.current.get(id);
      node?.focus({ preventScroll: true });
      node?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  }
  function selectFromCard(id: string) {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 980px)").matches && view !== "map")
      router.push(mapHref, { scroll: false });
  }
  async function loadMore() {
    const cursor = data.page.nextCursor;
    if (busyRef.current || !cursor) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    setMessage("Loading more sessions…");
    const next = await fetchEventPage(filters, cursor);
    if (!mounted.current) return;
    if (next) {
      const oldIds = new Set(data.page.items.map((session) => session.id));
      const added = next.page.items.filter(
        (session) => !oldIds.has(session.id),
      );
      pendingFocus.current = added[0]?.id ?? null;
      setData(appendEventPage(data, next));
      setMessage(
        `${added.length} more ${added.length === 1 ? "session" : "sessions"} loaded.`,
      );
    } else {
      setFailed(true);
      setMessage(
        "More sessions could not be loaded. Your current results are still shown. Try Load more again.",
      );
    }
    busyRef.current = false;
    setBusy(false);
  }
  return (
    <section
      className="event-directory-results"
      aria-label="Group session results"
    >
      <div className="events-results-heading">
        <h2>
          {filters.after ? "More group sessions" : "Upcoming group sessions"}
        </h2>
        <span>
          {data.page.items.length} sessions loaded · Times in Europe/Berlin
        </span>
      </div>
      {data.page.items.length ? (
        <>
          <nav className="event-view-switch" aria-label="Session results view">
            <Link
              href={listHref}
              scroll={false}
              aria-current={view === "list" || mapFailed ? "page" : undefined}
            >
              <List size={17} aria-hidden="true" /> List
            </Link>
            <Link
              href={mapHref}
              scroll={false}
              aria-current={view === "map" && !mapFailed ? "page" : undefined}
            >
              <MapIcon size={17} aria-hidden="true" /> Map
            </Link>
          </nav>
          <noscript>
            <p>
              The interactive map and appended results need JavaScript. All
              sessions in this batch are listed below; Load more opens the next
              page.
            </p>
          </noscript>
          {mapFailed && (
            <p className="event-map-failure" role="status">
              <MapPinOff size={18} aria-hidden="true" /> Map unavailable. All
              loaded sessions remain in the list.{" "}
              <button
                type="button"
                onClick={() => {
                  setMapFailed(false);
                  setMapAttempt((attempt) => attempt + 1);
                }}
              >
                Retry map
              </button>
            </p>
          )}
          <div
            className={`event-results-layout mobile-view-${view}${ready ? " is-interactive" : ""}${mapFailed ? " map-unavailable" : ""}`}
          >
            <div className="event-results-list">
              <div className="events-grid">
                {data.page.items.map((session) => (
                  <EventCard
                    key={session.id}
                    session={session}
                    presentation={data.presentations[session.id]}
                    selected={selectedId === session.id}
                    cardRef={(node) => {
                      if (node) cardRefs.current.set(session.id, node);
                      else cardRefs.current.delete(session.id);
                    }}
                    onShowOnMap={
                      ready && !mapFailed
                        ? () => selectFromCard(session.id)
                        : undefined
                    }
                  />
                ))}
              </div>
              <div className="events-pagination" aria-busy={busy}>
                {filters.after && (
                  <Link
                    href={eventDirectoryHref(
                      filters,
                      null,
                      directory.explicitView ? view : undefined,
                    )}
                  >
                    Back to first page
                  </Link>
                )}
                {data.page.nextCursor && (
                  <a
                    className="button secondary"
                    href={eventDirectoryHref(
                      filters,
                      data.page.nextCursor,
                      directory.explicitView ? view : undefined,
                    )}
                    aria-disabled={busy || undefined}
                    onClick={(event) => {
                      if (
                        event.button !== 0 ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return;
                      event.preventDefault();
                      void loadMore();
                    }}
                  >
                    {busy ? "Loading…" : "Load more"}
                  </a>
                )}
              </div>
            </div>
            {!mapFailed && ready && (
              <aside
                className="event-map-panel"
                aria-label="Loaded session venue map"
              >
                <header>
                  <h3>Session locations</h3>
                  <p>
                    Pins show the published venues of the{" "}
                    {data.page.items.length} loaded sessions.
                  </p>
                  <Link
                    className="event-map-back"
                    href={listHref}
                    scroll={false}
                  >
                    Back to list
                  </Link>
                </header>
                <LocationMap
                  key={mapAttempt}
                  points={points}
                  selectedPointId={selectedId}
                  onSelectPoint={selectFromMap}
                  onUnavailable={providerFailed}
                  canvasAriaLabel="Loaded group session locations"
                  coincidentItemLabel="Session"
                />
                {selected && (
                  <section
                    className="event-map-preview"
                    aria-label={`${selected.title} map details`}
                    aria-live="polite"
                    tabIndex={-1}
                    ref={previewRef}
                  >
                    <EventCard
                      session={selected}
                      presentation={data.presentations[selected.id]}
                    />
                  </section>
                )}
              </aside>
            )}
          </div>
        </>
      ) : (
        <section className="events-state">
          <h3>No upcoming sessions here yet</h3>
          <p>
            Try another discipline or training place. You can also discover
            coaches for a private session.
          </p>
          <div className="events-state-actions">
            <Link href="/events" className="button secondary">
              Show all group sessions
            </Link>
            <Link href="/explore">Find a coach</Link>
          </div>
          {filters.after && (
            <Link href={eventDirectoryHref(filters, null)}>
              Back to first page
            </Link>
          )}
        </section>
      )}
      <p
        className={`event-load-status${failed ? " failed" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </section>
  );
}
