"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { LocationMapPoint } from "../contracts";
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
}: {
  points: readonly LocationMapPoint[];
  selectedPointId: string | null;
  onSelectPoint: (pointId: string) => void;
  onUnavailable: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, MarkerEntry>());
  const onSelectRef = useRef(onSelectPoint);
  const onUnavailableRef = useRef(onUnavailable);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelectPoint;
  }, [onSelectPoint]);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

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
        cooperativeGestures: true,
      });
      mapRef.current = map;
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.getCanvas().setAttribute("aria-label", "Matching coach locations");
      const handleLoad = () => active && setReady(true);
      const handleError = () => active && onUnavailableRef.current();
      map.once("load", handleLoad);
      map.on("error", handleError);
      return () => {
        active = false;
        map.off("error", handleError);
        for (const entry of markers.values()) removeMarkerEntry(entry);
        markers.clear();
        map.remove();
        mapRef.current = null;
      };
    } catch {
      onUnavailableRef.current();
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const entry of markersRef.current.values()) removeMarkerEntry(entry);
    markersRef.current.clear();

    const bounds = new maplibregl.LngLatBounds();
    for (const point of points) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "location-map-marker";
      element.setAttribute(
        "aria-label",
        `Select ${point.name} at ${point.label}`,
      );
      element.setAttribute("aria-pressed", "false");
      const initials = document.createElement("span");
      initials.className = "location-map-marker-initials";
      initials.textContent = point.initials;
      element.append(initials);

      let image: HTMLImageElement | null = null;
      let handleImageError: (() => void) | null = null;
      if (point.imageUrl) {
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
      const marker = new maplibregl.Marker({ element, anchor: "bottom" })
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

    if (points.length === 1) {
      map.jumpTo({
        center: [points[0]!.longitude, points[0]!.latitude],
        zoom: 13,
      });
    } else if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 54, maxZoom: 13, duration: 0 });
    }
  }, [points, ready]);

  useEffect(() => {
    for (const [pointId, entry] of markersRef.current) {
      const selected = pointId === selectedPointId;
      entry.element.classList.toggle("selected", selected);
      entry.element.setAttribute("aria-pressed", String(selected));
    }
    if (!selectedPointId) return;
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
  }, [points, selectedPointId]);

  return <div className="coach-map-canvas" ref={containerRef} />;
}
