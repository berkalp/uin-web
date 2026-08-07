"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import DiscoverIntentCard, {
  type DiscoverIntentRow,
} from "@/components/discover/DiscoverIntentCard";
import type { IntentCommunityContext } from "@/utils/communities";
import type { IntentLinkView } from "@/utils/intentLinks";

export type DiscoverMapPoint = {
  intentId: string;
  planId: string | null;
  resourceHref: string;
  title: string;
  activityName: string;
  categoryName: string;
  lifecycle: string;
  city: string | null;
  district: string | null;
  publicLocationName: string | null;
  locationPrecision: "public_venue" | "approximate";
  locationQuery: string;
  latitude: number | null;
  longitude: number | null;
  startDate: string;
  endDate: string;
  coverUrl: string | null;
  sportName: string | null;
  communityNames: string[];
  participantCount: number;
  maxParticipants: number | null;
  viewerCanRequest: boolean;
  viewerIsMember: boolean;
  cardIntent: DiscoverIntentRow;
  cardDisplayTitle: string | null;
  cardPrivateCoverUrl: string | null;
  cardContextCoverUrl: string | null;
  cardPublicActivityLocationName: string | null;
  cardCommunities: IntentCommunityContext[];
  cardRelatedLinks: IntentLinkView[];
};

type DiscoverMapViewProps = {
  points: DiscoverMapPoint[];
  mode: "map" | "split";
  currentUserId: string;
};

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  fitBounds: (
    bounds: Array<[number, number]>,
    options?: Record<string, unknown>
  ) => LeafletMap;
  getZoom: () => number;
  invalidateSize: (
    options?: boolean | Record<string, unknown>
  ) => LeafletMap;
  getBounds: () => {
    getSouth: () => number;
    getWest: () => number;
    getNorth: () => number;
    getEast: () => number;
  };
  on: (event: string, callback: () => void) => LeafletMap;
  off: (event: string, callback: () => void) => LeafletMap;
  remove: () => void;
};

type LeafletLayerGroup = {
  clearLayers: () => void;
  addTo: (map: LeafletMap) => LeafletLayerGroup;
};

type LeafletMarker = {
  addTo: (layer: LeafletLayerGroup) => LeafletMarker;
  on: (event: string, callback: () => void) => LeafletMarker;
};

type LeafletNamespace = {
  map: (
    element: HTMLElement,
    options?: Record<string, unknown>
  ) => LeafletMap;
  tileLayer: (
    url: string,
    options?: Record<string, unknown>
  ) => { addTo: (map: LeafletMap) => void };
  layerGroup: () => LeafletLayerGroup;
  divIcon: (options: Record<string, unknown>) => unknown;
  marker: (
    coordinates: [number, number],
    options?: Record<string, unknown>
  ) => LeafletMarker;
  circleMarker: (
    coordinates: [number, number],
    options?: Record<string, unknown>
  ) => LeafletMarker;
};

declare global {
  interface Window {
    L?: LeafletNamespace;
    __uinLeafletPromise?: Promise<LeafletNamespace>;
  }
}

type ResolvedPoint = DiscoverMapPoint & {
  latitude: number;
  longitude: number;
};

type MapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

const DEFAULT_CENTER: [number, number] = [39.0, 35.0];
const DEFAULT_ZOOM = 6;
const GEOCODE_DELAY_MS = 1100;
const LOCAL_CACHE_PREFIX = "uin-map-geocode:";

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}


function getLifecycleColor(lifecycle: string) {
  if (lifecycle === "forming") return "#7c3aed";
  if (lifecycle === "planned") return "#2563eb";
  if (lifecycle === "future") return "#3b82f6";
  if (lifecycle === "open") return "#16a34a";
  return "#475569";
}

function getPointIcon(point: DiscoverMapPoint) {
  const normalizedSport = point.sportName?.toLocaleLowerCase("en") ?? "";
  const normalizedCategory = point.categoryName.toLocaleLowerCase("en");

  if (normalizedSport.includes("football")) return "⚽";
  if (normalizedSport.includes("basket")) return "🏀";
  if (normalizedSport.includes("volley")) return "🏐";
  if (normalizedCategory.includes("music") || normalizedCategory.includes("culture")) return "♪";
  if (normalizedCategory.includes("travel")) return "⌖";
  if (normalizedCategory.includes("sport")) return "●";
  return "◎";
}

function getClusterGridSize(zoom: number) {
  if (zoom <= 6) return 1.5;
  if (zoom <= 8) return 0.55;
  if (zoom <= 10) return 0.18;
  if (zoom <= 12) return 0.055;
  if (zoom <= 13) return 0.018;
  return 0;
}

function getCoordinateKey(
  point: Pick<ResolvedPoint, "latitude" | "longitude">
) {
  return `${point.latitude.toFixed(6)}:${point.longitude.toFixed(6)}`;
}

function getSpiderCoordinate(
  point: ResolvedPoint,
  index: number,
  total: number,
  zoom: number
): [number, number] {
  if (total <= 1) return [point.latitude, point.longitude];

  const ringCapacity = 10;
  const ringIndex = Math.floor(index / ringCapacity);
  const indexInRing = index % ringCapacity;
  const countInRing = Math.min(
    ringCapacity,
    total - ringIndex * ringCapacity
  );
  const angle =
    -Math.PI / 2 +
    (Math.PI * 2 * indexInRing) / Math.max(countInRing, 1);
  const radiusInPixels = 34 + ringIndex * 24;
  const degreesPerPixel =
    360 / (256 * Math.pow(2, Math.max(zoom, 1)));
  const latitudeOffset =
    Math.sin(angle) * radiusInPixels * degreesPerPixel;
  const longitudeCorrection = Math.max(
    Math.cos((point.latitude * Math.PI) / 180),
    0.25
  );
  const longitudeOffset =
    (Math.cos(angle) * radiusInPixels * degreesPerPixel) /
    longitudeCorrection;

  return [
    point.latitude + latitudeOffset,
    point.longitude + longitudeOffset,
  ];
}

function isInsideBounds(point: ResolvedPoint, bounds: MapBounds | null) {
  if (!bounds) return true;

  return (
    point.latitude >= bounds.south &&
    point.latitude <= bounds.north &&
    point.longitude >= bounds.west &&
    point.longitude <= bounds.east
  );
}

function distanceInKilometers(
  leftLatitude: number,
  leftLongitude: number,
  rightLatitude: number,
  rightLongitude: number
) {
  const radius = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(rightLatitude - leftLatitude);
  const longitudeDelta = toRadians(rightLongitude - leftLongitude);
  const leftRadians = toRadians(leftLatitude);
  const rightRadians = toRadians(rightLatitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftRadians) *
      Math.cos(rightRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCachedGeocode(query: string) {
  try {
    const value = window.localStorage.getItem(
      `${LOCAL_CACHE_PREFIX}${query.toLocaleLowerCase("tr-TR")}`
    );

    if (!value) return null;

    const parsed = JSON.parse(value) as {
      latitude?: unknown;
      longitude?: unknown;
    };

    const latitude = toNumber(parsed.latitude as number | string | null);
    const longitude = toNumber(parsed.longitude as number | string | null);

    if (latitude === null || longitude === null) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

function saveCachedGeocode(
  query: string,
  coordinates: { latitude: number; longitude: number }
) {
  try {
    window.localStorage.setItem(
      `${LOCAL_CACHE_PREFIX}${query.toLocaleLowerCase("tr-TR")}`,
      JSON.stringify(coordinates)
    );
  } catch {
    // Local storage may be unavailable in strict privacy mode. The map still works.
  }
}

async function loadLeaflet() {
  if (window.L) return window.L;
  if (window.__uinLeafletPromise) return window.__uinLeafletPromise;

  window.__uinLeafletPromise = new Promise<LeafletNamespace>((resolve, reject) => {
    const existingStylesheet = document.querySelector<HTMLLinkElement>(
      'link[data-uin-leaflet="true"]'
    );

    if (!existingStylesheet) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      stylesheet.dataset.uinLeaflet = "true";
      document.head.appendChild(stylesheet);
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-uin-leaflet="true"]'
    );

    const finish = () => {
      if (window.L) resolve(window.L);
      else reject(new Error("Leaflet did not initialise."));
    };

    if (existingScript) {
      existingScript.addEventListener("load", finish, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Leaflet could not be loaded.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.uinLeaflet = "true";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Leaflet could not be loaded.")),
      { once: true }
    );
    document.body.appendChild(script);
  });

  return window.__uinLeafletPromise;
}

export default function DiscoverMapView({
  points,
  mode,
  currentUserId,
}: DiscoverMapViewProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const splitListRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LeafletLayerGroup | null>(null);
  const suppressMoveRef = useRef(false);
  const hasInitialFitRef = useRef(false);
  const [resolvedCoordinates, setResolvedCoordinates] = useState<
    Record<string, { latitude: number; longitude: number }>
  >({});
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(
    points[0]?.intentId ?? null
  );
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchBounds, setSearchBounds] = useState<MapBounds | null>(null);
  const [mapMoved, setMapMoved] = useState(false);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const resolvedPoints = useMemo<ResolvedPoint[]>(() => {
    return points.flatMap((point) => {
      const latitude = toNumber(point.latitude) ?? resolvedCoordinates[point.intentId]?.latitude;
      const longitude = toNumber(point.longitude) ?? resolvedCoordinates[point.intentId]?.longitude;

      if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
        return [];
      }

      return [{ ...point, latitude, longitude }];
    });
  }, [points, resolvedCoordinates]);

  const visiblePoints = useMemo(
    () => resolvedPoints.filter((point) => isInsideBounds(point, searchBounds)),
    [resolvedPoints, searchBounds]
  );

  const coordinateGroups = useMemo(() => {
    const groups = new Map<string, ResolvedPoint[]>();

    visiblePoints.forEach((point) => {
      const key = getCoordinateKey(point);
      const group = groups.get(key) ?? [];
      group.push(point);
      group.sort((left, right) => {
        const dateComparison = left.startDate.localeCompare(right.startDate);
        if (dateComparison !== 0) return dateComparison;
        return left.title.localeCompare(right.title);
      });
      groups.set(key, group);
    });

    return groups;
  }, [visiblePoints]);

  const selectedPoint =
    visiblePoints.find((point) => point.intentId === selectedIntentId) ??
    visiblePoints[0] ??
    null;

  const selectedCoordinateGroup = selectedPoint
    ? coordinateGroups.get(getCoordinateKey(selectedPoint)) ?? [selectedPoint]
    : [];

  const selectedCoordinateIndex = selectedPoint
    ? Math.max(
        selectedCoordinateGroup.findIndex(
          (point) => point.intentId === selectedPoint.intentId
        ),
        0
      )
    : 0;

  const sortedPoints = useMemo(() => {
    if (!userLocation) return visiblePoints;

    return [...visiblePoints].sort((left, right) => {
      const leftDistance = distanceInKilometers(
        userLocation.latitude,
        userLocation.longitude,
        left.latitude,
        left.longitude
      );
      const rightDistance = distanceInKilometers(
        userLocation.latitude,
        userLocation.longitude,
        right.latitude,
        right.longitude
      );
      return leftDistance - rightDistance;
    });
  }, [visiblePoints, userLocation]);

  useEffect(() => {
    if (visiblePoints.length === 0) {
      if (selectedIntentId !== null) setSelectedIntentId(null);
      return;
    }

    if (!visiblePoints.some((point) => point.intentId === selectedIntentId)) {
      setSelectedIntentId(visiblePoints[0].intentId);
    }
  }, [selectedIntentId, visiblePoints]);

  useEffect(() => {
    if (mode !== "split" || !selectedIntentId) return;

    const selectedCard =
      splitListRef.current?.querySelector<HTMLElement>(
        `[data-map-intent-id="${selectedIntentId}"]`
      ) ?? null;

    selectedCard?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [mode, selectedIntentId]);

  useEffect(() => {
    let cancelled = false;

    async function resolveMissingCoordinates() {
      const missingQueries = Array.from(
        new Map(
          points
            .filter(
              (point) =>
                toNumber(point.latitude) === null &&
                toNumber(point.longitude) === null &&
                point.locationQuery.trim().length > 1
            )
            .map((point) => [point.locationQuery.trim(), point])
        ).entries()
      );

      if (missingQueries.length === 0) return;
      setIsGeocoding(true);

      for (const [query, representative] of missingQueries) {
        if (cancelled) break;

        const cached = getCachedGeocode(query);
        if (cached) {
          setResolvedCoordinates((current) => {
            const next = { ...current };
            points
              .filter((point) => point.locationQuery.trim() === query)
              .forEach((point) => {
                next[point.intentId] = cached;
              });
            return next;
          });
          continue;
        }

        try {
          const response = await fetch(
            `/api/maps/geocode?q=${encodeURIComponent(query)}`,
            { cache: "force-cache" }
          );

          if (response.ok) {
            const data = (await response.json()) as {
              latitude?: unknown;
              longitude?: unknown;
            };
            const latitude = toNumber(data.latitude as number | string | null);
            const longitude = toNumber(data.longitude as number | string | null);

            if (latitude !== null && longitude !== null) {
              const coordinates = { latitude, longitude };
              saveCachedGeocode(query, coordinates);
              setResolvedCoordinates((current) => {
                const next = { ...current };
                points
                  .filter((point) => point.locationQuery.trim() === query)
                  .forEach((point) => {
                    next[point.intentId] = coordinates;
                  });
                return next;
              });
            }
          }
        } catch (error) {
          console.warn("Discover map location could not be resolved:", representative.locationQuery, error);
        }

        await sleep(GEOCODE_DELAY_MS);
      }

      if (!cancelled) setIsGeocoding(false);
    }

    void resolveMissingCoordinates();

    return () => {
      cancelled = true;
    };
  }, [points]);

  useEffect(() => {
    let disposed = false;

    async function initialiseMap() {
      if (!mapElementRef.current || mapRef.current) return;

      try {
        const L = await loadLeaflet();
        if (disposed || !mapElementRef.current) return;

        const map = L.map(mapElementRef.current, {
          zoomControl: true,
          attributionControl: true,
          minZoom: 4,
          maxZoom: 18,
        }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);

        markerLayerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setMapZoom(map.getZoom());

        const handleMove = () => {
          setMapZoom(map.getZoom());
          if (suppressMoveRef.current) {
            suppressMoveRef.current = false;
            setMapMoved(false);
            return;
          }
          setMapMoved(true);
        };

        map.on("moveend", handleMove);
        map.on("zoomend", handleMove);
        setMapReady(true);
      } catch (error) {
        console.error("Discover map failed to initialise:", error);
        setMapError("The interactive map could not be loaded.");
      }
    }

    void initialiseMap();

    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerLayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const element = mapElementRef.current;

    if (!mapReady || !map || !element) return;

    let animationFrame = 0;
    const refreshMapSize = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false, pan: false });
      });
    };

    refreshMapSize();
    const delayedRefresh = window.setTimeout(refreshMapSize, 180);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(refreshMapSize);

    observer?.observe(element);

    return () => {
      window.clearTimeout(delayedRefresh);
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
    };
  }, [mapReady, mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      !mapReady ||
      resolvedPoints.length === 0 ||
      hasInitialFitRef.current
    ) return;

    const bounds = resolvedPoints.map(
      (point): [number, number] => [point.latitude, point.longitude]
    );

    suppressMoveRef.current = true;
    hasInitialFitRef.current = true;
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
  }, [mapReady, resolvedPoints]);

  const selectPoint = useCallback((point: ResolvedPoint) => {
    setSelectedIntentId(point.intentId);
    const map = mapRef.current;
    if (map) {
      suppressMoveRef.current = true;
      map.setView([point.latitude, point.longitude], Math.max(map.getZoom(), 15));
      window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false, pan: false });
      });
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    const L = window.L;

    if (!map || !layer || !L || !mapReady) return;

    layer.clearLayers();

    const gridSize = getClusterGridSize(mapZoom);
    const groups = new Map<string, ResolvedPoint[]>();

    visiblePoints.forEach((point) => {
      const key =
        gridSize === 0
          ? getCoordinateKey(point)
          : `${Math.round(point.latitude / gridSize)}:${Math.round(
              point.longitude / gridSize
            )}`;
      const group = groups.get(key) ?? [];
      group.push(point);
      groups.set(key, group);
    });

    groups.forEach((group) => {
      const isGridCluster = group.length > 1 && gridSize > 0;

      if (isGridCluster) {
        const latitude =
          group.reduce((sum, point) => sum + point.latitude, 0) / group.length;
        const longitude =
          group.reduce((sum, point) => sum + point.longitude, 0) / group.length;
        const icon = L.divIcon({
          className: "uin-discover-cluster",
          html: `<span>${group.length}</span>`,
          iconSize: [42, 42],
          iconAnchor: [21, 21],
        });

        L.marker([latitude, longitude], { icon })
          .addTo(layer)
          .on("click", () => {
            const uniqueCoordinates = new Set(
              group.map((point) => getCoordinateKey(point))
            );

            suppressMoveRef.current = true;
            setSelectedIntentId(group[0].intentId);

            if (uniqueCoordinates.size === 1) {
              map.setView(
                [group[0].latitude, group[0].longitude],
                Math.max(map.getZoom() + 2, 15)
              );
              return;
            }

            map.fitBounds(
              group.map(
                (point): [number, number] => [
                  point.latitude,
                  point.longitude,
                ]
              ),
              { padding: [60, 60], maxZoom: 15 }
            );
          });
        return;
      }

      group.forEach((point, index) => {
        const color = getLifecycleColor(point.lifecycle);
        const selected = point.intentId === selectedIntentId;
        const coordinates =
          group.length > 1
            ? getSpiderCoordinate(point, index, group.length, mapZoom)
            : ([point.latitude, point.longitude] as [number, number]);
        const icon = L.divIcon({
          className: "uin-discover-marker",
          html: `<span style="--uin-marker-color:${color}" class="${
            selected ? "is-selected" : ""
          }"><b>${getPointIcon(point)}</b></span>`,
          iconSize: selected ? [46, 46] : [40, 40],
          iconAnchor: selected ? [23, 40] : [20, 36],
        });

        L.marker(coordinates, { icon })
          .addTo(layer)
          .on("click", () => setSelectedIntentId(point.intentId));
      });
    });

    if (userLocation) {
      L.circleMarker([userLocation.latitude, userLocation.longitude], {
        radius: 8,
        color: "#2563eb",
        fillColor: "#60a5fa",
        fillOpacity: 0.9,
        weight: 3,
      }).addTo(layer);
    }
  }, [mapReady, mapZoom, selectedIntentId, userLocation, visiblePoints]);

  const navigateSelectedCoordinateGroup = useCallback(
    (direction: -1 | 1) => {
      if (selectedCoordinateGroup.length <= 1) return;

      const nextIndex =
        (selectedCoordinateIndex +
          direction +
          selectedCoordinateGroup.length) %
        selectedCoordinateGroup.length;
      setSelectedIntentId(selectedCoordinateGroup[nextIndex].intentId);
    },
    [selectedCoordinateGroup, selectedCoordinateIndex]
  );

  function searchCurrentArea() {
    const bounds = mapRef.current?.getBounds();
    if (!bounds) return;

    setSearchBounds({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    });
    setMapMoved(false);
  }

  function resetArea() {
    setSearchBounds(null);
    setMapMoved(false);

    if (resolvedPoints.length > 0) {
      suppressMoveRef.current = true;
      mapRef.current?.fitBounds(
        resolvedPoints.map((point): [number, number] => [point.latitude, point.longitude]),
        { padding: [50, 50], maxZoom: 13 }
      );
    }
  }

  function locateUser() {
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Location is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(nextLocation);
        mapRef.current?.setView(
          [nextLocation.latitude, nextLocation.longitude],
          13
        );
      },
      () => {
        setLocationError("Location permission was not granted.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  const mapPanel = (
    <div
      className={`relative h-[560px] min-w-0 overflow-hidden rounded-3xl border border-gray-200 bg-slate-100 shadow-sm lg:h-[680px] ${
        mode === "split" ? "w-full" : ""
      }`}
    >
      <style jsx global>{`
        .uin-discover-marker,
        .uin-discover-cluster {
          background: transparent !important;
          border: 0 !important;
        }
        .uin-discover-marker > span {
          display: grid;
          width: 38px;
          height: 38px;
          place-items: center;
          border: 4px solid white;
          border-radius: 999px 999px 999px 7px;
          background: var(--uin-marker-color);
          color: white;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.3);
          font-size: 16px;
          transform: rotate(-45deg);
          transition: transform 160ms ease, width 160ms ease, height 160ms ease;
        }
        .uin-discover-marker > span.is-selected {
          width: 44px;
          height: 44px;
          box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.2), 0 10px 30px rgba(15, 23, 42, 0.4);
        }
        .uin-discover-marker > span {
          line-height: 1;
        }
        .uin-discover-marker > span > b {
          display: block;
          transform: rotate(45deg);
          font-style: normal;
        }
        .uin-discover-cluster > span {
          display: grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border: 4px solid white;
          border-radius: 999px;
          background: #111827;
          color: white;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.35);
          font-size: 13px;
          font-weight: 800;
        }
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>

      <div ref={mapElementRef} className="absolute inset-0" aria-label="Discover Intents map" />

      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-start justify-between gap-2 md:inset-x-4 md:top-4">
        <div className="pointer-events-auto rounded-2xl border border-white/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
            Map discovery
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-950">
            {visiblePoints.length} mapped Intent{visiblePoints.length === 1 ? "" : "s"}
          </p>
          {isGeocoding && (
            <p className="mt-1 text-xs text-gray-500">Resolving approximate areas…</p>
          )}
        </div>

        <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={locateUser}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-lg transition hover:border-blue-400 hover:text-blue-700"
          >
            ◎ Near me
          </button>
          {(searchBounds || mapMoved) && (
            <button
              type="button"
              onClick={searchCurrentArea}
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-blue-700"
            >
              Search this area
            </button>
          )}
          {searchBounds && (
            <button
              type="button"
              onClick={resetArea}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-lg"
            >
              Reset area
            </button>
          )}
        </div>
      </div>

      {(mapError || locationError) && (
        <div className="absolute inset-x-4 top-24 z-[500] rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 shadow">
          {mapError || locationError}
        </div>
      )}

      {selectedPoint && (
        <div className="absolute inset-x-3 bottom-3 z-[500] max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-[28px] bg-white/95 p-2 shadow-2xl backdrop-blur md:left-auto md:right-4 md:w-[430px]">
          {selectedCoordinateGroup.length > 1 && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2">
              <button
                type="button"
                onClick={() => navigateSelectedCoordinateGroup(-1)}
                aria-label="Show previous Intent at this map point"
                className="grid h-9 w-9 place-items-center rounded-full border border-blue-200 bg-white text-lg font-bold text-blue-700 transition hover:bg-blue-100"
              >
                ‹
              </button>

              <div className="min-w-0 text-center">
                <p className="text-xs font-bold text-blue-900">
                  {selectedCoordinateIndex + 1} / {selectedCoordinateGroup.length}
                </p>
                <p className="truncate text-[11px] text-blue-700">
                  Intents at the same approximate point
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigateSelectedCoordinateGroup(1)}
                aria-label="Show next Intent at this map point"
                className="grid h-9 w-9 place-items-center rounded-full border border-blue-200 bg-white text-lg font-bold text-blue-700 transition hover:bg-blue-100"
              >
                ›
              </button>
            </div>
          )}

          <DiscoverIntentCard
            intent={selectedPoint.cardIntent}
            currentUserId={currentUserId}
            relatedLinks={selectedPoint.cardRelatedLinks}
            communities={selectedPoint.cardCommunities}
            displayTitle={selectedPoint.cardDisplayTitle}
            privateCoverUrl={selectedPoint.cardPrivateCoverUrl}
            contextCoverUrl={selectedPoint.cardContextCoverUrl}
            publicActivityLocationName={
              selectedPoint.cardPublicActivityLocationName
            }
            showEmbeddedMap={false}
          />
        </div>
      )}

      {!mapError && resolvedPoints.length === 0 && !isGeocoding && (
        <div className="absolute inset-0 z-[450] grid place-items-center bg-slate-50/90 p-8 text-center">
          <div>
            <p className="text-lg font-bold text-gray-900">No mappable location yet</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
              These results do not yet have a public venue or an approximate catalogue coordinate.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (mode === "map") {
    return <section className="mt-5">{mapPanel}</section>;
  }

  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(440px,500px)_minmax(0,1fr)]">
      <div
        ref={splitListRef}
        className="max-h-[680px] space-y-3 overflow-y-auto rounded-3xl border border-gray-200 bg-gray-100/60 p-3 shadow-inner"
      >
        {sortedPoints.map((point) => {
          return (
            <div
              key={point.intentId}
              data-map-intent-id={point.intentId}
              onMouseEnter={() => selectPoint(point)}
              onFocusCapture={() => selectPoint(point)}
              onClick={() => selectPoint(point)}
              className={`rounded-[26px] transition ${
                point.intentId === selectedPoint?.intentId
                  ? "ring-2 ring-blue-500 ring-offset-2"
                  : "hover:ring-2 hover:ring-blue-100"
              }`}
            >
              <DiscoverIntentCard
                intent={point.cardIntent}
                currentUserId={currentUserId}
                relatedLinks={point.cardRelatedLinks}
                communities={point.cardCommunities}
                displayTitle={point.cardDisplayTitle}
                privateCoverUrl={point.cardPrivateCoverUrl}
                contextCoverUrl={point.cardContextCoverUrl}
                publicActivityLocationName={
                  point.cardPublicActivityLocationName
                }
                showEmbeddedMap={false}
              />
            </div>
          );
        })}

        {sortedPoints.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            No mapped Intents are inside this area.
          </div>
        )}
      </div>

      <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
        {mapPanel}
      </div>
    </section>
  );
}
