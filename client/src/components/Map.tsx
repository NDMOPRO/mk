/**
 * MAP COMPONENT - Dual Provider Support with Auto-Fallback & Manual Toggle
 *
 * Supports two map providers:
 * 1. Google Maps - when VITE_GOOGLE_MAPS_API_KEY env var is set
 * 2. Leaflet/OpenStreetMap - free fallback when no API key or Google Maps fails
 *
 * Features:
 * - Auto-detects Google Maps billing/quota errors and falls back to Leaflet
 * - Manual toggle button to switch between providers
 * - Bilingual support (Arabic/English)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// Provider Detection
// ============================================================
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const HAS_GOOGLE_KEY = !!GOOGLE_MAPS_API_KEY;

// ============================================================
// Unified Map Interface
// ============================================================
export interface MapInstance {
  provider: "google" | "leaflet";
  google?: google.maps.Map;
  leaflet?: any; // L.Map
  setCenter: (lat: number, lng: number) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: { north: number; south: number; east: number; west: number }) => void;
  addMarker: (lat: number, lng: number, options?: MarkerOptions) => any;
  removeAllMarkers: () => void;
  onMarkerClick: (marker: any, callback: () => void) => void;
  addPopup: (marker: any, content: string) => void;
}

export interface MarkerOptions {
  color?: string;
  label?: string;
  title?: string;
  icon?: string;
}

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: MapInstance) => void;
  onProviderChange?: (provider: "google" | "leaflet") => void;
}

// ============================================================
// Google Maps Loader
// ============================================================
let googleMapsLoaded = false;
let googleMapsLoading = false;
let googleMapsScriptFailed = false;
const googleMapsCallbacks: ((success: boolean) => void)[] = [];

function loadGoogleMaps(): Promise<boolean> {
  return new Promise((resolve) => {
    if (googleMapsScriptFailed) {
      resolve(false);
      return;
    }
    if (googleMapsLoaded) {
      resolve(true);
      return;
    }
    googleMapsCallbacks.push(resolve);
    if (googleMapsLoading) return;
    googleMapsLoading = true;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=ar&region=SA`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleMapsLoaded = true;
      googleMapsCallbacks.forEach((cb) => cb(true));
      googleMapsCallbacks.length = 0;
    };
    script.onerror = () => {
      console.warn("Failed to load Google Maps API script.");
      googleMapsScriptFailed = true;
      googleMapsLoading = false;
      googleMapsCallbacks.forEach((cb) => cb(false));
      googleMapsCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

// ============================================================
// Leaflet Loader (dynamic import)
// ============================================================
let leafletModule: any = null;

async function loadLeaflet() {
  if (leafletModule) return leafletModule;
  const L = await import("leaflet");
  await import("leaflet/dist/leaflet.css");

  // Fix default marker icons (broken with bundlers)
  const markerIcon2x = (await import("leaflet/dist/images/marker-icon-2x.png")).default;
  const markerIcon = (await import("leaflet/dist/images/marker-icon.png")).default;
  const markerShadow = (await import("leaflet/dist/images/marker-shadow.png")).default;

  // @ts-ignore
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });

  leafletModule = L;
  return L;
}

export function getLeafletModule() {
  return leafletModule;
}

// ============================================================
// Create Unified Map Instance - Google Maps
// ============================================================
function createGoogleMapInstance(map: google.maps.Map): MapInstance {
  const markers: google.maps.Marker[] = [];

  return {
    provider: "google",
    google: map,
    setCenter(lat, lng) {
      map.setCenter({ lat, lng });
    },
    setZoom(zoom) {
      map.setZoom(zoom);
    },
    fitBounds(bounds) {
      map.fitBounds(new google.maps.LatLngBounds(
        { lat: bounds.south, lng: bounds.west },
        { lat: bounds.north, lng: bounds.east }
      ));
    },
    addMarker(lat, lng, options = {}) {
      const { color = "#3ECFC0", label = "", title = "" } = options;

      const marker = new google.maps.Marker({
        map,
        position: { lat, lng },
        title,
        label: label ? {
          text: label,
          color: "#fff",
          fontWeight: "700",
          fontSize: "12px",
          fontFamily: "Tajawal, sans-serif",
        } : undefined,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          scale: label ? 18 : 10,
        },
      });
      markers.push(marker);
      return marker;
    },
    removeAllMarkers() {
      markers.forEach((m) => m.setMap(null));
      markers.length = 0;
    },
    onMarkerClick(marker, callback) {
      marker.addListener("click", callback);
    },
    addPopup(marker, content) {
      const infoWindow = new google.maps.InfoWindow({ content });
      marker.addListener("click", () => {
        infoWindow.open({ anchor: marker, map });
      });
    },
  };
}

// ============================================================
// Create Unified Map Instance - Leaflet
// ============================================================
function createLeafletMapInstance(map: any, L: any): MapInstance {
  const markers: any[] = [];

  return {
    provider: "leaflet",
    leaflet: map,
    setCenter(lat, lng) {
      map.setView([lat, lng]);
    },
    setZoom(zoom) {
      map.setZoom(zoom);
    },
    fitBounds(bounds) {
      map.fitBounds([
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ]);
    },
    addMarker(lat, lng, options = {}) {
      const { color = "#3ECFC0", label = "", title = "" } = options;
      const icon = L.divIcon({
        className: "custom-map-marker",
        html: `
          <div style="
            background: ${color};
            color: #fff;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            font-family: Tajawal, sans-serif;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            cursor: pointer;
            white-space: nowrap;
            border: 2px solid #fff;
            text-align: center;
            display: inline-block;
          ">${label || title}</div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const marker = L.marker([lat, lng], { icon, title }).addTo(map);
      markers.push(marker);
      return marker;
    },
    removeAllMarkers() {
      markers.forEach((m) => map.removeLayer(m));
      markers.length = 0;
    },
    onMarkerClick(marker, callback) {
      marker.on("click", callback);
    },
    addPopup(marker, content) {
      marker.bindPopup(content, {
        className: "custom-leaflet-popup",
        maxWidth: 300,
      });
    },
  };
}

// ============================================================
// MapView Component with Toggle & Auto-Fallback
// ============================================================
export function MapView({
  className,
  initialCenter = { lat: 24.7136, lng: 46.6753 },
  initialZoom = 12,
  onMapReady,
  onProviderChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapInstance | null>(null);
  const errorDetectionCleanupRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerUsed, setProviderUsed] = useState<"google" | "leaflet" | null>(null);
  const [desiredProvider, setDesiredProvider] = useState<"google" | "leaflet">(
    HAS_GOOGLE_KEY ? "google" : "leaflet"
  );
  const [googleFailed, setGoogleFailed] = useState(false);
  // Increment to force re-init
  const [initCounter, setInitCounter] = useState(0);

  const isAr = document.documentElement.lang === "ar" || document.documentElement.dir === "rtl";

  // Single initialization effect - handles ALL map creation
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    // Cleanup previous
    if (errorDetectionCleanupRef.current) {
      errorDetectionCleanupRef.current();
      errorDetectionCleanupRef.current = null;
    }
    if (mapInstanceRef.current?.provider === "leaflet" && mapInstanceRef.current.leaflet) {
      try { mapInstanceRef.current.leaflet.remove(); } catch (e) { /* ignore */ }
    }
    mapInstanceRef.current = null;

    // Clear container
    containerRef.current.innerHTML = "";
    const mapDiv = document.createElement("div");
    mapDiv.style.width = "100%";
    mapDiv.style.height = "100%";
    containerRef.current.appendChild(mapDiv);

    const effectiveProvider = (desiredProvider === "google" && HAS_GOOGLE_KEY && !googleFailed)
      ? "google"
      : "leaflet";

    async function initLeafletMap() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !containerRef.current) return;

        const map = L.map(mapDiv, {
          center: [initialCenter.lat, initialCenter.lng],
          zoom: initialZoom,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Handle resize
        resizeObserver = new ResizeObserver(() => {
          map.invalidateSize();
        });
        if (containerRef.current) {
          resizeObserver.observe(containerRef.current);
        }

        // Force invalidate after a tick
        setTimeout(() => {
          if (!cancelled) map.invalidateSize();
        }, 100);

        const instance = createLeafletMapInstance(map, L);
        mapInstanceRef.current = instance;

        if (!cancelled) {
          setProviderUsed("leaflet");
          setLoading(false);
          onMapReady?.(instance);
          onProviderChange?.("leaflet");
        }
      } catch (e) {
        console.error("Failed to initialize Leaflet:", e);
        if (!cancelled) setLoading(false);
      }
    }

    async function initGoogleMap() {
      try {
        const success = await loadGoogleMaps();
        if (cancelled || !containerRef.current) return;

        if (!success || !window.google?.maps) {
          console.warn("Google Maps failed to load, switching to OpenStreetMap");
          setGoogleFailed(true);
          return; // Effect will re-run due to googleFailed change
        }

        const map = new google.maps.Map(mapDiv, {
          center: { lat: initialCenter.lat, lng: initialCenter.lng },
          zoom: initialZoom,
          language: "ar",
          gestureHandling: "greedy",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });

        const instance = createGoogleMapInstance(map);
        mapInstanceRef.current = instance;

        if (!cancelled) {
          setProviderUsed("google");
          setLoading(false);
          onMapReady?.(instance);
          onProviderChange?.("google");
        }

        // Setup error detection for billing/quota issues
        if (containerRef.current) {
          const parentContainer = containerRef.current;
          let errorDetected = false;

          const checkForError = () => {
            if (errorDetected || cancelled) return;
            const text = parentContainer.innerText || "";
            if (
              text.includes("didn't load Google Maps") ||
              text.includes("لم تحمِّل هذه الصفحة خرائط") ||
              text.includes("عفوًا، حدث خطأ") ||
              text.includes("This page can't load Google Maps")
            ) {
              errorDetected = true;
              console.warn("Google Maps billing/quota error detected. Switching to OpenStreetMap...");
              // Just set state - the effect will re-run and create Leaflet map
              setGoogleFailed(true);
              setDesiredProvider("leaflet");
            }
          };

          // Check periodically for the first 30 seconds
          const interval = setInterval(checkForError, 1000);

          // Also use MutationObserver
          const observer = new MutationObserver(() => {
            checkForError();
          });
          observer.observe(parentContainer, { childList: true, subtree: true });

          errorDetectionCleanupRef.current = () => {
            clearInterval(interval);
            observer.disconnect();
          };
        }
      } catch (e) {
        console.warn("Google Maps initialization failed:", e);
        if (!cancelled) {
          setGoogleFailed(true);
          // Effect will re-run
        }
      }
    }

    setLoading(true);

    if (effectiveProvider === "google") {
      initGoogleMap();
    } else {
      initLeafletMap();
    }

    return () => {
      cancelled = true;
      if (errorDetectionCleanupRef.current) {
        errorDetectionCleanupRef.current();
        errorDetectionCleanupRef.current = null;
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current?.provider === "leaflet" && mapInstanceRef.current.leaflet) {
        try { mapInstanceRef.current.leaflet.remove(); } catch (e) { /* ignore */ }
      }
      mapInstanceRef.current = null;
    };
  }, [desiredProvider, googleFailed, initCounter]);

  // Toggle handler
  const handleToggle = useCallback(() => {
    if (providerUsed === "google") {
      setDesiredProvider("leaflet");
    } else if (providerUsed === "leaflet" && HAS_GOOGLE_KEY && !googleFailed) {
      setDesiredProvider("google");
    }
  }, [providerUsed, googleFailed]);

  // Can toggle?
  const canToggle = HAS_GOOGLE_KEY && !googleFailed;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={containerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ zIndex: 0, minHeight: "400px" }}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg z-[500]">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">
              {isAr ? "جاري تحميل الخريطة..." : "Loading map..."}
            </span>
          </div>
        </div>
      )}

      {/* Provider toggle button */}
      {!loading && providerUsed && (
        <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
          {/* Current provider badge + toggle */}
          <div className="bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              providerUsed === "google" ? "bg-green-500" : "bg-blue-500"
            )} />
            <span className="text-xs font-medium text-foreground">
              {providerUsed === "google" ? "Google Maps" : "OpenStreetMap"}
            </span>

            {/* Toggle button */}
            {canToggle && (
              <button
                onClick={handleToggle}
                className="ms-2 text-[11px] font-semibold text-teal hover:text-teal/80 transition-colors bg-teal/10 hover:bg-teal/20 px-2 py-0.5 rounded-md"
                title={isAr ? "تبديل مزود الخريطة" : "Switch map provider"}
              >
                {providerUsed === "google"
                  ? (isAr ? "تبديل → OSM" : "Switch → OSM")
                  : (isAr ? "تبديل → Google" : "Switch → Google")
                }
              </button>
            )}
          </div>

          {/* Fallback notice */}
          {googleFailed && providerUsed === "leaflet" && (
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg shadow-lg px-3 py-1.5">
              <span className="text-[11px] text-amber-700 dark:text-amber-300">
                {isAr
                  ? "⚠ تم التحويل تلقائياً إلى OpenStreetMap"
                  : "⚠ Auto-switched to OpenStreetMap"
                }
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Utility: Create cluster icon for Leaflet MarkerCluster
// ============================================================
export function createClusterIcon(count: number): any {
  if (!leafletModule) return null;
  const L = leafletModule;
  const size = count < 10 ? 40 : count < 50 ? 50 : count < 100 ? 60 : 70;
  const bgColor = count < 10 ? "#3ECFC0" : count < 50 ? "#E8B931" : count < 100 ? "#F97316" : "#EF4444";
  return L.divIcon({
    className: "custom-cluster-icon",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${bgColor};
        border: 3px solid #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 800;
        font-size: ${size < 50 ? 14 : 16}px;
        font-family: Tajawal, sans-serif;
        box-shadow: 0 3px 12px rgba(0,0,0,0.3);
        cursor: pointer;
      ">${count}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default MapView;
