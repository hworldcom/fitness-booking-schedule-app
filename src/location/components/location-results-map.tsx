"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type {
  LocationMapPoint,
  LocationMapViewport,
  LocationMapCamera,
  LocationDevicePosition,
  LocationSavedPlaceMarker,
} from "../contracts";
import { deviceAccuracyLabel, deviceAccuracyBounds } from "../device-position";
import { layoutLocationMapMarkers } from "../marker-layout";
import { MAPLIBRE_WORKER_URL } from "../providers/maplibre";
import { OPENFREEMAP_STYLE_URL } from "../providers/openfreemap";

type MarkerEntry = Readonly<{
  marker: maplibregl.Marker;
  element: HTMLButtonElement;
  image: HTMLImageElement | null;
  handleClick: () => void;
  handleImageError: (() => void) | null;
}>;

function removeMarkerEntry(entry: MarkerEntry) {
  entry.element.removeEventListener("click", entry.handleClick);
  if (entry.image && entry.handleImageError) {
    entry.image.removeEventListener("error", entry.handleImageError);
  }
  entry.marker.remove();
}

export function LocationResultsMap({
  points,
  selectedPointId,
  onSelectPoint,
  onUnavailable,
  canvasAriaLabel = "Matching coach locations",
  coincidentItemLabel = "Coach",
  recenterOnSelection = true,
  markerVariant = "badge",
  camera,
  autoFit = true,
  onViewportChange,
  cooperativeGestures = true,
  devicePosition = null,
  savedPlace = null,
}: {
  points: readonly LocationMapPoint[];
  selectedPointId: string | null;
  onSelectPoint: (pointId: string) => void;
  onUnavailable: () => void;
  canvasAriaLabel?: string;
  coincidentItemLabel?: string;
  recenterOnSelection?: boolean;
  markerVariant?: "badge" | "pin";
  camera?: LocationMapCamera | null;
  autoFit?: boolean;
  onViewportChange?: (
    viewport: LocationMapViewport,
    userInitiated: boolean,
  ) => void;
  cooperativeGestures?: boolean;
  devicePosition?: LocationDevicePosition | null;
  savedPlace?: LocationSavedPlaceMarker | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, MarkerEntry>());
  const onSelectRef = useRef(onSelectPoint);
  const onUnavailableRef = useRef(onUnavailable);
  const onViewportRef = useRef(onViewportChange);
  const deviceCleanupRef = useRef<(() => void) | null>(null);
  const savedPlaceCleanupRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelectPoint;
  }, [onSelectPoint]);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);
  useEffect(() => {
    onViewportRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    if (!containerRef.current) return;
    let active = true;
    const markers = markersRef.current;
    try {
      maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: OPENFREEMAP_STYLE_URL,
        center: [13.405, 52.52],
        zoom: 10.5,
        attributionControl: { compact: false },
        cooperativeGestures,
      });
      mapRef.current = map;
      const resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(() => map.resize());
      resizeObserver?.observe(containerRef.current);
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.getCanvas().setAttribute("aria-label", canvasAriaLabel);
      const reportViewport = (userInitiated: boolean) => {
        if (!active || !onViewportRef.current) return;
        const bounds = map.getBounds(),
          center = map.getCenter();
        onViewportRef.current(
          {
            latitude: center.lat,
            longitude: center.lng,
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          },
          userInitiated,
        );
      };
      const handleLoad = () => {
        if (active) {
          setReady(true);
          reportViewport(false);
        }
      };
      const handleMove = (
        event: maplibregl.MapLibreEvent & { originalEvent?: Event },
      ) => reportViewport(Boolean(event.originalEvent));
      const handleError = () => active && onUnavailableRef.current();
      map.once("load", handleLoad);
      map.on("error", handleError);
      map.on("moveend", handleMove);
      return () => {
        active = false;
        resizeObserver?.disconnect();
        deviceCleanupRef.current?.();
        savedPlaceCleanupRef.current?.();
        map.off("error", handleError);
        map.off("moveend", handleMove);
        for (const entry of markers.values()) removeMarkerEntry(entry);
        markers.clear();
        map.remove();
        mapRef.current = null;
      };
    } catch {
      onUnavailableRef.current();
    }
  }, [canvasAriaLabel, cooperativeGestures]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const entry of markersRef.current.values()) removeMarkerEntry(entry);
    markersRef.current.clear();

    const bounds = new maplibregl.LngLatBounds();
    const markerLayouts = new Map(
      layoutLocationMapMarkers(points).map((layout) => [
        layout.pointId,
        layout,
      ]),
    );
    for (const point of points) {
      const layout = markerLayouts.get(point.id);
      if (!layout) {
        onUnavailableRef.current();
        return;
      }
      const element = document.createElement("button");
      element.type = "button";
      element.className = `location-map-marker${markerVariant === "pin" ? " location-map-marker-pin" : ""}`;
      element.setAttribute(
        "aria-label",
        layout.coincidentCount === 1
          ? point.ariaLabel
          : `${point.ariaLabel}. ${coincidentItemLabel} ${layout.coincidentIndex} of ${layout.coincidentCount} at these coordinates.`,
      );
      element.setAttribute("aria-pressed", "false");
      element.dataset.coincidentCount = String(layout.coincidentCount);
      element.dataset.markerOffset = layout.offset.join(",");
      if (point.markerAppearance) {
        element.style.setProperty(
          "--location-marker-background",
          point.markerAppearance.background,
        );
        element.style.setProperty(
          "--location-marker-foreground",
          point.markerAppearance.foreground,
        );
        element.style.setProperty(
          "--location-marker-accent",
          point.markerAppearance.accent,
        );
        element.dataset.markerColor = point.markerAppearance.accent;
      }
      if (markerVariant === "badge") {
        const initials = document.createElement("span");
        initials.className = "location-map-marker-initials";
        initials.textContent = point.initials;
        element.append(initials);
      }

      let image: HTMLImageElement | null = null;
      let handleImageError: (() => void) | null = null;
      if (point.imageUrl && markerVariant === "badge") {
        image = document.createElement("img");
        image.className = "location-map-marker-image";
        image.src = point.imageUrl;
        image.alt = "";
        image.width = 38;
        image.height = 38;
        image.decoding = "async";
        image.draggable = false;
        handleImageError = () => {
          element.classList.remove("has-portrait");
          image?.remove();
        };
        image.addEventListener("error", handleImageError);
        element.classList.add("has-portrait");
        element.prepend(image);
      }
      const handleClick = () => onSelectRef.current(point.id);
      element.addEventListener("click", handleClick);
      const coordinates: [number, number] = [point.longitude, point.latitude];
      const marker = new maplibregl.Marker({
        element,
        anchor: "bottom",
        offset: [layout.offset[0], layout.offset[1]],
      })
        .setLngLat(coordinates)
        .addTo(map);
      element.setAttribute("role", "button");
      markersRef.current.set(
        point.id,
        Object.freeze({
          marker,
          element,
          image,
          handleClick,
          handleImageError,
        }),
      );
      bounds.extend(coordinates);
    }

    if (!autoFit) return;
    if (points.length === 1) {
      map.jumpTo({
        center: [points[0]!.longitude, points[0]!.latitude],
        zoom: 13,
      });
    } else if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 54, maxZoom: 13, duration: 0 });
    }
  }, [autoFit, coincidentItemLabel, markerVariant, points, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !camera) return;
    let applied = false;
    const applyCamera = () => {
      // Profiles can request location while the retained Map is hidden.
      // Fit only once it has a real viewport; ordinary resizing must not
      // undo a later user pan.
      if (
        applied ||
        map.getContainer().clientWidth === 0 ||
        map.getContainer().clientHeight === 0
      )
        return;
      applied = true;
      map.off("resize", applyCamera);
      if (
        camera.accuracyMeters &&
        Number.isFinite(camera.accuracyMeters) &&
        camera.accuracyMeters > 0
      ) {
        map.fitBounds(
          deviceAccuracyBounds({
            latitude: camera.latitude,
            longitude: camera.longitude,
            accuracyMeters: camera.accuracyMeters,
          })!,
          {
            padding: 30,
            maxZoom: camera.zoom,
            duration: 0,
          },
        );
      } else {
        map.jumpTo({
          center: [camera.longitude, camera.latitude],
          zoom: camera.zoom,
        });
      }
    };
    map.on("resize", applyCamera);
    map.resize();
    applyCamera();
    return () => {
      map.off("resize", applyCamera);
    };
  }, [camera, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !devicePosition) return;
    const coordinates = new maplibregl.LngLat(
      devicePosition.longitude,
      devicePosition.latitude,
    );
    const dot = document.createElement("div");
    dot.className = "location-device-dot";
    dot.setAttribute("role", "img");
    dot.setAttribute(
      "aria-label",
      `Your last requested device location. ${deviceAccuracyLabel(devicePosition.accuracyMeters)}.`,
    );
    const circle = document.createElement("div");
    circle.className = "location-device-accuracy";
    circle.setAttribute("aria-hidden", "true");
    const accuracyMarker = new maplibregl.Marker({
      element: circle,
      anchor: "center",
      pitchAlignment: "map",
    })
      .setLngLat(coordinates)
      .addTo(map);
    const positionMarker = new maplibregl.Marker({
      element: dot,
      anchor: "center",
    })
      .setLngLat(coordinates)
      .addTo(map);
    const resizeAccuracy = () => {
      const accuracy = devicePosition.accuracyMeters;
      circle.hidden = accuracy === null || map.getContainer().clientWidth === 0;
      if (circle.hidden || accuracy === null) return;
      // Use the same local map scale as MapLibre's GeolocateControl.
      const screen = map.project(coordinates);
      const metersPerPixel =
        coordinates.distanceTo(map.unproject([screen.x + 100, screen.y])) / 100;
      const diameter = (2 * accuracy) / metersPerPixel;
      if (!Number.isFinite(diameter) || diameter <= 0) {
        circle.hidden = true;
        return;
      }
      circle.style.width = `${diameter}px`;
      circle.style.height = `${diameter}px`;
    };
    const events = ["zoom", "move", "rotate", "pitch", "resize"] as const;
    for (const event of events) map.on(event, resizeAccuracy);
    resizeAccuracy();
    let disposed = false;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      for (const event of events) map.off(event, resizeAccuracy);
      positionMarker.remove();
      accuracyMarker.remove();
    };
    deviceCleanupRef.current = cleanup;
    return cleanup;
  }, [devicePosition, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !savedPlace) return;
    const name = savedPlace.kind === "home" ? "Home" : "Work";
    const element = document.createElement("div");
    element.className = "location-saved-place-marker";
    element.dataset.kind = savedPlace.kind;
    element.setAttribute("role", "img");
    element.setAttribute(
      "aria-label",
      `${name} saved place. Your search origin.`,
    );
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 42 54");
    svg.setAttribute("aria-hidden", "true");
    const outline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    outline.setAttribute(
      "d",
      "M21 52S3 32 3 21a18 18 0 1 1 36 0c0 11-18 31-18 31Z",
    );
    outline.setAttribute("fill", "currentColor");
    outline.setAttribute("stroke", "#fff");
    outline.setAttribute("stroke-width", "2");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "path");
    icon.setAttribute(
      "d",
      savedPlace.kind === "home"
        ? "m12 20 9-7 9 7v10H12Z M18 30v-8h6v8"
        : "M14 17h14v12H14Z M18 17v-4h6v4 M14 22h14 M21 21v3",
    );
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "#fff");
    icon.setAttribute("stroke-width", "1.8");
    icon.setAttribute("stroke-linejoin", "round");
    svg.append(outline, icon);
    const label = document.createElement("span");
    label.textContent = name;
    element.append(svg, label);
    const marker = new maplibregl.Marker({ element, anchor: "bottom" })
      .setLngLat([savedPlace.longitude, savedPlace.latitude])
      .addTo(map);
    let disposed = false;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      marker.remove();
    };
    savedPlaceCleanupRef.current = cleanup;
    return cleanup;
  }, [savedPlace, ready]);

  useEffect(() => {
    for (const [pointId, entry] of markersRef.current) {
      const selected = pointId === selectedPointId;
      entry.element.classList.toggle("selected", selected);
      entry.element.setAttribute("aria-pressed", String(selected));
    }
    if (!selectedPointId || !recenterOnSelection) return;
    const point = points.find(({ id }) => id === selectedPointId);
    const map = mapRef.current;
    if (!point || !map) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    map.easeTo({
      center: [point.longitude, point.latitude],
      zoom: Math.max(map.getZoom(), 12.5),
      duration: reducedMotion ? 0 : 450,
    });
  }, [markerVariant, points, ready, recenterOnSelection, selectedPointId]);

  return <div className="coach-map-canvas" ref={containerRef} />;
}
