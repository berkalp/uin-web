import Link from "next/link";

import SeedCompletionDialog from "@/components/seeds/SeedCompletionDialog";
import SeedExperienceEditor from "@/components/seeds/SeedExperienceEditor";
import SeedJournalComposer from "@/components/seeds/SeedJournalComposer";
import SeedJournalEntryActions from "@/components/seeds/SeedJournalEntryActions";
import SeedReactionBar from "@/components/seeds/SeedReactionBar";
import SeedPublicActions from "@/components/seeds/SeedPublicActions";
import SeedLiveCountdown from "@/components/seeds/SeedLiveCountdown";
import SeedReopenButton from "@/components/seeds/SeedReopenButton";
import {
  getSeedCompletionLabel,
  getSeedStatusLabel,
  getSeedVisibilityLabel,
  isSeedPastDue,
  type SeedDetailData,
  type SeedJournalAttachment,
  type SeedLink,
  type SeedReactionContext,
} from "@/utils/seeds";

type SeedSubjectSnapshot = {
  item_kind: string;
  canonical_title: string;
  creator_name: string | null;
  release_year: number | null;
  metadata: Record<string, unknown>;
};

function subjectText(
  metadata: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }

    if (Array.isArray(value)) {
      const items = value
        .filter(
          (item): item is string =>
            typeof item === "string" && Boolean(item.trim())
        )
        .map((item) => item.trim());

      if (items.length > 0) {
        return items.join(", ");
      }
    }
  }

  return "";
}
type SeedDetailViewProps = {
  detail: SeedDetailData;
  subjectSnapshot: SeedSubjectSnapshot | null;
  reactionContext: SeedReactionContext | null;
  isAuthenticated: boolean;
  reminderTargetTime?: string | null;
  reminderTimezone?: string | null;
  editExperience?: boolean;
};

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: value.length === 10 ? "UTC" : undefined,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getVideoEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const watchId = parsed.searchParams.get("v");
      if (watchId) {
        return `https://www.youtube-nocookie.com/embed/${watchId}`;
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      const markerIndex = parts.findIndex((part) =>
        ["shorts", "embed", "live"].includes(part)
      );
      const id = markerIndex >= 0 ? parts[markerIndex + 1] : null;
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = parsed.pathname
        .split("/")
        .filter(Boolean)
        .find((part) => /^\d+$/.test(part));
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }

  return null;
}

function LinkedMedia({
  items,
}: {
  items: Array<SeedLink | SeedJournalAttachment>;
}) {
  const images = items.filter((item) => item.kind === "image");
  const videos = items.filter((item) => item.kind === "video");

  if (images.length === 0 && videos.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {images.map((item, index) => (
        <a
          key={`image-${item.url}-${index}`}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="group overflow-hidden rounded-2xl border border-gray-200 bg-gray-950"
        >
          <div className="relative aspect-video overflow-hidden">
            <img
              src={item.url}
              alt={item.label || "Seed image"}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          </div>
          {(item.label ||
            ("description" in item ? item.description : item.caption)) && (
            <div className="bg-white p-3">
              {item.label && (
                <p className="text-sm font-bold text-gray-950">{item.label}</p>
              )}
              {("description" in item ? item.description : item.caption) && (
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {"description" in item ? item.description : item.caption}
                </p>
              )}
            </div>
          )}
        </a>
      ))}

      {videos.map((item, index) => {
        const embedUrl = getVideoEmbedUrl(item.url);
        const caption =
          "description" in item ? item.description : item.caption;

        return (
          <article
            key={`video-${item.url}-${index}`}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
          >
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={item.label || "Seed video"}
                className="aspect-video w-full border-0 bg-gray-950"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex aspect-video items-center justify-center bg-gray-950 text-center text-white"
              >
                <span>
                  <span className="block text-4xl" aria-hidden="true">
                    ▶
                  </span>
                  <span className="mt-3 block text-sm font-bold">
                    Open video ↗
                  </span>
                </span>
              </a>
            )}
            {(item.label || caption) && (
              <div className="p-3">
                {item.label && (
                  <p className="text-sm font-bold text-gray-950">
                    {item.label}
                  </p>
                )}
                {caption && (
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {caption}
                  </p>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ResourceLinks({ items }: { items: SeedLink[] }) {
  const resources = items.filter((item) => item.kind === "resource");

  if (resources.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {resources.map((item) => (
        <a
          key={item.id || item.url}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <p className="text-sm font-bold text-blue-900">
            {item.label || "Open resource"} ↗
          </p>
          {item.description && (
            <p className="mt-2 text-xs leading-5 text-blue-800/75">
              {item.description}
            </p>
          )}
          <p className="mt-2 truncate text-[11px] text-blue-500">
            {item.url}
          </p>
        </a>
      ))}
    </div>
  );
}

export default function SeedDetailView({
  detail,
  subjectSnapshot,
  reactionContext,
  isAuthenticated,
  reminderTargetTime,
  reminderTimezone,
  editExperience = false,
}: SeedDetailViewProps) {
  const { seed, links, journal, intents } = detail;
  const completionLabel = getSeedCompletionLabel(seed);
  const ownerName =
    seed.owner_full_name || seed.owner_username || "UIN üyesi";
  const reflection =
    journal.find((entry) => entry.entry_kind === "reflection") ?? null;
  const updates = journal.filter((entry) => entry.entry_kind === "update");
  const reflectionLinks =
    reflection?.attachments.filter((item) => item.kind === "link") ?? [];
  const pastDue = isSeedPastDue(seed);
  const statusLabel = getSeedStatusLabel(seed.status, pastDue);
  const isPrivateSeed = seed.seed_scope === "private";

  const subjectMetadata = subjectSnapshot?.metadata ?? {};

  const subjectDescription = subjectText(
    subjectMetadata,
    "description",
    "overview",
    "summary",
    "wikipedia_summary"
  );

  const subjectGenres = subjectText(
    subjectMetadata,
    "genres",
    "genre"
  );

  const subjectDirectors = subjectText(
    subjectMetadata,
    "directors",
    "director"
  ) || subjectSnapshot?.creator_name || "";

  const subjectCreators = subjectText(
    subjectMetadata,
    "creators",
    "creator"
  );

  const subjectRuntime = subjectText(
    subjectMetadata,
    "runtime_minutes",
    "episode_runtime_minutes"
  );

  const subjectRelease = subjectText(
    subjectMetadata,
    "release_date",
    "first_air_date",
    "release_year"
  ) || (
    subjectSnapshot?.release_year
      ? String(subjectSnapshot.release_year)
      : ""
  );

  const wikipediaUrl = subjectText(
    subjectMetadata,
    "wikipedia_url",
    "summary_source_url"
  );

  const referenceUrl = subjectText(
    subjectMetadata,
    "imdb_url",
    "attribution_url",
    "reference_url",
    "source_url"
  );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={seed.is_owner ? "/seeds" : seed.owner_username ? `/u/${encodeURIComponent(seed.owner_username)}` : "/discover"}
            className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-black text-gray-700 transition hover:border-green-400 hover:text-green-700"
          >
            ← {seed.is_owner ? (seed.status === "completed" ? "Deneyimlerim" : "Niyetlerim") : "Profile dön"}
          </Link>

          {seed.is_owner && (
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={seed.status === "completed" ? `/seeds/${encodeURIComponent(seed.seed_id)}?editExperience=1` : `/seeds/${encodeURIComponent(seed.seed_id)}/edit`}
                className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-black text-gray-700 hover:border-green-400 hover:text-green-700"
              >
                ✎ {seed.status === "completed" ? "Deneyimi düzenle" : "Niyeti düzenle"}
              </Link>
              {seed.status === "completed" &&
                seed.origin !== "retrospective" && (
                  <SeedReopenButton seedId={seed.seed_id} />
                )}

            </div>
          )}
        </div>

        <section className="mt-4 overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">
          <div className="grid gap-0 md:grid-cols-[minmax(0,420px)_1fr]">
            <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-green-950 via-emerald-800 to-lime-700">
              {seed.cover_url && (
                <img src={seed.cover_url} alt={`${seed.title} cover`} className="absolute inset-0 h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/25" />
              <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
                <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur">
                  {seed.seed_type_icon} {seed.seed_type_name}
                </span>
                <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
                  pastDue ? "bg-amber-100 text-amber-800" : seed.status === "completed" ? "bg-purple-100 text-purple-800" : seed.status === "archived" ? "bg-gray-200 text-gray-700" : "bg-green-100 text-green-800"
                }`}>
                  {statusLabel}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-200">
                  {seed.origin === "retrospective" ? "Geçmiş deneyim" : "Kişisel niyet"}
                </p>
                <h1 className="mt-2 text-3xl font-black leading-tight">{seed.title}</h1>
                {seed.subtitle && <p className="mt-1.5 text-sm font-semibold text-white/75">{seed.subtitle}</p>}
              </div>
            </div>

            <aside className="flex min-w-0 flex-col p-5 md:p-6">
              <div className="flex items-center gap-3">
                {seed.owner_avatar_url ? (
                  <img src={seed.owner_avatar_url} alt={ownerName} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 font-black text-green-800">{ownerName.charAt(0).toUpperCase()}</div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-gray-950">{ownerName}</p>
                  {seed.owner_username && <p className="truncate text-[11px] text-gray-500">@{seed.owner_username}</p>}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 xl:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Durum</p><p className="mt-1 text-xs font-black text-gray-950">{statusLabel}</p></div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Görünürlük</p><p className="mt-1 text-xs font-black text-gray-950">{isPrivateSeed ? "🔒 Yalnızca sen" : getSeedVisibilityLabel(seed.visibility)}</p></div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Ekildi</p><p className="mt-1 text-xs font-black text-gray-950">{formatDate(seed.created_at)}</p></div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Güncellendi</p><p className="mt-1 text-xs font-black text-gray-950">{formatDate(seed.updated_at)}</p></div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-gray-400">{seed.status === "completed" ? "Tamamlandı" : "Hedef"}</p><p className="mt-1 text-xs font-black text-gray-950">{seed.status === "completed" ? completionLabel || "Belirlenmedi" : formatDate(seed.target_date) || "Belirlenmedi"}</p></div>
              </div>

              {seed.is_owner && seed.status === "active" && seed.target_date && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                  {pastDue ? (
                    <span className="text-xs font-black text-amber-800">Süresi geçti</span>
                  ) : (
                    <SeedLiveCountdown targetDate={seed.target_date} targetTime={reminderTargetTime} timezone={reminderTimezone} />
                  )}
                  <span className="text-[10px] font-semibold text-amber-800">
                    {pastDue
                      ? "Hedef tarihini güncellersen kişisel niyet yeniden aktif olur."
                      : "Hatırlatıcıları Düzenle ekranından yönetebilirsin."}
                  </span>
                </div>
              )}

              {!isPrivateSeed && (
                <div className="mt-auto pt-4">
                  <SeedReactionBar
                    seedId={seed.seed_id}
                    initialContext={reactionContext}
                    isAuthenticated={isAuthenticated}
                    isOwner={seed.is_owner}
                    seedTypeName={seed.seed_type_name}
                    seedTypeSlug={seed.seed_type_slug}
                    variant="detail"
                  />
                  {!seed.is_owner && isAuthenticated && (
                    <SeedPublicActions seedId={seed.seed_id} title={seed.title} catalogItemId={seed.catalog_item_id} />
                  )}
                  {seed.is_owner && (
                    <section className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <h3 className="text-sm font-black text-gray-950">
                        Bu konu sende nasıl yer alsın?
                      </h3>

                      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                        <Link
                          href={`/seeds/explore?mode=experience&q=${encodeURIComponent(seed.title)}`}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-center text-xs font-black text-gray-800 hover:border-green-400"
                        >
                          ✓ Deneyim ekle
                        </Link>

                        {seed.catalog_item_id ? (
                          <Link
                            href={`/seeds/explore?mode=favorite&catalog=${encodeURIComponent(seed.catalog_item_id)}`}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-center text-xs font-black text-gray-800 hover:border-rose-300"
                          >
                            ♡ Sevdiklerime ekle
                          </Link>
                        ) : (
                          <span className="rounded-xl border border-gray-200 bg-gray-100 px-3 py-3 text-center text-xs font-bold text-gray-400">
                            Katalog dışı kayıt
                          </span>
                        )}

                        <Link
                          href={`/seeds/explore?mode=intent&q=${encodeURIComponent(seed.title)}`}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-center text-xs font-black text-gray-800 hover:border-green-400"
                        >
                          🌿 Kişisel niyet
                        </Link>

                        <Link
                          href={`/onboarding?seed=${encodeURIComponent(seed.seed_id)}`}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-center text-xs font-black text-gray-800 hover:border-violet-400"
                        >
                          ♧ Sosyal niyet
                        </Link>
                      </div>
                    </section>
                  )}
                </div>
              )}
            </aside>
          </div>
        </section>

        {subjectSnapshot && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-green-700">
              KONU BİLGİLERİ
            </p>

            {subjectDescription && (
              <>
                <h2 className="mt-3 text-xl font-black text-gray-950">
                  Hakkında
                </h2>

                <p className="mt-3 max-w-4xl text-sm leading-7 text-gray-600">
                  {subjectDescription}
                </p>
              </>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Tür", subjectSnapshot.item_kind],
                ["Yayın", subjectRelease],
                ["Türler", subjectGenres],
                ["Yönetmen", subjectDirectors],
                ["Yaratıcı", subjectCreators],
                [
                  "Süre",
                  subjectRuntime
                    ? `${subjectRuntime} dk`
                    : "",
                ],
              ]
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl bg-gray-50 p-4"
                  >
                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                      {label}
                    </p>

                    <p className="mt-1 text-sm font-bold text-gray-950">
                      {value}
                    </p>
                  </div>
                ))}
            </div>

            {(wikipediaUrl || referenceUrl) && (
              <div className="mt-5 flex flex-wrap gap-2">
                {wikipediaUrl && (
                  <a
                    href={wikipediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-800 transition hover:border-gray-400"
                  >
                    Wikipedia ↗
                  </a>
                )}

                {referenceUrl &&
                  referenceUrl !== wikipediaUrl && (
                    <a
                      href={referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                    >
                      Kaynakta aç ↗
                    </a>
                  )}
              </div>
            )}
          </section>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 space-y-6">
            {seed.notes && (
              <section className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">
                  Deneyim notu
                </p>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                  {seed.notes}
                </p>
              </section>
            )}

            {(links.length > 0 || reflection?.attachments.length) && (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                  Kaynaklar ve medya
                </p>
                <h2 className="mt-2 text-2xl font-black text-gray-950">
                  Bu konuyla ilgili bağlantılar
                </h2>
                <ResourceLinks items={links} />
                <LinkedMedia items={links} />
              </section>
            )}

            {seed.status === "completed" && (seed.is_owner || reflection) && (
              <section className="rounded-3xl border border-purple-200 bg-purple-50/60 p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">
                      {seed.is_owner ? "DENEYİMİN" : "DENEYİM"}
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-purple-950">
                      {reflection ? "Deneyim notun" : "Deneyimini tamamla"}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-purple-950/65">
                      {seed.is_owner ? "Tarih, puan, görsel ve notunu mobildekiyle aynı biçimde düzenleyebilirsin." : "Bu kullanıcı tarafından paylaşılan deneyim."}
                    </p>
                  </div>
                  {seed.is_owner && (
                    <SeedExperienceEditor
                      seedId={seed.seed_id}
                      seedTitle={seed.title}
                      existingExperience={reflection}
                      defaultVisibility={reflection?.visibility ?? seed.visibility}
                      occurredOn={seed.completed_at}
                      buttonLabel={reflection ? "Deneyimi düzenle" : "+ Deneyim notu ekle"}
                      autoOpen={editExperience}
                      completedDatePrecision={seed.completed_date_precision}
                      completedYear={seed.completed_year}
                      personalCoverUrl={seed.cover_url}
                      buttonClassName="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-purple-700"
                    />
                  )}
                </div>

                {reflection ? (
                  <>
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-purple-700">
                        {completionLabel || formatDate(reflection.occurred_on)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-gray-600">
                        {getSeedVisibilityLabel(reflection.visibility)}
                      </span>
                    </div>

                    {reflection.key_takeaway && (
                      <blockquote className="mt-5 rounded-2xl border border-purple-200 bg-white p-5 text-lg font-bold leading-8 text-purple-950">
                        “{reflection.key_takeaway}”
                      </blockquote>
                    )}

                    {reflection.body && (
                      <p className="mt-5 whitespace-pre-wrap text-sm leading-8 text-purple-950/80">
                        {reflection.body}
                      </p>
                    )}

                    {reflectionLinks.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {reflectionLinks.map((item) => (
                          <a
                            key={item.url}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50"
                          >
                            {item.label || "Open result"} ↗
                          </a>
                        ))}
                      </div>
                    )}

                    <LinkedMedia items={reflection.attachments} />
                    {seed.is_owner && (
                      <div className="mt-4 flex justify-end">
                        <SeedJournalEntryActions entryId={reflection.id} />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-purple-300 bg-white/80 p-6">
                    <p className="font-black text-purple-950">
                      Bu deneyim için henüz not yazmadın.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-purple-950/65">
                      İstersen ne yaşadığını ve bu konu hakkındaki düşünceni paylaş.
                    </p>
                  </div>
                )}
              </section>
            )}

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">
                    DENEYİM GÜNLÜĞÜ
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-gray-950">
                    Günlük notların
                  </h2>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600">
                  {updates.length} update{updates.length === 1 ? "" : "s"}
                </span>
              </div>

              {seed.is_owner && seed.status !== "archived" && (
                <div className="mt-5">
                  <SeedJournalComposer
                    seedId={seed.seed_id}
                    defaultVisibility={seed.visibility}
                  />
                </div>
              )}

              {updates.length > 0 ? (
                <div className="mt-6 space-y-4">
                  {updates.map((entry) => {
                    const linkedResources = entry.attachments.filter(
                      (item) => item.kind === "link"
                    );

                    return (
                      <article
                        key={entry.id}
                        className="rounded-3xl border border-gray-200 bg-gray-50/60 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                              {formatDate(entry.occurred_on)}
                            </p>
                            <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-gray-500">
                              {getSeedVisibilityLabel(entry.visibility)}
                            </span>
                          </div>
                          {seed.is_owner && (
                            <SeedJournalEntryActions entryId={entry.id} />
                          )}
                        </div>

                        {entry.body && (
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                            {entry.body}
                          </p>
                        )}

                        {linkedResources.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {linkedResources.map((item) => (
                              <a
                                key={item.url}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                              >
                                {item.label || "Open link"} ↗
                              </a>
                            ))}
                          </div>
                        )}

                        <LinkedMedia items={entry.attachments} />
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-7 text-center text-sm text-gray-500">
                  Henüz görünür günlük notu yok.
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
                SOSYAL NİYETLER
              </p>
              <div className="mt-2 flex items-start justify-between gap-3">
                <h2 className="text-xl font-black text-gray-950">
                  Bu konudan doğan Sosyal Niyetler
                </h2>

                {seed.is_owner && seed.status !== "archived" && (
                  <Link
                    href={`/onboarding?seed=${encodeURIComponent(seed.seed_id)}`}
                    className="shrink-0 rounded-xl bg-green-600 px-3 py-2 text-xs font-black text-white transition hover:bg-green-700"
                  >
                    Sosyal Niyet oluştur
                  </Link>
                )}
              </div>

              {intents.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {intents.map((intent) => (
                    <Link
                      key={intent.intent_id}
                      href={`/activities/${encodeURIComponent(intent.intent_id)}`}
                      className="block rounded-2xl border border-violet-100 bg-violet-50/60 p-4 transition hover:border-violet-300"
                    >
                      <p className="text-sm font-bold text-violet-950">
                        {intent.activity_name || "Sosyal Niyet"}
                      </p>
                      <p className="mt-1 text-xs capitalize text-violet-700">
                        {intent.status} · {intent.relationship.replaceAll("_", " ")}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-500">
                  Bu konudan henüz görünür bir Sosyal Niyet doğmadı.
                </p>
              )}


            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                GÖRÜNÜRLÜK
              </p>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                {isPrivateSeed
                  ? "Bu kayıt yalnızca sana görünür. Görünürlüğünü deneyim düzenleme alanından değiştirebilirsin."
                  : "Kişisel Niyetler seçtiğin görünürlükle paylaşılır. Öne çıkarmak sosyal bir destek işaretidir; birlikte katılım ise kayıt Sosyal Niyete dönüştüğünde başlar."}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
