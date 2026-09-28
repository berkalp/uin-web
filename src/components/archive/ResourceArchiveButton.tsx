"use client";

import {
  useRouter,
} from "next/navigation";
import {
  useState,
} from "react";

import {
  archiveResource,
  type ArchiveResourceType,
} from "@/services/resourceArchiveService";

type ResourceArchiveButtonProps = {
  resourceType: ArchiveResourceType;
  resourceId: string;
  label?: string;
  compact?: boolean;
  redirectTo?: string;
};

export default function ResourceArchiveButton({
  resourceType,
  resourceId,
  label,
  compact = false,
  redirectTo,
}: ResourceArchiveButtonProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const archiveLabel =
    label ??
    (resourceType === "intent"
      ? "Etkinliği Arşivle"
      : "Hesabımdan Arşivle");

  async function handleArchive() {
    const confirmed = window.confirm(
      resourceType === "intent"
        ? "Bu etkinlik arşivlensin mi? Niyetlerim, Etkinlikler ve herkese açık profilinden kaldırılır. Daha sonra arşivden geri yükleyebilirsin."
        : "Bu ortak etkinlik hesabından arşivlensin mi? Niyetlerim, Etkinlikler ve profilinden kaldırılır; diğer katılımcıların kayıtları korunur."
    );

    if (!confirmed) return;

    setErrorMessage("");
    setIsSaving(true);

    try {
      await archiveResource(
        resourceType,
        resourceId
      );

      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Kayıt arşivlenemedi."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={isSaving}
        onClick={handleArchive}
        className={
          compact
            ? "rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:cursor-wait disabled:opacity-50"
            : "rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:cursor-wait disabled:opacity-50"
        }
      >
        {isSaving
          ? "Arşivleniyor…"
          : archiveLabel}
      </button>

      {errorMessage && (
        <p className="mt-2 max-w-md rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
