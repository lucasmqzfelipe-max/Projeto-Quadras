/// <reference types="@types/google.maps" />

import { useEffect, useRef } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL = import.meta.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

type CourtMarker = {
  id: number;
  name: string;
  position: google.maps.LatLngLiteral;
  status: "open" | "closed" | "playing";
};

function loadMapScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      resolve();
      script.remove();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });
}

function createMarkerContent(status: CourtMarker["status"]) {
  const content = document.createElement("div");
  content.className = `court-map-marker court-map-marker-${status}`;
  content.innerHTML = "<span></span>";
  return content;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  markers?: CourtMarker[];
  onMapReady?: (map: google.maps.Map) => void;
  onMapError?: () => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  markers = [],
  onMapReady,
  onMapError,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);

  const init = usePersistFn(async () => {
    try {
      await loadMapScript();
      if (!mapContainer.current || !window.google?.maps) return;
      map.current = new window.google.maps.Map(mapContainer.current, {
        zoom: initialZoom,
        center: initialCenter,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: false,
        streetViewControl: false,
        mapId: "DEMO_MAP_ID",
      });

      if (markers.length) {
        const bounds = new window.google.maps.LatLngBounds();
        markers.forEach(marker => {
          bounds.extend(marker.position);
          const advancedMarker = new window.google.maps.marker.AdvancedMarkerElement({
            map: map.current,
            position: marker.position,
            title: marker.name,
            content: createMarkerContent(marker.status),
          });
          advancedMarker.addListener("click", () => {
            new window.google.maps.InfoWindow({ content: `<strong>${marker.name}</strong>` }).open({ map: map.current, anchor: advancedMarker });
          });
        });
        if (markers.length > 1) map.current.fitBounds(bounds, 52);
      }

      onMapReady?.(map.current);
    } catch (error) {
      console.warn("[Map] Failed to load map", error);
      onMapError?.();
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  return <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />;
}
