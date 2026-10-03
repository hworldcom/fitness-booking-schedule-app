"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { CoachProjection } from "@/domain/coaches";
import { MAPBOX_STYLE } from "@/mapbox/provider";

export function MapboxCoachMap({
  accessToken,
  coaches,
  selectedCoachId,
  onSelectCoach,
  onUnavailable,
}: {
  accessToken: string;
  coaches: readonly CoachProjection[];
  selectedCoachId: string | null;
  onSelectCoach: (profileId: string) => void;
  onUnavailable: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef(
    new Map<
      string,
      Readonly<{
        marker: mapboxgl.Marker;
        element: HTMLButtonElement;
        handleClick: () => void;
      }>
    >(),
  );
  const onSelectRef = useRef(onSelectCoach);
  const onUnavailableRef = useRef(onUnavailable);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelectCoach;
  }, [onSelectCoach]);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    if (!containerRef.current) return;
    let active = true;
    const markers = markersRef.current;
    try {
      const map = new mapboxgl.Map({
        accessToken,
        container: containerRef.current,
        style: MAPBOX_STYLE,
        center: [13.405, 52.52],
        zoom: 10.5,
        attributionControl: true,
        cooperativeGestures: true,
      });
      mapRef.current = map;
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
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
        for (const entry of markers.values()) {
          entry.element.removeEventListener("click", entry.handleClick);
          entry.marker.remove();
        }
        markers.clear();
        map.remove();
        mapRef.current = null;
      };
    } catch {
      onUnavailableRef.current();
    }
  }, [accessToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const entry of markersRef.current.values()) {
      entry.element.removeEventListener("click", entry.handleClick);
      entry.marker.remove();
    }
    markersRef.current.clear();

    const bounds = new mapboxgl.LngLatBounds();
    for (const coach of coaches) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "coach-map-marker";
      element.setAttribute(
        "aria-label",
        `Select ${coach.displayName} at ${coach.location.label}`,
      );
      element.setAttribute("aria-pressed", "false");
      element.textContent = coach.displayName
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      const handleClick = () => onSelectRef.current(coach.profileId);
      element.addEventListener("click", handleClick);
      const coordinates: [number, number] = [
        coach.location.longitude,
        coach.location.latitude,
      ];
      const marker = new mapboxgl.Marker({ element, anchor: "bottom" })
        .setLngLat(coordinates)
        .addTo(map);
      markersRef.current.set(
        coach.profileId,
        Object.freeze({ marker, element, handleClick }),
      );
      bounds.extend(coordinates);
    }

    if (coaches.length === 1) {
      map.jumpTo({
        center: [coaches[0]!.location.longitude, coaches[0]!.location.latitude],
        zoom: 13,
      });
    } else if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 54, maxZoom: 13, duration: 0 });
    }
  }, [coaches, ready]);

  useEffect(() => {
    for (const [profileId, entry] of markersRef.current) {
      const selected = profileId === selectedCoachId;
      entry.element.classList.toggle("selected", selected);
      entry.element.setAttribute("aria-pressed", String(selected));
    }
    if (!selectedCoachId) return;
    const coach = coaches.find(
      ({ profileId }) => profileId === selectedCoachId,
    );
    const map = mapRef.current;
    if (!coach || !map) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    map.easeTo({
      center: [coach.location.longitude, coach.location.latitude],
      zoom: Math.max(map.getZoom(), 12.5),
      duration: reducedMotion ? 0 : 450,
    });
  }, [coaches, selectedCoachId]);

  return <div className="coach-map-canvas" ref={containerRef} />;
}
