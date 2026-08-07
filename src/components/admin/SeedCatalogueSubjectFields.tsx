"use client";

import { useMemo, useState } from "react";

type SeedTypeOption = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string | null;
};

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

type SeedCatalogueSubjectFieldsProps = {
  mode: "create" | "edit";
  seedTypes: SeedTypeOption[];
  initialSeedTypeId?: string;
  initialSeedTypeSlug?: string;
  initialItemKind?: string;
  initialTitle?: string;
  initialCreatorName?: string | null;
  initialOriginalTitle?: string | null;
  initialReleaseYear?: number | null;
  initialCoverUrl?: string | null;
  initialLanguageCode?: string | null;
  initialMetadata?: Record<string, unknown> | null;
  initialPlace?: PlaceDetails | null;
  aliasesDefaultValue?: string;
  compact?: boolean;
};

const KIND_BY_TYPE: Record<string, string[]> = {
  read: ["book", "generic"],
  watch: ["movie", "series", "generic"],
  listen: ["album", "podcast", "generic"],
  visit: ["place"],
  try: ["restaurant", "recipe", "challenge", "generic"],
  learn: ["course", "skill", "generic"],
  play: ["game", "generic"],
  make: ["challenge", "generic"],
  explore: ["generic", "place"],
  practice: ["skill", "challenge", "generic"],
};

const DEFAULT_KIND_BY_TYPE: Record<string, string> = {
  read: "book",
  watch: "movie",
  listen: "album",
  visit: "place",
  try: "generic",
  learn: "skill",
  play: "game",
  make: "generic",
  explore: "generic",
  practice: "skill",
};

function stringMeta(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function creatorLabel(seedTypeSlug: string): string {
  switch (seedTypeSlug) {
    case "read":
      return "Author";
    case "watch":
      return "Director / creator";
    case "listen":
      return "Artist / creator";
    case "play":
      return "Developer / studio";
    case "learn":
      return "Provider / teacher";
    case "try":
      return "Source / venue";
    default:
      return "Creator / context";
  }
}

function originalTitleLabel(seedTypeSlug: string): string {
  if (seedTypeSlug === "read" || seedTypeSlug === "watch") return "Original title";
  return "Alternate / original name";
}

function buildPlaceQuery(args: {
  title: string;
  country: string;
  region: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
}): string {
  if (args.latitude.trim() && args.longitude.trim()) {
    return `${args.latitude.trim()},${args.longitude.trim()}`;
  }

  return [args.title, args.address, args.city, args.region, args.country]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(", ");
}

function inputClass(compact: boolean) {
  return `${compact ? "mt-1.5 rounded-xl px-3 py-2.5 text-sm" : "mt-2 rounded-2xl px-4 py-3"} w-full border border-gray-300 bg-white outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100`;
}

function labelClass() {
  return "text-xs font-black uppercase tracking-wide text-gray-500";
}

export default function SeedCatalogueSubjectFields({
  mode,
  seedTypes,
  initialSeedTypeId = "",
  initialSeedTypeSlug = "",
  initialItemKind = "generic",
  initialTitle = "",
  initialCreatorName = "",
  initialOriginalTitle = "",
  initialReleaseYear = null,
  initialCoverUrl = "",
  initialLanguageCode = "",
  initialMetadata = {},
  initialPlace = null,
  aliasesDefaultValue = "",
  compact = false,
}: SeedCatalogueSubjectFieldsProps) {
  const metadata = initialMetadata ?? {};
  const firstType = seedTypes.find((type) => type.id === initialSeedTypeId);
  const [seedTypeId, setSeedTypeId] = useState(initialSeedTypeId || firstType?.id || "");
  const [seedTypeSlug, setSeedTypeSlug] = useState(
    initialSeedTypeSlug || firstType?.slug || ""
  );
  const [itemKind, setItemKind] = useState(initialItemKind || "generic");
  const [title, setTitle] = useState(initialTitle);
  const [country, setCountry] = useState(initialPlace?.country_name ?? "");
  const [region, setRegion] = useState(initialPlace?.region_name ?? "");
  const [city, setCity] = useState(initialPlace?.city_name ?? "");
  const [address, setAddress] = useState(initialPlace?.address_text ?? "");
  const [latitude, setLatitude] = useState(
    initialPlace?.latitude === null || initialPlace?.latitude === undefined
      ? ""
      : String(initialPlace.latitude)
  );
  const [longitude, setLongitude] = useState(
    initialPlace?.longitude === null || initialPlace?.longitude === undefined
      ? ""
      : String(initialPlace.longitude)
  );

  const availableKinds = KIND_BY_TYPE[seedTypeSlug] ?? ["generic"];
  const isPlace = seedTypeSlug === "visit" || itemKind === "place";
  const mapQuery = buildPlaceQuery({
    title,
    country,
    region,
    city,
    address,
    latitude,
    longitude,
  });
  const mapEmbedUrl = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`
    : null;
  const mapsSearchUrl = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : null;

  const helper = useMemo(() => {
    const type = seedTypes.find((option) => option.id === seedTypeId);
    return type?.description ?? null;
  }, [seedTypeId, seedTypes]);

  function onSeedTypeChange(nextId: string) {
    const next = seedTypes.find((option) => option.id === nextId);
    const nextSlug = next?.slug ?? "";
    setSeedTypeId(nextId);
    setSeedTypeSlug(nextSlug);
    setItemKind(DEFAULT_KIND_BY_TYPE[nextSlug] ?? "generic");
  }

  const baseGap = compact ? "gap-3" : "gap-4";

  return (
    <>
      <div className={`grid ${baseGap} md:grid-cols-2`}>
        {mode === "create" ? (
          <label>
            <span className={labelClass()}>Seed Type</span>
            <select
              name="seed_type_id"
              value={seedTypeId}
              onChange={(event) => onSeedTypeChange(event.target.value)}
              required
              className={inputClass(compact)}
            >
              <option value="">Select a Seed Type</option>
              {seedTypes.map((seedType) => (
                <option key={seedType.id} value={seedType.id}>
                  {seedType.icon} {seedType.name}
                </option>
              ))}
            </select>
            {helper && <span className="mt-1.5 block text-xs leading-5 text-gray-500">{helper}</span>}
          </label>
        ) : (
          <>
            <input type="hidden" name="seed_type_id" value={seedTypeId} />
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className={labelClass()}>Seed Type</p>
              <p className="mt-1 font-black text-emerald-950">
                {seedTypes.find((type) => type.id === seedTypeId)?.icon} {seedTypes.find((type) => type.id === seedTypeId)?.name || seedTypeSlug}
              </p>
              <p className="mt-1 text-xs text-emerald-800">Shared identity. Change it only through a controlled migration.</p>
            </div>
          </>
        )}

        <label>
          <span className={labelClass()}>Subject kind</span>
          {mode === "create" ? (
            <select
              name="item_kind"
              value={itemKind}
              onChange={(event) => setItemKind(event.target.value)}
              required
              className={inputClass(compact)}
            >
              {availableKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {kind.charAt(0).toUpperCase() + kind.slice(1)}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input type="hidden" name="item_kind" value={itemKind} />
              <div className={`${inputClass(compact)} cursor-not-allowed bg-gray-50 font-bold text-gray-700`}>
                {itemKind.charAt(0).toUpperCase() + itemKind.slice(1)}
              </div>
            </>
          )}
        </label>
      </div>

      <label className="block">
        <span className={labelClass()}>{isPlace ? "Place name" : "Canonical title"}</span>
        <input
          name="canonical_title"
          required
          maxLength={240}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={isPlace ? "Eskişehir" : "Suç ve Ceza"}
          className={inputClass(compact)}
        />
      </label>

      {isPlace && mode === "edit" && (
        <>
          <input type="hidden" name="creator_name" value={initialCreatorName ?? ""} />
          <input type="hidden" name="original_title" value={initialOriginalTitle ?? ""} />
          <input type="hidden" name="release_year" value={initialReleaseYear ?? ""} />
          <input type="hidden" name="language_code" value={initialLanguageCode ?? ""} />
        </>
      )}

      {isPlace ? (
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/30">
          <div className="grid lg:grid-cols-[1fr_1.1fr]">
            <div className={compact ? "p-4" : "p-5"}>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Place identity</p>
              <h3 className="mt-1 text-lg font-black text-gray-950">Where is this Seed?</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">Visit subjects get structured place data so UIN can later support map search and nearby Seeds.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelClass()}>Country</span>
                  <input name="place_country" value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Türkiye" className={inputClass(true)} />
                </label>
                <label>
                  <span className={labelClass()}>Region / province</span>
                  <input name="place_region" value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Eskişehir" className={inputClass(true)} />
                </label>
                <label>
                  <span className={labelClass()}>City / locality</span>
                  <input name="place_city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Eskişehir" className={inputClass(true)} />
                </label>
                <label>
                  <span className={labelClass()}>External place ID</span>
                  <input name="place_external_id" defaultValue={initialPlace?.external_place_id ?? ""} placeholder="Optional provider ID" className={inputClass(true)} />
                </label>
              </div>

              <label className="mt-3 block">
                <span className={labelClass()}>Address / place description</span>
                <textarea name="place_address_text" value={address} onChange={(event) => setAddress(event.target.value)} rows={2} maxLength={1000} placeholder="Optional exact address or place description" className={`${inputClass(true)} resize-y`} />
              </label>

              <details className="mt-3 rounded-xl border border-gray-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-gray-700">Precise pin and map reference</summary>
                <div className="grid gap-3 border-t border-gray-200 p-4 sm:grid-cols-2">
                  <label>
                    <span className={labelClass()}>Latitude</span>
                    <input type="number" min="-90" max="90" step="0.000001" name="place_latitude" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="39.7767" className={inputClass(true)} />
                  </label>
                  <label>
                    <span className={labelClass()}>Longitude</span>
                    <input type="number" min="-180" max="180" step="0.000001" name="place_longitude" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="30.5206" className={inputClass(true)} />
                  </label>
                  <label className="sm:col-span-2">
                    <span className={labelClass()}>Map URL</span>
                    <input type="url" name="place_map_url" defaultValue={initialPlace?.map_url ?? ""} placeholder="https://maps.google.com/..." className={inputClass(true)} />
                  </label>
                </div>
              </details>
            </div>

            <div className="border-t border-emerald-100 bg-gray-100 lg:border-l lg:border-t-0">
              {mapEmbedUrl ? (
                <iframe
                  title={`${title || "Place"} map preview`}
                  src={mapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-72 w-full border-0 lg:h-full lg:min-h-[360px]"
                />
              ) : (
                <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-gray-500 lg:h-full lg:min-h-[360px]">Enter the place name or location fields to preview it on the map.</div>
              )}
              {mapsSearchUrl && (
                <div className="border-t border-gray-200 bg-white p-3 text-right">
                  <a href={mapsSearchUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-blue-700 hover:underline">Open in Maps ↗</a>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <div className={`grid ${baseGap} md:grid-cols-2`}>
          <label>
            <span className={labelClass()}>{creatorLabel(seedTypeSlug)}</span>
            <input name="creator_name" defaultValue={initialCreatorName ?? ""} maxLength={240} placeholder={seedTypeSlug === "read" ? "Fyodor Dostoyevski" : "Optional"} className={inputClass(compact)} />
          </label>
          <label>
            <span className={labelClass()}>{originalTitleLabel(seedTypeSlug)}</span>
            <input name="original_title" defaultValue={initialOriginalTitle ?? ""} maxLength={240} placeholder="Optional" className={inputClass(compact)} />
          </label>
          <label>
            <span className={labelClass()}>Release / reference year</span>
            <input type="number" name="release_year" min={1} max={3000} defaultValue={initialReleaseYear ?? ""} placeholder="Optional" className={inputClass(compact)} />
          </label>
          <label>
            <span className={labelClass()}>Language code</span>
            <input name="language_code" defaultValue={initialLanguageCode ?? ""} maxLength={20} placeholder="tr" className={inputClass(compact)} />
          </label>
        </div>
      )}

      <label className="block">
        <span className={labelClass()}>Shared cover image URL</span>
        <input type="url" name="cover_url" defaultValue={initialCoverUrl ?? ""} maxLength={2000} placeholder="https://..." className={inputClass(compact)} />
        <span className="mt-1.5 block text-xs leading-5 text-gray-500">This image belongs to the shared Library subject, not to one person’s Seed.</span>
      </label>

      <label className="block">
        <span className={labelClass()}>Short Library description</span>
        <textarea name="meta_description" defaultValue={stringMeta(metadata, "description")} rows={3} maxLength={1200} placeholder="What is this shared subject? Keep it factual and useful." className={`${inputClass(compact)} resize-y`} />
      </label>

      {seedTypeSlug === "read" && (
        <div className={`grid ${baseGap} md:grid-cols-2`}>
          <label><span className={labelClass()}>ISBN / work ID</span><input name="meta_isbn" defaultValue={stringMeta(metadata, "isbn")} className={inputClass(compact)} /></label>
          <label><span className={labelClass()}>Publisher / reference source</span><input name="meta_publisher" defaultValue={stringMeta(metadata, "publisher")} className={inputClass(compact)} /></label>
        </div>
      )}

      {seedTypeSlug === "watch" && (
        <div className={`grid ${baseGap} md:grid-cols-3`}>
          <label><span className={labelClass()}>Director</span><input name="meta_director" defaultValue={stringMeta(metadata, "director")} className={inputClass(compact)} /></label>
          <label><span className={labelClass()}>Runtime (minutes)</span><input type="number" min={1} max={100000} name="meta_runtime_minutes" defaultValue={stringMeta(metadata, "runtime_minutes")} className={inputClass(compact)} /></label>
          <label><span className={labelClass()}>Platform / distributor</span><input name="meta_platform" defaultValue={stringMeta(metadata, "platform")} className={inputClass(compact)} /></label>
        </div>
      )}

      {seedTypeSlug === "listen" && (
        <div className={`grid ${baseGap} md:grid-cols-3`}>
          <label><span className={labelClass()}>Artist / host</span><input name="meta_artist" defaultValue={stringMeta(metadata, "artist")} className={inputClass(compact)} /></label>
          <label><span className={labelClass()}>Format</span><input name="meta_audio_format" defaultValue={stringMeta(metadata, "audio_format")} placeholder="Album, podcast, audiobook…" className={inputClass(compact)} /></label>
          <label><span className={labelClass()}>Platform</span><input name="meta_platform" defaultValue={stringMeta(metadata, "platform")} className={inputClass(compact)} /></label>
        </div>
      )}

      {seedTypeSlug === "play" && (
        <div className={`grid ${baseGap} md:grid-cols-3`}>
          <label><span className={labelClass()}>Developer</span><input name="meta_developer" defaultValue={stringMeta(metadata, "developer")} className={inputClass(compact)} /></label>
          <label><span className={labelClass()}>Publisher</span><input name="meta_publisher" defaultValue={stringMeta(metadata, "publisher")} className={inputClass(compact)} /></label>
          <label><span className={labelClass()}>Platforms</span><input name="meta_platforms" defaultValue={stringMeta(metadata, "platforms")} placeholder="PC, PS5, Switch…" className={inputClass(compact)} /></label>
        </div>
      )}

      {seedTypeSlug === "learn" && (
        <div className={`grid ${baseGap} md:grid-cols-2`}>
          <label><span className={labelClass()}>Provider / institution</span><input name="meta_provider" defaultValue={stringMeta(metadata, "provider")} className={inputClass(compact)} /></label>
          <label><span className={labelClass()}>Level</span><input name="meta_level" defaultValue={stringMeta(metadata, "level")} placeholder="Beginner, intermediate…" className={inputClass(compact)} /></label>
        </div>
      )}

      {seedTypeSlug === "try" && (
        <label className="block"><span className={labelClass()}>Context / cuisine / experience type</span><input name="meta_context" defaultValue={stringMeta(metadata, "context")} placeholder="Optional" className={inputClass(compact)} /></label>
      )}

      <div className={`grid ${baseGap} md:grid-cols-3`}>
        <label className="md:col-span-2"><span className={labelClass()}>Reference URL</span><input type="url" name="meta_reference_url" defaultValue={stringMeta(metadata, "reference_url")} placeholder="Official page, publisher, place page…" className={inputClass(compact)} /></label>
        <label><span className={labelClass()}>External ID</span><input name="meta_external_id" defaultValue={stringMeta(metadata, "external_id")} placeholder="Optional canonical ID" className={inputClass(compact)} /></label>
      </div>

      {mode === "create" && (
        <label className="block">
          <span className={labelClass()}>Alternate names and translations</span>
          <textarea name="aliases" rows={3} defaultValue={aliasesDefaultValue} placeholder={"One per line\nAlternate spelling\nTranslated title"} className={`${inputClass(compact)} resize-y`} />
        </label>
      )}
    </>
  );
}
