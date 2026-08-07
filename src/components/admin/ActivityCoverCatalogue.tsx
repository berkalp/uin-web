"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  resolveActivityCover,
} from "../../utils/activityCover";
import {
  removeActivityCoverPath,
  removeManagedActivityCoverUrl,
  uploadActivityCover,
  validateActivityCoverFile,
} from "../../utils/activityCoverUpload";
import { supabase } from "../../utils/supabase/client";

export type AdminCoverCategory = {
  id: string;
  name: string;
  default_cover_url: string | null;
};

export type AdminCoverActivity = {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  default_cover_url: string | null;
  category_cover_url: string | null;
};

type ActivityCoverCatalogueProps = {
  categories: AdminCoverCategory[];
  activities: AdminCoverActivity[];
};

type ResourceType =
  | "category"
  | "activity";

function isHttpUrl(
  value: string
) {
  if (!value.trim()) {
    return true;
  }

  try {
    const parsed =
      new URL(value.trim());

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function CoverEditor({
  resourceType,
  resourceId,
  title,
  subtitle,
  initialCoverUrl,
  fallbackCoverUrl,
}: {
  resourceType: ResourceType;
  resourceId: string;
  title: string;
  subtitle: string;
  initialCoverUrl: string | null;
  fallbackCoverUrl: string;
}) {
  const router =
    useRouter();

  const [
    coverUrl,
    setCoverUrl,
  ] = useState(
    initialCoverUrl ?? ""
  );

  const [
    savedCoverUrl,
    setSavedCoverUrl,
  ] = useState<string | null>(
    initialCoverUrl
  );

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(
    null
  );

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState<string | null>(
    null
  );

  const selectedFileError =
    selectedFile
      ? validateActivityCoverFile(
          selectedFile
        )
      : null;

  const isValid =
    isHttpUrl(coverUrl) &&
    !selectedFileError;

  const localPreviewUrl =
    useMemo(
      () =>
        selectedFile
          ? URL.createObjectURL(
              selectedFile
            )
          : null,
      [selectedFile]
    );

  useEffect(
    () => () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(
          localPreviewUrl
        );
      }
    },
    [localPreviewUrl]
  );

  const previewUrl =
    localPreviewUrl ||
    coverUrl.trim() ||
    fallbackCoverUrl;

  async function handleSave() {
    if (!isValid) {
      setMessage(
        selectedFileError ||
          "Enter a valid HTTP or HTTPS image URL."
      );
      return;
    }

    setIsSaving(true);
    setMessage(null);

    let uploadedObjectPath:
      | string
      | null = null;

    try {
      let nextCoverUrl =
        coverUrl.trim() ||
        null;

      if (selectedFile) {
        const uploadResult =
          await uploadActivityCover({
            file:
              selectedFile,
            pathPrefix: `catalog/${
              resourceType ===
              "category"
                ? "categories"
                : "activities"
            }/${resourceId}`,
          });

        uploadedObjectPath =
          uploadResult.objectPath;
        nextCoverUrl =
          uploadResult.publicUrl;
      }

      const {
        error,
      } = await supabase.rpc(
        "admin_update_activity_catalog_cover",
        {
          p_resource_type:
            resourceType,
          p_resource_id:
            resourceId,
          p_cover_url:
            nextCoverUrl,
        }
      );

      if (error) {
        throw error;
      }

      if (
        savedCoverUrl &&
        savedCoverUrl !==
          nextCoverUrl
      ) {
        try {
          await removeManagedActivityCoverUrl(
            savedCoverUrl
          );
        } catch (cleanupError) {
          console.error(
            "Previous catalogue cover cleanup failed:",
            cleanupError
          );
        }
      }

      setCoverUrl(
        nextCoverUrl ?? ""
      );
      setSavedCoverUrl(
        nextCoverUrl
      );
      setSelectedFile(null);
      setMessage("Saved.");
      router.refresh();
    } catch (error) {
      if (uploadedObjectPath) {
        try {
          await removeActivityCoverPath(
            uploadedObjectPath
          );
        } catch (rollbackError) {
          console.error(
            "Uploaded cover rollback failed:",
            rollbackError
          );
        }
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "Cover could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="relative h-44 overflow-hidden bg-gray-950">
        <img
          src={previewUrl}
          alt={`${title} cover preview`}
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />

        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-300">
            {subtitle}
          </p>

          <h3 className="mt-1 text-xl font-bold text-white">
            {title}
          </h3>
        </div>
      </div>

      <div className="p-5">
        <label className="block rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 transition hover:border-green-400 hover:bg-green-50/40">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Upload cover image
          </span>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={isSaving}
            onChange={(event) => {
              const file =
                event.target.files?.[0] ??
                null;

              setSelectedFile(file);
              setMessage(
                file
                  ? validateActivityCoverFile(
                      file
                    )
                  : null
              );
            }}
            className="mt-3 block w-full text-sm text-gray-600 file:mr-4 file:rounded-xl file:border-0 file:bg-gray-950 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <span className="mt-2 block text-xs leading-5 text-gray-500">
            JPG, PNG, WEBP or AVIF. Maximum 8 MB.
          </span>
        </label>

        {selectedFileError && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            {selectedFileError}
          </p>
        )}

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            or use an external URL
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Default cover URL
          </span>

          <input
            value={coverUrl}
            onChange={(event) =>
              setCoverUrl(
                event.target.value
              )
            }
            type="url"
            placeholder="https://images.unsplash.com/..."
            className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm text-gray-900 outline-none transition ${
              isValid
                ? "border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100"
                : "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            }`}
          />
        </label>

        <p className="mt-2 text-xs leading-5 text-gray-500">
          An uploaded image takes priority when saved. Leave both fields blank to use the next fallback in the cover hierarchy.
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p
            className={`text-xs ${
              message === "Saved."
                ? "font-semibold text-green-700"
                : "text-red-700"
            }`}
          >
            {message}
          </p>

          <button
            type="button"
            disabled={
              isSaving ||
              !isValid
            }
            onClick={handleSave}
            className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Saving..."
              : "Save cover"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function ActivityCoverCatalogue({
  categories,
  activities,
}: ActivityCoverCatalogueProps) {
  const [
    selectedCategoryId,
    setSelectedCategoryId,
  ] = useState(
    "all"
  );

  const filteredActivities =
    useMemo(
      () =>
        selectedCategoryId ===
        "all"
          ? activities
          : activities.filter(
              (activity) =>
                activity.category_id ===
                selectedCategoryId
            ),
      [
        activities,
        selectedCategoryId,
      ]
    );

  return (
    <div className="space-y-10">
      <section>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
            Category fallbacks
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Activity category covers
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            These images are used when an
            Activity Type has no specific
            cover.
          </p>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {categories.map(
            (category) => (
              <CoverEditor
                key={
                  category.id
                }
                resourceType="category"
                resourceId={
                  category.id
                }
                title={
                  category.name
                }
                subtitle="Category fallback"
                initialCoverUrl={
                  category.default_cover_url
                }
                fallbackCoverUrl={resolveActivityCover({
                  categoryName:
                    category.name,
                  activityName:
                    category.name,
                })}
              />
            )
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Activity Type defaults
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Activity covers
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Activity-specific covers
              override category covers.
            </p>
          </div>

          <label className="w-full md:max-w-xs">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Filter category
            </span>

            <select
              value={
                selectedCategoryId
              }
              onChange={(event) =>
                setSelectedCategoryId(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            >
              <option value="all">
                All categories
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={
                      category.id
                    }
                    value={
                      category.id
                    }
                  >
                    {
                      category.name
                    }
                  </option>
                )
              )}
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredActivities.map(
            (activity) => (
              <CoverEditor
                key={
                  activity.id
                }
                resourceType="activity"
                resourceId={
                  activity.id
                }
                title={
                  activity.name
                }
                subtitle={
                  activity.category_name
                }
                initialCoverUrl={
                  activity.default_cover_url
                }
                fallbackCoverUrl={resolveActivityCover({
                  activityCoverUrl:
                    activity.default_cover_url,
                  categoryCoverUrl:
                    activity.category_cover_url,
                  categoryName:
                    activity.category_name,
                  activityName:
                    activity.name,
                })}
              />
            )
          )}
        </div>
      </section>
    </div>
  );
}
