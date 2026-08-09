type CoordinateValue =
  | number
  | string
  | null;

type LocationDetails = {
  name: string | null;
  addressText: string | null;
  latitude: CoordinateValue;
  longitude: CoordinateValue;
  mapUrl: string | null;
  streetViewUrl: string | null;
};

type ActivityLocationPreviewProps = {
  city: string | null;
  district: string | null;
  meetingLocation: LocationDetails;
  activityLocation: LocationDetails;
  meetingLocationSameAsActivity: boolean;
  activityLocationVisibility:
    | "members"
    | "public";
  canViewExactLocation: boolean;
  compact?: boolean;
};

function toCoordinate(
  value: CoordinateValue
) {
  if (
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function getApproximateLabel({
  city,
  district,
}: {
  city: string | null;
  district: string | null;
}) {
  return [district, city]
    .filter(Boolean)
    .join(", ");
}

function getExactLabel(
  location: LocationDetails
) {
  return [
    location.name,
    location.addressText,
  ]
    .filter(Boolean)
    .join(" · ");
}

function LocationMapCard({
  eyebrow,
  title,
  description,
  location,
  approximateLabel,
  emptyText,
  tone,
  compact,
}: {
  eyebrow: string;
  title: string;
  description: string;
  location: LocationDetails;
  approximateLabel: string;
  emptyText: string;
  tone: "meeting" | "activity";
  compact: boolean;
}) {
  const parsedLatitude =
    toCoordinate(
      location.latitude
    );

  const parsedLongitude =
    toCoordinate(
      location.longitude
    );

  const exactLabel =
    getExactLabel(location);

  const hasCoordinates =
    parsedLatitude !== null &&
    parsedLongitude !== null;

  const mapQuery = hasCoordinates
    ? `${parsedLatitude},${parsedLongitude}`
    : exactLabel ||
      approximateLabel;

  const mapEmbedUrl = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(
        mapQuery
      )}&z=${
        hasCoordinates ? 16 : 11
      }&output=embed`
    : null;

  const generatedStreetViewUrl =
    hasCoordinates
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${parsedLatitude},${parsedLongitude}`
      : null;

  const borderClasses =
    tone === "meeting"
      ? "border-cyan-200"
      : "border-indigo-200";

  const headingClasses =
    tone === "meeting"
      ? "text-cyan-700"
      : "text-indigo-700";

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${borderClasses}`}
    >
      <div className="p-5">
        <p
          className={`text-xs font-semibold uppercase tracking-[0.16em] ${headingClasses}`}
        >
          {eyebrow}
        </p>

        <h3 className="mt-2 text-xl font-bold text-gray-950">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-6 text-gray-600">
          {description}
        </p>

        <div className="mt-4 rounded-2xl bg-gray-50 p-4">
          <p className="text-sm font-bold text-gray-950">
            {exactLabel ||
              emptyText}
          </p>

          {!exactLabel &&
            approximateLabel && (
              <p className="mt-1 text-xs text-gray-500">
                Approximate area: {approximateLabel}
              </p>
            )}
        </div>
      </div>

      {mapEmbedUrl ? (
        <div
          className={
            compact
              ? "h-64"
              : "h-80"
          }
        >
          <iframe
            title={`${title} map`}
            src={mapEmbedUrl}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : (
        <div
          className={`flex items-center justify-center bg-gray-50 p-8 text-center text-sm text-gray-500 ${
            compact
              ? "h-64"
              : "h-80"
          }`}
        >
          No location has been saved yet.
        </div>
      )}

      {(location.mapUrl ||
        location.streetViewUrl ||
        generatedStreetViewUrl) && (
        <div className="flex flex-wrap gap-3 border-t border-gray-200 p-4">
          {location.mapUrl && (
            <a
              href={location.mapUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Open in Maps
            </a>
          )}

          {(location.streetViewUrl ||
            generatedStreetViewUrl) && (
            <a
              href={
                location.streetViewUrl ||
                generatedStreetViewUrl ||
                undefined
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
            >
              Open Street View
            </a>
          )}
        </div>
      )}
    </article>
  );
}

export default function ActivityLocationPreview({
  city,
  district,
  meetingLocation,
  activityLocation,
  meetingLocationSameAsActivity,
  activityLocationVisibility,
  canViewExactLocation,
  compact = false,
}: ActivityLocationPreviewProps) {
  const approximateLabel =
    getApproximateLabel({
      city,
      district,
    });

  if (!canViewExactLocation) {
    if (!approximateLabel) {
      return null;
    }

    return (
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Approximate Location
          </p>

          <h2 className="mt-2 text-lg font-bold text-gray-950">
            Activity area
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            {approximateLabel}
          </p>

          <p className="mt-2 text-xs leading-5 text-gray-500">
            The meeting point and exact Activity location are visible only to active Plan members.
          </p>
        </div>
      </section>
    );
  }

  const resolvedMeetingLocation =
    meetingLocationSameAsActivity
      ? activityLocation
      : meetingLocation;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Locations
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Meet here, do the Activity there
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            The public Intent area stays approximate. Public screens may show the venue name only when the host allows it; exact addresses, maps and the meeting point remain private to active Plan members.
          </p>
        </div>

        <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm">
          Activity venue: {activityLocationVisibility === "public" ? "Venue name may be public" : "Private to members"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <LocationMapCard
          eyebrow="Meeting Point"
          title={
            meetingLocationSameAsActivity
              ? "Same as Activity location"
              : "Where the group meets first"
          }
          description={
            meetingLocationSameAsActivity
              ? "Participants meet directly at the Activity location."
              : "Use this for the square, station exit, café or landmark where participants gather."
          }
          location={
            resolvedMeetingLocation
          }
          approximateLabel={
            approximateLabel
          }
          emptyText="Meeting point not set"
          tone="meeting"
          compact={compact}
        />

        <LocationMapCard
          eyebrow="Activity Location"
          title="Where the Activity happens"
          description="Use this for the stadium, arena, venue, trail, workshop or final destination."
          location={
            activityLocation
          }
          approximateLabel={
            approximateLabel
          }
          emptyText="Activity location not set"
          tone="activity"
          compact={compact}
        />
      </div>
    </section>
  );
}
