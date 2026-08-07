"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { deleteSeed, saveSeed } from "@/services/seedService";
import {
  SEED_LINK_KIND_OPTIONS,
  SEED_VISIBILITY_OPTIONS,
  type SeedLink,
  type SeedLinkKind,
  type SeedRecord,
  type SeedTypeOption,
  type SeedVisibility,
} from "@/utils/seeds";

type SeedCatalogueIdentity = {
  catalog_item_id: string;
  item_kind: string;
  canonical_title: string;
  creator_name: string | null;
  release_year: number | null;
  cover_url: string | null;
  catalogue_status: "active" | "pending" | "merged" | "rejected";
};

type SeedFormProps = {
  seedTypes: SeedTypeOption[];
  seed?: SeedRecord | null;
  initialSeedTypeId?: string | null;
  catalogueIdentity?: SeedCatalogueIdentity | null;
  notice?: string | null;
};

function isValidOptionalUrl(value: string) {
  if (!value.trim()) {
    return true;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function emptyLink(sortOrder: number): SeedLink {
  return {
    id: null,
    url: "",
    label: "",
    description: "",
    kind: "resource",
    sort_order: sortOrder,
  };
}

export default function SeedForm({
  seedTypes,
  seed = null,
  initialSeedTypeId = null,
  catalogueIdentity = null,
  notice = null,
}: SeedFormProps) {
  const router = useRouter();
  const isEditing = Boolean(seed);
  const isCatalogueSeed = Boolean(catalogueIdentity);

  const [seedTypeId, setSeedTypeId] = useState(
    seed?.seed_type_id ??
      initialSeedTypeId ??
      seedTypes[0]?.id ??
      ""
  );
  const [title, setTitle] = useState(seed?.title ?? "");
  const [subtitle, setSubtitle] = useState(seed?.subtitle ?? "");
  const [notes, setNotes] = useState(seed?.notes ?? "");
  const [coverUrl, setCoverUrl] = useState(seed?.cover_url ?? "");
  const [links, setLinks] = useState<SeedLink[]>(
    seed?.links?.length ? seed.links : []
  );
  const [visibility, setVisibility] = useState<SeedVisibility>(
    seed?.visibility ?? "only_me"
  );
  const [targetDate, setTargetDate] = useState(seed?.target_date ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedType = useMemo(
    () => seedTypes.find((item) => item.id === seedTypeId) ?? null,
    [seedTypeId, seedTypes]
  );
  const effectiveTitle = catalogueIdentity?.canonical_title ?? title;
  const effectiveSubtitle = catalogueIdentity?.creator_name ?? subtitle;
  const effectiveCoverUrl = catalogueIdentity?.cover_url ?? coverUrl;
  const grownIntentCount = Number(seed?.grown_intent_count ?? 0);
  const canDelete = isEditing && grownIntentCount === 0;

  const linksAreValid = links.every(
    (link) =>
      (!link.url.trim() || isValidOptionalUrl(link.url)) &&
      (link.label?.length ?? 0) <= 100 &&
      (link.description?.length ?? 0) <= 500
  );

  const canSave =
    seedTypeId.length > 0 &&
    (isCatalogueSeed ||
      (title.trim().length >= 2 && title.trim().length <= 180)) &&
    notes.length <= 4000 &&
    (isCatalogueSeed || isValidOptionalUrl(coverUrl)) &&
    linksAreValid &&
    !isSaving &&
    !isDeleting;

  function addLink(kind: SeedLinkKind = "resource") {
    if (links.length >= 20) {
      setMessage("A Seed can contain at most 20 linked items.");
      return;
    }

    setLinks((current) => [
      ...current,
      {
        ...emptyLink(current.length),
        kind,
      },
    ]);
  }

  function updateLink(index: number, patch: Partial<SeedLink>) {
    setLinks((current) =>
      current.map((link, linkIndex) =>
        linkIndex === index ? { ...link, ...patch } : link
      )
    );
  }

  function removeLink(index: number) {
    setLinks((current) =>
      current
        .filter((_, linkIndex) => linkIndex !== index)
        .map((link, linkIndex) => ({
          ...link,
          sort_order: linkIndex,
        }))
    );
  }

  async function submit() {
    if (!canSave) {
      setMessage("Check the title and URL fields before saving.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await saveSeed({
        seedId: seed?.seed_id ?? null,
        seedTypeId,
        title: effectiveTitle,
        subtitle: effectiveSubtitle,
        notes,
        coverUrl: effectiveCoverUrl,
        links,
        visibility,
        targetDate,
      });

      router.push("/seeds");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The Seed could not be saved."
      );
      setIsSaving(false);
    }
  }

  async function removeSeed() {
    if (!seed || !canDelete) {
      return;
    }

    const confirmed = window.confirm(
      `Delete “${effectiveTitle}” from your Seeds? The shared Library subject will remain.`
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setMessage(null);

    try {
      await deleteSeed(seed.seed_id);
      router.push("/seeds");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The Seed could not be deleted."
      );
      setIsDeleting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
              {isEditing ? "Edit Seed" : "Plant a Seed"}
            </p>
            <h1 className="mt-3 text-3xl font-black text-gray-950 md:text-4xl">
              Capture the possibility before it disappears
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">
              A Seed starts personally. Add context and linked resources now,
              keep a journal later, or let it grow into a social Intent.
            </p>
          </div>

          <Link
            href="/seeds"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
          >
            ← My Seeds
          </Link>
        </div>

        {notice && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
            {notice}
          </div>
        )}

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Seed Type
          </p>

          {isEditing ? (
            <div className="mt-3 flex max-w-md items-center gap-4 rounded-2xl border border-green-200 bg-green-50 p-4">
              <span className="text-3xl" aria-hidden="true">
                {selectedType?.icon ?? "🌱"}
              </span>
              <div>
                <p className="text-sm font-black text-gray-950">
                  {selectedType?.name ?? "Seed"}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-600">
                  {isCatalogueSeed
                    ? "This type belongs to the shared Library subject."
                    : "Seed Type is fixed after planting."}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {seedTypes.map((type) => {
                  const selected = type.id === seedTypeId;

                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSeedTypeId(type.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-green-500 bg-green-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/40"
                      }`}
                    >
                      <span className="text-2xl" aria-hidden="true">
                        {type.icon}
                      </span>
                      <span className="mt-3 block text-sm font-bold text-gray-950">
                        {type.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedType?.description && (
                <p className="mt-3 text-sm text-gray-500">
                  {selectedType.description}
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {isCatalogueSeed && catalogueIdentity ? (
            <section className="md:col-span-2 overflow-hidden rounded-3xl border border-gray-200 bg-gray-50">
              <div className="grid md:grid-cols-[180px_1fr]">
                <div className="relative min-h-44 overflow-hidden bg-gradient-to-br from-green-950 via-emerald-800 to-lime-700">
                  {catalogueIdentity.cover_url && (
                    <img
                      src={catalogueIdentity.cover_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/5" />
                  <span className="absolute bottom-4 left-4 rounded-full bg-black/45 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white backdrop-blur">
                    Library subject
                  </span>
                </div>

                <div className="p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-green-700">
                        Shared identity · locked
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-gray-950">
                        {catalogueIdentity.canonical_title}
                      </h2>
                      {(catalogueIdentity.creator_name || catalogueIdentity.release_year) && (
                        <p className="mt-2 text-sm font-semibold text-gray-600">
                          {[catalogueIdentity.creator_name, catalogueIdentity.release_year]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>

                    <Link
                      href={`/seeds/subjects/${encodeURIComponent(
                        catalogueIdentity.catalog_item_id
                      )}`}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:border-green-500 hover:text-green-700"
                    >
                      View in Library
                    </Link>
                  </div>

                  <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600">
                    Type, title, creator and cover are managed once in the Seed Library.
                    Your personal note, target date, links, visibility and journal remain yours.
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <>
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-gray-800">
                  What do you want to do?
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={180}
                  placeholder="Finding the Mother Tree"
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-4 text-lg font-semibold text-gray-950 outline-none transition focus:border-green-500"
                />
                <span className="mt-2 block text-xs text-gray-400">
                  {title.trim().length}/180
                </span>
              </label>

              <label>
                <span className="text-sm font-semibold text-gray-800">
                  Subtitle or creator
                </span>
                <input
                  value={subtitle}
                  onChange={(event) => setSubtitle(event.target.value)}
                  maxLength={180}
                  placeholder="Suzanne Simard"
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3.5 outline-none transition focus:border-green-500"
                />
              </label>
            </>
          )}

          <label className={isCatalogueSeed ? "md:col-span-2" : ""}>
            <span className="text-sm font-semibold text-gray-800">
              Optional target date
            </span>
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3.5 outline-none transition focus:border-green-500"
            />
          </label>

          <label className="md:col-span-2">
            <span className="text-sm font-semibold text-gray-800">
              Why did you plant this Seed?
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={4000}
              rows={5}
              placeholder="The thought, question or motivation behind this Seed."
              className="mt-2 w-full resize-y rounded-2xl border border-gray-200 px-4 py-3.5 outline-none transition focus:border-green-500"
            />
            <span className="mt-2 block text-xs text-gray-400">
              {notes.length}/4000
            </span>
          </label>

          {!isCatalogueSeed && (
            <label className="md:col-span-2">
              <span className="text-sm font-semibold text-gray-800">
                Cover image URL
              </span>
              <input
                type="url"
                value={coverUrl}
                onChange={(event) => setCoverUrl(event.target.value)}
                placeholder="https://images.example.com/cover.jpg"
                className={`mt-2 w-full rounded-2xl border px-4 py-3.5 outline-none transition focus:border-green-500 ${
                  isValidOptionalUrl(coverUrl)
                    ? "border-gray-200"
                    : "border-red-300 bg-red-50"
                }`}
              />
              <span className="mt-2 block text-xs leading-5 text-gray-400">
                External URL only. UIN does not upload or store the file.
              </span>
            </label>
          )}
        </div>

        <section className="mt-8 rounded-3xl border border-blue-100 bg-blue-50/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                Linked resources and media
              </p>
              <h2 className="mt-2 text-lg font-black text-gray-950">
                Add webpages, images or videos by URL
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                These appear inside the Seed detail page. Nothing is uploaded to UIN.
              </p>
            </div>

            <button
              type="button"
              onClick={() => addLink("resource")}
              className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-800 transition hover:bg-blue-100"
            >
              + Add link
            </button>
          </div>

          {links.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-blue-200 bg-white/70 p-6 text-center text-sm text-gray-500">
              No linked resources yet. Add a book page, article, image, video or result link.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {links.map((link, index) => (
                <article
                  key={`${link.id ?? "new"}-${index}`}
                  className="rounded-2xl border border-blue-100 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-bold text-gray-900">
                      Linked item {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeLink(index)}
                      className="text-xs font-bold text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label>
                      <span className="text-xs font-semibold text-gray-600">
                        Type
                      </span>
                      <select
                        value={link.kind}
                        onChange={(event) =>
                          updateLink(index, {
                            kind: event.target.value as SeedLinkKind,
                          })
                        }
                        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 outline-none focus:border-blue-500"
                      >
                        {SEED_LINK_KIND_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span className="text-xs font-semibold text-gray-600">
                        Label
                      </span>
                      <input
                        value={link.label ?? ""}
                        onChange={(event) =>
                          updateLink(index, { label: event.target.value })
                        }
                        maxLength={100}
                        placeholder={
                          link.kind === "image"
                            ? "Book cover"
                            : link.kind === "video"
                              ? "Author interview"
                              : "Official page"
                        }
                        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 outline-none focus:border-blue-500"
                      />
                    </label>

                    <label className="md:col-span-2">
                      <span className="text-xs font-semibold text-gray-600">
                        URL
                      </span>
                      <input
                        type="url"
                        value={link.url}
                        onChange={(event) =>
                          updateLink(index, { url: event.target.value })
                        }
                        placeholder="https://..."
                        className={`mt-2 w-full rounded-xl border px-3 py-3 outline-none focus:border-blue-500 ${
                          isValidOptionalUrl(link.url)
                            ? "border-gray-200"
                            : "border-red-300 bg-red-50"
                        }`}
                      />
                    </label>

                    <label className="md:col-span-2">
                      <span className="text-xs font-semibold text-gray-600">
                        Optional description
                      </span>
                      <input
                        value={link.description ?? ""}
                        onChange={(event) =>
                          updateLink(index, {
                            description: event.target.value,
                          })
                        }
                        maxLength={500}
                        placeholder="Why this resource belongs to the Seed"
                        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 outline-none focus:border-blue-500"
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mt-8">
          <p className="text-sm font-semibold text-gray-800">
            Who can see this Seed on your profile?
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {SEED_VISIBILITY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  visibility === option.value
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-green-300"
                }`}
              >
                <input
                  type="radio"
                  name="seed-visibility"
                  value={option.value}
                  checked={visibility === option.value}
                  onChange={() => setVisibility(option.value)}
                  className="sr-only"
                />
                <span className="block text-sm font-bold text-gray-950">
                  {option.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-gray-500">
                  {option.description}
                </span>
              </label>
            ))}
          </div>
        </div>

        {message && (
          <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {message}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="rounded-xl bg-green-600 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Saving..."
              : isEditing
                ? "Save personal details"
                : "Plant Seed"}
          </button>

          <Link
            href="/seeds"
            className="rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 transition hover:border-gray-400"
          >
            Cancel
          </Link>

          {isEditing && canDelete && (
            <button
              type="button"
              onClick={removeSeed}
              disabled={isSaving || isDeleting}
              className="ml-auto rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete my Seed"}
            </button>
          )}
        </div>

        {isEditing && !canDelete && grownIntentCount > 0 && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            This Seed has grown into an Intent, so its lineage is preserved. Archive it instead of deleting it.
          </p>
        )}
      </section>

      <aside className="h-fit xl:sticky xl:top-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
          Seed preview
        </p>

        <article className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">
          <div className="relative aspect-square bg-gradient-to-br from-green-950 via-emerald-800 to-lime-700">
            {effectiveCoverUrl && isValidOptionalUrl(effectiveCoverUrl) && (
              <img
                src={effectiveCoverUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <span className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-xs font-bold uppercase tracking-wide backdrop-blur">
                <span aria-hidden="true">{selectedType?.icon ?? "🌱"}</span>
                {selectedType?.name ?? "Seed"}
              </span>
              <h2 className="mt-3 text-2xl font-black leading-tight">
                {effectiveTitle.trim() || "Your next possibility"}
              </h2>
              {effectiveSubtitle?.trim() && (
                <p className="mt-2 text-sm font-semibold text-white/80">
                  {effectiveSubtitle.trim()}
                </p>
              )}
            </div>
          </div>

          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Planted Seed
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {links.filter((link) => link.url.trim()).length > 0
                ? `${links.filter((link) => link.url.trim()).length} linked item${
                    links.filter((link) => link.url.trim()).length === 1
                      ? ""
                      : "s"
                  } will appear on the detail page.`
                : "Add context now and let the Seed develop over time."}
            </p>
          </div>
        </article>
      </aside>
    </div>
  );
}
