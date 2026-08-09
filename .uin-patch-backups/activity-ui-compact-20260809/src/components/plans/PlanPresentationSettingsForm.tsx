"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type CoordinateValue = number | string | null;
type LocationVisibility = "members" | "public";

type LocationFormState = {
  name: string;
  addressText: string;
  mapUrl: string;
  streetViewUrl: string;
  latitude: string;
  longitude: string;
};

type PlanPresentationSettingsFormProps = {
  planId: string;
  initialCoverUrl: string | null;
  initialMeetingPoint: string | null;
  initialMeetingAddressText: string | null;
  initialMeetingMapUrl: string | null;
  initialMeetingStreetViewUrl: string | null;
  initialMeetingLatitude: CoordinateValue;
  initialMeetingLongitude: CoordinateValue;
  initialActivityLocationName: string | null;
  initialActivityAddressText: string | null;
  initialActivityMapUrl: string | null;
  initialActivityStreetViewUrl: string | null;
  initialActivityLatitude: CoordinateValue;
  initialActivityLongitude: CoordinateValue;
  initialMeetingLocationSameAsActivity: boolean;
  initialActivityLocationVisibility: LocationVisibility;
  contextCountry?: string | null;
  contextCity?: string | null;
  contextDistrict?: string | null;
  planStatus: "forming" | "planned" | "completed" | "cancelled";
};

function isHttpUrl(value: string) {
  if (!value.trim()) return true;

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The location details could not be saved.";
}

function toInitialCoordinate(value: CoordinateValue) {
  return value === null || value === undefined ? "" : String(value);
}

function createLocationState({
  name,
  addressText,
  mapUrl,
  streetViewUrl,
  latitude,
  longitude,
}: {
  name: string | null;
  addressText: string | null;
  mapUrl: string | null;
  streetViewUrl: string | null;
  latitude: CoordinateValue;
  longitude: CoordinateValue;
}): LocationFormState {
  return {
    name: name ?? "",
    addressText: addressText ?? "",
    mapUrl: mapUrl ?? "",
    streetViewUrl: streetViewUrl ?? "",
    latitude: toInitialCoordinate(latitude),
    longitude: toInitialCoordinate(longitude),
  };
}

function parseCoordinate(value: string) {
  return value.trim() ? Number(value) : null;
}

function hasCoordinatePair(location: LocationFormState) {
  return Boolean(location.latitude.trim() && location.longitude.trim());
}

function buildTextLocationQueries(location: LocationFormState, contextLabel = "") {
  const name = location.name.trim();
  const address = location.addressText.trim();
  const context = contextLabel.trim();
  return Array.from(
    new Set(
      [
        [name, address, context].filter(Boolean).join(", "),
        [name, context].filter(Boolean).join(", "),
        [address, context].filter(Boolean).join(", "),
        [name, address].filter(Boolean).join(", "),
        name,
        address,
        context,
      ].filter(Boolean)
    )
  );
}

async function resolveCoordinatesForSave(location: LocationFormState, contextLabel = "") {
  if (hasCoordinatePair(location) && coordinatesAreValid(location)) return location;

  for (const query of buildTextLocationQueries(location, contextLabel)) {
    try {
      const response = await fetch(`/api/maps/geocode?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) continue;

      const payload = (await response.json()) as {
        latitude?: unknown;
        longitude?: unknown;
      };
      const latitude = Number(payload.latitude);
      const longitude = Number(payload.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

      return {
        ...location,
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
      };
    } catch {
      // Saving the human-readable location must not fail just because the
      // geocoder is temporarily unavailable. Weather has the same server-side
      // fallback and can resolve it later.
    }
  }

  return location;
}

function coordinatesAreValid(location: LocationFormState) {
  const hasLatitude = Boolean(location.latitude.trim());
  const hasLongitude = Boolean(location.longitude.trim());

  if (hasLatitude !== hasLongitude) return false;
  if (!hasLatitude) return true;

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function locationIsValid(location: LocationFormState) {
  return (
    location.name.length <= 500 &&
    location.addressText.length <= 1000 &&
    isHttpUrl(location.mapUrl) &&
    isHttpUrl(location.streetViewUrl) &&
    coordinatesAreValid(location)
  );
}

function buildLocationQuery(location: LocationFormState) {
  if (location.latitude.trim() && location.longitude.trim()) {
    return `${location.latitude.trim()},${location.longitude.trim()}`;
  }

  return [location.name.trim(), location.addressText.trim()]
    .filter(Boolean)
    .join(", ");
}

function buildMapsSearchUrl(location: LocationFormState) {
  const query = buildLocationQuery(location);
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

function MapPreview({ location, fallbackLabel }: { location: LocationFormState; fallbackLabel: string }) {
  const query = buildLocationQuery(location);
  const embedUrl = query
    ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
      {embedUrl ? (
        <iframe
          title={`${fallbackLabel} map preview`}
          src={embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-52 w-full border-0"
        />
      ) : (
        <div className="flex h-52 items-center justify-center px-6 text-center text-sm text-gray-500">
          Type a place name to preview it on the map.
        </div>
      )}
    </div>
  );
}

function CompactLocationEditor({
  accent,
  icon,
  title,
  helper,
  location,
  disabled,
  onChange,
}: {
  accent: "violet" | "green";
  icon: string;
  title: string;
  helper: string;
  location: LocationFormState;
  disabled: boolean;
  onChange: (next: LocationFormState) => void;
}) {
  const accentClasses =
    accent === "violet"
      ? "border-violet-100 bg-violet-50/35 text-violet-700 focus:border-violet-500 focus:ring-violet-100"
      : "border-emerald-100 bg-emerald-50/35 text-emerald-700 focus:border-emerald-500 focus:ring-emerald-100";

  function updateField(field: keyof LocationFormState, value: string) {
    if (field === "name" || field === "addressText") {
      // Location text changed, so any previously resolved coordinates may now
      // point at the old place. Force a fresh automatic geocode on save.
      onChange({ ...location, [field]: value, latitude: "", longitude: "" });
      return;
    }
    onChange({ ...location, [field]: value });
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accentClasses}`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-950">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">{helper}</p>
        </div>
      </div>

      <input
        type="text"
        value={location.name}
        disabled={disabled}
        maxLength={500}
        onChange={(event: ChangeEvent<HTMLInputElement>) => updateField("name", event.target.value)}
        placeholder={title === "Meeting point" ? "Üsküdar Square, station exit..." : "Tüpraş Stadium, Ülker Sports Arena..."}
        className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
      />

      <div className="mt-3">
        <MapPreview location={location} fallbackLabel={title} />
      </div>

      <details className="mt-3 rounded-xl border border-gray-200 bg-gray-50/70">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-700">
          Address, links and precise pin
          <span className="float-right text-gray-400">⌄</span>
        </summary>

        <div className="space-y-3 border-t border-gray-200 p-4">
          <textarea
            value={location.addressText}
            disabled={disabled}
            maxLength={1000}
            rows={2}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateField("addressText", event.target.value)}
            placeholder="Entrance, gate, floor, station exit or arrival instructions"
            className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="url"
              value={location.mapUrl}
              disabled={disabled}
              onChange={(event) => updateField("mapUrl", event.target.value)}
              placeholder="Google Maps URL, optional"
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100"
            />
            <input
              type="url"
              value={location.streetViewUrl}
              disabled={disabled}
              onChange={(event) => updateField("streetViewUrl", event.target.value)}
              placeholder="Street View URL, optional"
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min="-90"
              max="90"
              step="0.000001"
              value={location.latitude}
              disabled={disabled}
              onChange={(event) => updateField("latitude", event.target.value)}
              placeholder="Latitude"
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100"
            />
            <input
              type="number"
              min="-180"
              max="180"
              step="0.000001"
              value={location.longitude}
              disabled={disabled}
              onChange={(event) => updateField("longitude", event.target.value)}
              placeholder="Longitude"
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100"
            />
          </div>
        </div>
      </details>
    </article>
  );
}

export default function PlanPresentationSettingsForm({
  planId,
  initialCoverUrl,
  initialMeetingPoint,
  initialMeetingAddressText,
  initialMeetingMapUrl,
  initialMeetingStreetViewUrl,
  initialMeetingLatitude,
  initialMeetingLongitude,
  initialActivityLocationName,
  initialActivityAddressText,
  initialActivityMapUrl,
  initialActivityStreetViewUrl,
  initialActivityLatitude,
  initialActivityLongitude,
  initialMeetingLocationSameAsActivity,
  initialActivityLocationVisibility,
  contextCountry = null,
  contextCity = null,
  contextDistrict = null,
  planStatus,
}: PlanPresentationSettingsFormProps) {
  const router = useRouter();
  const locationContextLabel = [contextDistrict, contextCity, contextCountry].filter(Boolean).join(", ");
  const [meetingLocation, setMeetingLocation] = useState(() =>
    createLocationState({
      name: initialMeetingPoint,
      addressText: initialMeetingAddressText,
      mapUrl: initialMeetingMapUrl,
      streetViewUrl: initialMeetingStreetViewUrl,
      latitude: initialMeetingLatitude,
      longitude: initialMeetingLongitude,
    })
  );
  const [activityLocation, setActivityLocation] = useState(() =>
    createLocationState({
      name: initialActivityLocationName,
      addressText: initialActivityAddressText,
      mapUrl: initialActivityMapUrl,
      streetViewUrl: initialActivityStreetViewUrl,
      latitude: initialActivityLatitude,
      longitude: initialActivityLongitude,
    })
  );
  const [meetingLocationSameAsActivity, setMeetingLocationSameAsActivity] = useState(
    initialMeetingLocationSameAsActivity
  );
  const [activityLocationVisibility, setActivityLocationVisibility] = useState<LocationVisibility>(
    initialActivityLocationVisibility
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isReadOnly = planStatus === "completed" || planStatus === "cancelled";
  const effectiveMeetingLocation = meetingLocationSameAsActivity
    ? activityLocation
    : meetingLocation;

  const canSave = useMemo(
    () =>
      !isReadOnly &&
      !isSaving &&
      locationIsValid(activityLocation) &&
      locationIsValid(effectiveMeetingLocation),
    [activityLocation, effectiveMeetingLocation, isReadOnly, isSaving]
  );

  async function handleSave() {
    if (!canSave) return;

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const resolvedActivityLocation = await resolveCoordinatesForSave(activityLocation, locationContextLabel);
      const resolvedMeetingLocation = meetingLocationSameAsActivity
        ? resolvedActivityLocation
        : await resolveCoordinatesForSave(meetingLocation, locationContextLabel);

      const generatedMeetingMapUrl =
        resolvedMeetingLocation.mapUrl.trim() || buildMapsSearchUrl(resolvedMeetingLocation);
      const generatedActivityMapUrl =
        resolvedActivityLocation.mapUrl.trim() || buildMapsSearchUrl(resolvedActivityLocation);

      const { error } = await supabase.rpc(
        "update_plan_presentation_and_locations",
        {
          p_plan_id: planId,
          p_cover_url: initialCoverUrl,
          p_meeting_point: resolvedMeetingLocation.name.trim() || null,
          p_meeting_address_text: resolvedMeetingLocation.addressText.trim() || null,
          p_meeting_map_url: generatedMeetingMapUrl,
          p_meeting_street_view_url: resolvedMeetingLocation.streetViewUrl.trim() || null,
          p_meeting_latitude: parseCoordinate(resolvedMeetingLocation.latitude),
          p_meeting_longitude: parseCoordinate(resolvedMeetingLocation.longitude),
          p_activity_location_name: resolvedActivityLocation.name.trim() || null,
          p_activity_address_text: resolvedActivityLocation.addressText.trim() || null,
          p_activity_map_url: generatedActivityMapUrl,
          p_activity_street_view_url: resolvedActivityLocation.streetViewUrl.trim() || null,
          p_activity_latitude: parseCoordinate(resolvedActivityLocation.latitude),
          p_activity_longitude: parseCoordinate(resolvedActivityLocation.longitude),
          p_meeting_location_same_as_activity: meetingLocationSameAsActivity,
          p_activity_location_visibility: activityLocationVisibility,
        }
      );

      if (error) throw error;

      setActivityLocation({
        ...resolvedActivityLocation,
        mapUrl: resolvedActivityLocation.mapUrl.trim() || generatedActivityMapUrl || "",
      });
      if (!meetingLocationSameAsActivity) {
        setMeetingLocation({
          ...resolvedMeetingLocation,
          mapUrl: resolvedMeetingLocation.mapUrl.trim() || generatedMeetingMapUrl || "",
        });
      }

      setSuccessMessage("Locations saved.");
      router.refresh();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section id="locations" className="scroll-mt-24 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Locations
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-950">
            Meet here, do the Activity there
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Type a place name and the map preview updates automatically.
          </p>
        </div>

        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "Saving..." : "Save locations"}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CompactLocationEditor
          accent="violet"
          icon="●"
          title="Meeting point"
          helper="Where the group gathers first. Visible only to active Plan members."
          location={effectiveMeetingLocation}
          disabled={isReadOnly || isSaving || meetingLocationSameAsActivity}
          onChange={(next) => {
            setMeetingLocation(next);
            setErrorMessage("");
            setSuccessMessage("");
          }}
        />

        <CompactLocationEditor
          accent="green"
          icon="●"
          title="Activity location"
          helper="Where the Activity actually happens."
          location={activityLocation}
          disabled={isReadOnly || isSaving}
          onChange={(next) => {
            setActivityLocation(next);
            setErrorMessage("");
            setSuccessMessage("");
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
          <input
            type="checkbox"
            checked={meetingLocationSameAsActivity}
            disabled={isReadOnly || isSaving}
            onChange={(event) => {
              setMeetingLocationSameAsActivity(event.target.checked);
              setErrorMessage("");
              setSuccessMessage("");
            }}
            className="mt-1 h-4 w-4 rounded border-cyan-300 text-cyan-600"
          />
          <span>
            <span className="block text-sm font-semibold text-gray-900">
              Meeting point is the same as the Activity location
            </span>
            <span className="mt-1 block text-xs leading-5 text-gray-500">
              Participants go directly to the venue.
            </span>
          </span>
        </label>

        <label className="flex flex-col justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:flex-row sm:items-center">
          <span>
            <span className="block text-sm font-semibold text-gray-900">
              Public venue disclosure
            </span>
            <span className="mt-1 block text-xs leading-5 text-gray-500">
              Public screens can show the venue name, never the exact directions.
            </span>
          </span>
          <select
            value={activityLocationVisibility}
            disabled={isReadOnly || isSaving}
            onChange={(event) => setActivityLocationVisibility(event.target.value as LocationVisibility)}
            className="rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-indigo-500"
          >
            <option value="members">Members only</option>
            <option value="public">Show venue name publicly</option>
          </select>
        </label>
      </div>

      {errorMessage && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          {successMessage}
        </p>
      )}
    </section>
  );
}
