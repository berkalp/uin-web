"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import {
  removeManagedActivityCoverUrl,
  validateActivityCoverFile,
} from "@/utils/activityCoverUpload";
import {
  PLAN_PRESENTATION_VISIBILITY_OPTIONS,
  normalizePlanPresentationVisibility,
  type PlanPresentationVisibility,
} from "@/utils/planPresentationVisibility";
import { supabase } from "@/utils/supabase/client";

type PlanCoverQuickEditorProps = {
  planId: string;
  initialPreviewUrl: string | null;
  initialExternalUrl: string | null;
  initialStoragePath: string | null;
  initialVisibility?: PlanPresentationVisibility;
  disabled?: boolean;
};

const PRIVATE_COVER_BUCKET = "plan-presentation-covers";

const EXTENSION_BY_MIME_TYPE = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

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

  return "The cover image could not be updated.";
}

async function removePrivateCoverPath(path: string | null) {
  if (!path) return;

  const { error } = await supabase.storage
    .from(PRIVATE_COVER_BUCKET)
    .remove([path]);

  if (error) throw error;
}

export default function PlanCoverQuickEditor({
  planId,
  initialPreviewUrl,
  initialExternalUrl,
  initialStoragePath,
  initialVisibility = "participants",
  disabled = false,
}: PlanCoverQuickEditorProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [externalUrl, setExternalUrl] = useState(initialExternalUrl ?? "");
  const [savedExternalUrl, setSavedExternalUrl] = useState(initialExternalUrl);
  const [savedStoragePath, setSavedStoragePath] = useState(initialStoragePath);
  const [savedPreviewUrl, setSavedPreviewUrl] = useState(initialPreviewUrl);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeRequested, setRemoveRequested] = useState(false);
  const [savedVisibility, setSavedVisibility] = useState(
    normalizePlanPresentationVisibility(initialVisibility)
  );
  const [visibility, setVisibility] = useState(
    normalizePlanPresentationVisibility(initialVisibility)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) setIsOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, isSaving]);

  const selectedFileError = selectedFile
    ? validateActivityCoverFile(selectedFile)
    : null;

  const localPreviewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile]
  );

  useEffect(
    () => () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    },
    [localPreviewUrl]
  );

  const previewUrl = removeRequested
    ? null
    : localPreviewUrl ||
      (externalUrl.trim() && isHttpUrl(externalUrl)
        ? externalUrl.trim()
        : savedPreviewUrl);

  const contentChanged =
    Boolean(selectedFile) ||
    removeRequested ||
    externalUrl.trim() !== (savedExternalUrl ?? "");

  const canSave =
    !isSaving &&
    !selectedFileError &&
    isHttpUrl(externalUrl) &&
    (contentChanged || visibility !== savedVisibility);

  function resetDraft() {
    setExternalUrl(savedExternalUrl ?? "");
    setSelectedFile(null);
    setRemoveRequested(false);
    setVisibility(savedVisibility);
    setErrorMessage("");
  }

  async function saveCover() {
    if (!canSave) return;

    setIsSaving(true);
    setErrorMessage("");

    let uploadedPath: string | null = null;

    try {
      let nextExternalUrl = externalUrl.trim() || null;
      let nextStoragePath = savedStoragePath;
      let nextPreviewUrl = nextExternalUrl || savedPreviewUrl;

      if (removeRequested) {
        nextExternalUrl = null;
        nextStoragePath = null;
        nextPreviewUrl = null;
      } else if (selectedFile) {
        const extension = EXTENSION_BY_MIME_TYPE.get(selectedFile.type);
        if (!extension) throw new Error("Unsupported image type.");

        uploadedPath = `${planId}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(PRIVATE_COVER_BUCKET)
          .upload(uploadedPath, selectedFile, {
            cacheControl: "31536000",
            contentType: selectedFile.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        nextExternalUrl = null;
        nextStoragePath = uploadedPath;
        nextPreviewUrl = localPreviewUrl;
      } else if (nextExternalUrl !== savedExternalUrl) {
        nextStoragePath = null;
        nextPreviewUrl = nextExternalUrl;
      }

      const { error } = await supabase.rpc("update_plan_custom_cover", {
        p_plan_id: planId,
        p_cover_url: nextExternalUrl,
        p_storage_path: nextStoragePath,
        p_visibility: visibility,
      });

      if (error) throw error;

      if (savedStoragePath && savedStoragePath !== nextStoragePath) {
        try {
          await removePrivateCoverPath(savedStoragePath);
        } catch (cleanupError) {
          console.warn("Previous private cover cleanup failed:", cleanupError);
        }
      }

      if (savedExternalUrl && savedExternalUrl !== nextExternalUrl) {
        try {
          await removeManagedActivityCoverUrl(savedExternalUrl);
        } catch (cleanupError) {
          console.warn("Previous legacy cover cleanup failed:", cleanupError);
        }
      }

      setSavedExternalUrl(nextExternalUrl);
      setSavedStoragePath(nextStoragePath);
      setSavedPreviewUrl(nextPreviewUrl ?? null);
      setSavedVisibility(visibility);
      setExternalUrl(nextExternalUrl ?? "");
      setSelectedFile(null);
      setRemoveRequested(false);
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      if (uploadedPath) {
        try {
          await removePrivateCoverPath(uploadedPath);
        } catch (rollbackError) {
          console.warn("Uploaded private cover rollback failed:", rollbackError);
        }
      }

      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          resetDraft();
          setIsOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/90 px-3.5 py-2 text-sm font-semibold text-gray-900 shadow-sm backdrop-blur transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden="true">▣</span>
        Change cover
      </button>

      {mounted && isOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/55 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label="Change cover image"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isSaving) {
                  setIsOpen(false);
                }
              }}
            >
              <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                      Activity cover
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-gray-950">
                      Change cover image
                    </h2>
                  </div>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Cover preview"
                      className="h-48 w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
                      No custom cover selected
                    </div>
                  )}

                  <label className="block rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-4">
                    <span className="text-sm font-semibold text-gray-800">
                      Upload a new private image
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      disabled={isSaving}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        setSelectedFile(event.target.files?.[0] ?? null);
                        setExternalUrl("");
                        setRemoveRequested(false);
                        setErrorMessage("");
                      }}
                      className="mt-3 block w-full text-sm text-gray-600 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                    />
                    <span className="mt-2 block text-xs text-gray-500">
                      JPG, PNG, WebP or AVIF. Maximum 8 MB. Uploaded files use private Storage.
                    </span>
                  </label>

                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <span className="h-px flex-1 bg-gray-200" />
                    or use a URL
                    <span className="h-px flex-1 bg-gray-200" />
                  </div>

                  <input
                    type="url"
                    value={externalUrl}
                    disabled={isSaving}
                    onChange={(event) => {
                      setExternalUrl(event.target.value);
                      setSelectedFile(null);
                      setRemoveRequested(false);
                      setErrorMessage("");
                    }}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <label className="block rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      Who can see this custom cover?
                    </span>
                    <select
                      value={visibility}
                      disabled={isSaving}
                      onChange={(event) =>
                        setVisibility(
                          normalizePlanPresentationVisibility(event.target.value)
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-blue-500"
                    >
                      {PLAN_PRESENTATION_VISIBILITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-gray-500">
                      {PLAN_PRESENTATION_VISIBILITY_OPTIONS.find(
                        (option) => option.value === visibility
                      )?.helper}
                    </span>
                    {externalUrl.trim() ? (
                      <span className="mt-2 block text-xs text-amber-700">
                        External image URLs remain public on their original host; UIN only controls where the image is displayed.
                      </span>
                    ) : null}
                  </label>

                  {(savedExternalUrl || savedStoragePath) && !removeRequested ? (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        setSelectedFile(null);
                        setExternalUrl("");
                        setRemoveRequested(true);
                      }}
                      className="text-sm font-semibold text-red-600 hover:text-red-700"
                    >
                      Remove custom cover
                    </button>
                  ) : null}

                  {(selectedFileError || errorMessage) && (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                      {selectedFileError || errorMessage}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-100 p-5">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!canSave}
                    onClick={() => void saveCover()}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSaving ? "Saving..." : "Save cover"}
                  </button>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
