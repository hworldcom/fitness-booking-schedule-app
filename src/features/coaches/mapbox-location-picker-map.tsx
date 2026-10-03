"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { MAPBOX_STYLE } from "@/mapbox/provider";

export function MapboxLocationPickerMap({
  accessToken,
  latitude,
  longitude,
  onMove,
  onUnavailable,
}: {
  accessToken: string;
  latitude: number;
  longitude: number;
  onMove: (
    coordinates: Readonly<{ latitude: number; longitude: number }>,
  ) => void;
  onUnavailable: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
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
      const map = new mapboxgl.Map({
        accessToken,
        container: containerRef.current,
        style: MAPBOX_STYLE,
        center: [initialPosition.longitude, initialPosition.latitude],
        zoom: 14,
        attributionControl: true,
        cooperativeGestures: true,
      });
      const marker = new mapboxgl.Marker({ draggable: true })
        .setLngLat([initialPosition.longitude, initialPosition.latitude])
        .addTo(map);
      mapRef.current = map;
      markerRef.current = marker;
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
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
  }, [accessToken]);

  useEffect(() => {
    markerRef.current?.setLngLat([longitude, latitude]);
    mapRef.current?.jumpTo({ center: [longitude, latitude] });
  }, [latitude, longitude]);

  return <div className="coach-location-picker-map" ref={containerRef} />;
}
