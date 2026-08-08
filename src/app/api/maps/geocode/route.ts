import { NextRequest, NextResponse } from "next/server";

import { geocodeLocation, normalizeGeocodeQuery } from "@/utils/maps/geocode";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = normalizeGeocodeQuery(request.nextUrl.searchParams.get("q") ?? "");
  const countryCode = request.nextUrl.searchParams.get("country");

  if (query.length < 2) {
    return NextResponse.json(
      { error: "A location query is required." },
      { status: 400 }
    );
  }

  const result = await geocodeLocation(query, {
    countryCode,
    language: "tr,en;q=0.8",
  });

  if (!result) {
    return NextResponse.json(
      { error: "No map coordinate was found for this location." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      latitude: result.latitude,
      longitude: result.longitude,
      displayName: result.displayName,
      source: result.source,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    }
  );
}
