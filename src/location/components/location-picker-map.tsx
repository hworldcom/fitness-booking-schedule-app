"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { MAPLIBRE_WORKER_URL } from "../providers/maplibre";
import { OPENFREEMAP_STYLE_URL } from "../providers/openfreemap";

export function LocationPickerMap({
  latitude,
  longitude,
  onMove,
  onUnavailable,
}: {
  latitude: number;
  longitude: number;
  onMove: (
    coordinates: Readonly<{ latitude: number; longitude: number }>,
  ) => void;
  onUnavailable: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const initialPositionRef = useRef(Object.freeze({ latitude, longitude }));
  const onMoveRef = useRef(onMove);
  const onUnavailableRef = useRef(onUnavailable);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    if (!containerRef.current) return;
    let active = true;
    const initialPosition = initialPositionRef.current;
    try {
      maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: OPENFREEMAP_STYLE_URL,
        center: [initialPosition.longitude, initialPosition.latitude],
        zoom: 14,
        attributionControl: { compact: false },
        cooperativeGestures: true,
      });
      const marker = new maplibregl.Marker({ draggable: true })
        .setLngLat([initialPosition.longitude, initialPosition.latitude])
        .addTo(map);
      mapRef.current = map;
      markerRef.current = marker;
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map
        .getCanvas()
        .setAttribute("aria-label", "Adjust the confirmed public location pin");
      const handleDragEnd = () => {
        const coordinates = marker.getLngLat();
        onMoveRef.current(
          Object.freeze({
            latitude: coordinates.lat,
            longitude: coordinates.lng,
          }),
        );
      };
      const handleError = () => active && onUnavailableRef.current();
      marker.on("dragend", handleDragEnd);
      map.on("error", handleError);
      return () => {
        active = false;
        marker.off("dragend", handleDragEnd);
        map.off("error", handleError);
        marker.remove();
        map.remove();
        markerRef.current = null;
        mapRef.current = null;
      };
    } catch {
      onUnavailableRef.current();
    }
  }, []);

  useEffect(() => {
    markerRef.current?.setLngLat([longitude, latitude]);
    mapRef.current?.jumpTo({ center: [longitude, latitude] });
  }, [latitude, longitude]);

  return <div className="coach-location-picker-map" ref={containerRef} />;
}
