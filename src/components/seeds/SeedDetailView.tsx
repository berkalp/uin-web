import Link from "next/link";

import SeedCompletionDialog from "@/components/seeds/SeedCompletionDialog";
import SeedExperienceEditor from "@/components/seeds/SeedExperienceEditor";
import SeedJournalComposer from "@/components/seeds/SeedJournalComposer";
import SeedJournalEntryActions from "@/components/seeds/SeedJournalEntryActions";
import SeedReactionBar from "@/components/seeds/SeedReactionBar";
import ReminderSettingsPanel from "@/components/reminders/ReminderSettingsPanel";
import {
  getSeedCompletionLabel,
  getSeedStatusLabel,
  getSeedVisibilityLabel,
  type SeedDetailData,
  type SeedJournalAttachment,
  type SeedLink,
  type SeedReactionContext,
} from "@/utils/seeds";

type SeedDetailViewProps = {
  detail: SeedDetailData;
  reactionContext: SeedReactionContext | null;
  isAuthenticated: boolean;
};

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
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
  reactionContext,
  isAuthenticated,
}: SeedDetailViewProps) {
  const { seed, links, journal, intents } = detail;
  const completionLabel = getSeedCompletionLabel(seed);
  const ownerName =
    seed.owner_full_name || seed.owner_username || "UIN member";
  const reflection =
    journal.find((entry) => entry.entry_kind === "reflection") ?? null;
  const updates = journal.filter((entry) => entry.entry_kind === "update");
  const reflectionLinks =
    reflection?.attachments.filter((item) => item.kind === "link") ?? [];
  const statusLabel = getSeedStatusLabel(seed.status);
  const isPrivateSeed = seed.seed_scope === "private";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={seed.is_owner ? "/seeds" : seed.owner_username ? `/u/${encodeURIComponent(seed.owner_username)}` : "/discover"}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
          >
            ← {seed.is_owner ? "My Seeds" : "Back to profile"}
          </Link>

          {seed.is_owner && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/seeds/${encodeURIComponent(seed.seed_id)}/edit`}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
              >
                Edit Seed
              </Link>
              {seed.status !== "archived" && (
                <Link
                  href={`/onboarding?seed=${encodeURIComponent(seed.seed_id)}`}
                  className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-700"
                >
                  Grow into Intent
                </Link>
              )}
            </div>
          )}
        </div>

        <section className="mt-5 overflow-hidden rounded-[34px] border border-gray-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[minmax(0,1.45fr)_360px]">
            <div className="relative min-h-[390px] overflow-hidden bg-gradient-to-br from-green-950 via-emerald-800 to-lime-700">
              {seed.cover_url && (
                <img
                  src={seed.cover_url}
                  alt={`${seed.title} cover`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/35" />

              <div className="absolute left-5 top-5 flex flex-wrap gap-2 md:left-7 md:top-7">
                <span className="rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white backdrop-blur">
                  {seed.seed_type_icon} {seed.seed_type_name}
                </span>
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                    seed.status === "completed"
                      ? "bg-purple-100 text-purple-800"
                      : seed.status === "archived"
                        ? "bg-gray-200 text-gray-700"
                        : "bg-green-100 text-green-800"
                  }`}
                >
                  {statusLabel}
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-200">
                  {seed.origin === "retrospective"
                    ? "Past Experience"
                    : "Planted Seed"}
                </p>
                <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight md:text-6xl">
                  {seed.title}
                </h1>
                {seed.subtitle && (
                  <p className="mt-3 text-lg font-semibold text-white/80">
                    {seed.subtitle}
                  </p>
                )}
              </div>
            </div>

            <aside className="flex flex-col border-t border-gray-200 p-6 lg:border-l lg:border-t-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                {seed.origin === "retrospective" ? "Added by" : "Planted by"}
              </p>
              <div className="mt-4 flex items-center gap-3">
                {seed.owner_avatar_url ? (
                  <img
                    src={seed.owner_avatar_url}
                    alt={ownerName}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 font-black text-green-800">
                    {ownerName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  {seed.owner_username ? (
                    <Link
                      href={`/u/${encodeURIComponent(seed.owner_username)}`}
                      className="block truncate font-bold text-gray-950 hover:text-green-700"
                    >
                      {ownerName}
                    </Link>
                  ) : (
                    <p className="truncate font-bold text-gray-950">
                      {ownerName}
                    </p>
                  )}
                  {seed.owner_username && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      @{seed.owner_username}
                    </p>
                  )}
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-gray-50 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Status
                  </dt>
                  <dd className="mt-1 font-black text-gray-950">
                    {statusLabel}
                  </dd>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Visibility
                  </dt>
                  <dd className="mt-1 font-black text-gray-950">
                    {isPrivateSeed ? "🔒 Only you" : getSeedVisibilityLabel(seed.visibility)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    {seed.origin === "retrospective" ? "Added" : "Planted"}
                  </dt>
                  <dd className="mt-1 font-black text-gray-950">
                    {formatDate(seed.created_at)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    {seed.status === "completed" ? "Completed" : "Target"}
                  </dt>
                  <dd className="mt-1 font-black text-gray-950">
                    {seed.status === "completed"
                      ? completionLabel || "Not set"
                      : formatDate(seed.target_date) || "Not set"}
                  </dd>
                </div>
              </dl>

              {isPrivateSeed ? (
                <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-black text-gray-950">🔒 Private Seed</p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">Only you can see this Seed. It has no public reactions or profile presence.</p>
                </div>
              ) : (
                <div className="mt-6">
                  <SeedReactionBar
                    seedId={seed.seed_id}
                    initialContext={reactionContext}
                    isAuthenticated={isAuthenticated}
                    isOwner={seed.is_owner}
                    variant="detail"
                  />
                </div>
              )}

              {seed.is_owner && seed.status === "active" && (
                <div className="mt-5">
                  <ReminderSettingsPanel
                    resourceType="seed"
                    resourceId={seed.seed_id}
                    title={seed.title}
                    hasTarget={Boolean(seed.target_date)}
                    targetLabel={seed.target_date ? `Target · ${formatDate(seed.target_date)}` : "No target date yet."}
                  />
                </div>
              )}

              {seed.is_owner && seed.status === "active" && (
                <div className="mt-5">
                  <SeedCompletionDialog
                    seedId={seed.seed_id}
                    seedTitle={seed.title}
                    defaultVisibility={seed.visibility}
                    buttonClassName="w-full rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-bold text-purple-800 transition hover:bg-purple-100"
                  />
                </div>
              )}

            </aside>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 space-y-6">
            {seed.notes && (
              <section className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">
                  Why this Seed was planted
                </p>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                  {seed.notes}
                </p>
              </section>
            )}

            {(links.length > 0 || reflection?.attachments.length) && (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                  Resources and media
                </p>
                <h2 className="mt-2 text-2xl font-black text-gray-950">
                  What belongs to this Seed
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
                      {seed.is_owner ? "My Experience" : "Experience"}
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-purple-950">
                      {reflection ? "What this Seed left behind" : "Add the experience behind the completion"}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-purple-950/65">
                      {seed.is_owner
                        ? "The Journal is for progress updates. Experience is your completed reflection and can appear on this Subject’s shared Experiences page when its visibility allows it."
                        : "This is the completed reflection shared from this Seed."}
                    </p>
                  </div>
                  {seed.is_owner && (
                    <SeedExperienceEditor
                      seedId={seed.seed_id}
                      seedTitle={seed.title}
                      existingExperience={reflection}
                      defaultVisibility={reflection?.visibility ?? seed.visibility}
                      occurredOn={seed.completed_at}
                      buttonLabel={reflection ? "Edit my experience" : "+ Add my experience"}
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
                      You completed this Seed, but you have not written an Experience yet.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-purple-950/65">
                      Add one when you want to record what it meant, what you learned, or what someone considering the same Seed should know.
                    </p>
                  </div>
                )}
              </section>
            )}

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">
                    Seed Journal
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-gray-950">
                    Notes from the growing process
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
                  No visible journal updates yet.
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
                Growth
              </p>
              <h2 className="mt-2 text-xl font-black text-gray-950">
                Intents grown from this Seed
              </h2>

              {intents.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {intents.map((intent) => (
                    <Link
                      key={intent.intent_id}
                      href={`/activities/${encodeURIComponent(intent.intent_id)}`}
                      className="block rounded-2xl border border-violet-100 bg-violet-50/60 p-4 transition hover:border-violet-300"
                    >
                      <p className="text-sm font-bold text-violet-950">
                        {intent.activity_name || "Social Intent"}
                      </p>
                      <p className="mt-1 text-xs capitalize text-violet-700">
                        {intent.status} · {intent.relationship.replaceAll("_", " ")}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-500">
                  This Seed has not grown into a visible social Intent yet.
                </p>
              )}

              {seed.is_owner && seed.status !== "archived" && (
                <Link
                  href={`/onboarding?seed=${encodeURIComponent(seed.seed_id)}`}
                  className="mt-4 flex justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700"
                >
                  Grow into Intent
                </Link>
              )}
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                Seed boundary
              </p>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                {isPrivateSeed
                  ? "This Seed is your private thinking space. It can grow into an Intent or later be connected to a moderated Library subject without becoming public by accident."
                  : "Library Seeds can be shared by your chosen visibility. Watering is a social signal of support, while joining begins only when a Seed grows into an Intent."}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
