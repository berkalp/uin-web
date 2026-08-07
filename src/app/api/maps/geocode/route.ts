import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CachedGeocode = {
  latitude: number;
  longitude: number;
  displayName: string;
  expiresAt: number;
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const memoryCache = new Map<string, CachedGeocode>();

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 240);
}

function parseCoordinate(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const query = normalizeQuery(request.nextUrl.searchParams.get("q") ?? "");

  if (query.length < 2) {
    return NextResponse.json(
      { error: "A location query is required." },
      { status: 400 }
    );
  }

  const cacheKey = query.toLocaleLowerCase("tr-TR");
  const cached = memoryCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(
      {
        latitude: cached.latitude,
        longitude: cached.longitude,
        displayName: cached.displayName,
        source: "cache",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      }
    );
  }

  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("limit", "1");
  endpoint.searchParams.set("countrycodes", "tr");
  endpoint.searchParams.set("addressdetails", "0");

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "tr,en;q=0.8",
        "User-Agent": "UIN-Intent-Network/1.0",
      },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "The map service could not resolve this location." },
        { status: 502 }
      );
    }

    const rows = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;

    const latitude = parseCoordinate(rows[0]?.lat);
    const longitude = parseCoordinate(rows[0]?.lon);

    if (latitude === null || longitude === null) {
      return NextResponse.json(
        { error: "No map coordinate was found for this location." },
        { status: 404 }
      );
    }

    const result: CachedGeocode = {
      latitude,
      longitude,
      displayName: rows[0]?.display_name?.trim() || query,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    memoryCache.set(cacheKey, result);

    return NextResponse.json(
      {
        latitude: result.latitude,
        longitude: result.longitude,
        displayName: result.displayName,
        source: "nominatim",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (error) {
    console.error("Discover map geocoding failed:", error);

    return NextResponse.json(
      { error: "The map service is temporarily unavailable." },
      { status: 502 }
    );
  }
}
