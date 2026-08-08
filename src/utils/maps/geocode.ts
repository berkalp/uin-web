export type GeocodedLocation = {
  latitude: number;
  longitude: number;
  displayName: string;
  source: "nominatim" | "cache";
};

type CachedGeocode = GeocodedLocation & {
  expiresAt: number;
};

type GeocodeOptions = {
  countryCode?: string | null;
  language?: string;
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const memoryCache = new Map<string, CachedGeocode>();

export function normalizeGeocodeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 320);
}

function parseCoordinate(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCountryCode(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return /^[a-z]{2}$/.test(normalized) ? normalized : null;
}

function cacheKeyFor(query: string, options: GeocodeOptions) {
  return [
    normalizeGeocodeQuery(query).toLocaleLowerCase("tr-TR"),
    normalizeCountryCode(options.countryCode) ?? "*",
    options.language?.trim().toLowerCase() || "tr",
  ].join("|");
}

/**
 * Resolve a human-readable place/address into coordinates using Nominatim.
 *
 * This is the canonical server-side geocoder for UIN. Weather, map helpers and
 * future location workflows should use this function rather than introducing a
 * second geocoder with different capabilities.
 */
export async function geocodeLocation(
  rawQuery: string,
  options: GeocodeOptions = {}
): Promise<GeocodedLocation | null> {
  const query = normalizeGeocodeQuery(rawQuery);
  if (query.length < 2) return null;

  const key = cacheKeyFor(query, options);
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      latitude: cached.latitude,
      longitude: cached.longitude,
      displayName: cached.displayName,
      source: "cache",
    };
  }

  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("limit", "1");
  endpoint.searchParams.set("addressdetails", "0");

  const countryCode = normalizeCountryCode(options.countryCode);
  if (countryCode) endpoint.searchParams.set("countrycodes", countryCode);

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "Accept-Language": options.language?.trim() || "tr,en;q=0.8",
        "User-Agent": "UIN-Intent-Network/1.0",
      },
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(7000),
    });

    if (!response.ok) return null;

    const rows = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;

    const latitude = parseCoordinate(rows[0]?.lat);
    const longitude = parseCoordinate(rows[0]?.lon);
    if (latitude === null || longitude === null) return null;

    const result: CachedGeocode = {
      latitude,
      longitude,
      displayName: rows[0]?.display_name?.trim() || query,
      source: "nominatim",
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    memoryCache.set(key, result);

    return {
      latitude: result.latitude,
      longitude: result.longitude,
      displayName: result.displayName,
      source: result.source,
    };
  } catch {
    return null;
  }
}
