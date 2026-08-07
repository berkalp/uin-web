type PlaceDetails = {
  country_name?: string | null;
  region_name?: string | null;
  city_name?: string | null;
  address_text?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  map_url?: string | null;
  external_place_id?: string | null;
};

type SeedSubjectMetadataPanelProps = {
  seedTypeSlug: string;
  itemKind: string;
  title: string;
  metadata?: Record<string, unknown> | null;
  place?: PlaceDetails | null;
};

function stringValue(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function InfoPill({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function SeedSubjectMetadataPanel({
  seedTypeSlug,
  itemKind,
  title,
  metadata = {},
  place = null,
}: SeedSubjectMetadataPanelProps) {
  const safeMetadata = metadata ?? {};
  const description = stringValue(safeMetadata, "description");
  const referenceUrl = stringValue(safeMetadata, "reference_url");
  const isPlace = seedTypeSlug === "visit" || itemKind === "place";

  if (isPlace) {
    const query = place?.latitude != null && place?.longitude != null
      ? `${place.latitude},${place.longitude}`
      : [title, place?.address_text, place?.city_name, place?.region_name, place?.country_name]
          .filter(Boolean)
          .filter((value, index, values) => values.indexOf(value) === index)
          .join(", ");
    const embedUrl = query
      ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
      : null;
    const mapsUrl = place?.map_url || (query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : "");

    return (
      <section className="mt-6 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Visit context</p>
            <h2 className="mt-1 text-xl font-black text-gray-950">Place</h2>
            {description && <p className="mt-3 text-sm leading-6 text-gray-600">{description}</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoPill label="Country" value={place?.country_name ?? ""} />
              <InfoPill label="Region" value={place?.region_name ?? ""} />
              <InfoPill label="City / locality" value={place?.city_name ?? ""} />
              <InfoPill label="Address / context" value={place?.address_text ?? ""} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">Open in Maps ↗</a>
              )}
              {referenceUrl && (
                <a href={referenceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-700 hover:border-gray-950">Reference ↗</a>
              )}
            </div>
          </div>
          <div className="min-h-72 bg-gray-100">
            {embedUrl ? (
              <iframe title={`${title} map`} src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-full min-h-72 w-full border-0" />
            ) : (
              <div className="flex min-h-72 items-center justify-center px-6 text-center text-sm text-gray-500">Map details have not been curated yet.</div>
            )}
          </div>
        </div>
      </section>
    );
  }

  const info: Array<[string, string]> = [];
  if (seedTypeSlug === "read") {
    info.push(["ISBN / work ID", stringValue(safeMetadata, "isbn")]);
    info.push(["Publisher", stringValue(safeMetadata, "publisher")]);
  } else if (seedTypeSlug === "watch") {
    info.push(["Director", stringValue(safeMetadata, "director")]);
    info.push(["Runtime", stringValue(safeMetadata, "runtime_minutes") ? `${stringValue(safeMetadata, "runtime_minutes")} min` : ""]);
    info.push(["Platform", stringValue(safeMetadata, "platform")]);
  } else if (seedTypeSlug === "listen") {
    info.push(["Artist / host", stringValue(safeMetadata, "artist")]);
    info.push(["Format", stringValue(safeMetadata, "audio_format")]);
    info.push(["Platform", stringValue(safeMetadata, "platform")]);
  } else if (seedTypeSlug === "play") {
    info.push(["Developer", stringValue(safeMetadata, "developer")]);
    info.push(["Publisher", stringValue(safeMetadata, "publisher")]);
    info.push(["Platforms", stringValue(safeMetadata, "platforms")]);
  } else if (seedTypeSlug === "learn") {
    info.push(["Provider", stringValue(safeMetadata, "provider")]);
    info.push(["Level", stringValue(safeMetadata, "level")]);
  } else if (seedTypeSlug === "try") {
    info.push(["Context", stringValue(safeMetadata, "context")]);
  }

  const hasInfo = description || referenceUrl || info.some(([, value]) => value);
  if (!hasInfo) return null;

  return (
    <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Subject details</p>
      {description && <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700">{description}</p>}
      {info.some(([, value]) => value) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {info.map(([label, value]) => <InfoPill key={label} label={label} value={value} />)}
        </div>
      )}
      {referenceUrl && (
        <a href={referenceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-700 hover:border-gray-950">Open reference ↗</a>
      )}
    </section>
  );
}
