"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { setSeedStatus } from "@/services/seedService";

export default function SeedReopenButton({
  seedId,
}: {
  seedId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function reopen() {
    const confirmed = window.confirm(
      "Bu Tohumu yeniden aktif yapmak istiyor musun? Tamamlanma tarihi kaldırılır. Daha önce yazdığın notlar ve deneyim kayıtları silinmez."
    );

    if (!confirmed) return;

    setBusy(true);
    setErrorMessage(null);

    try {
      await setSeedStatus(seedId, "active");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Tohum yeniden aktif yapılamadı."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={reopen}
        className="inline-flex h-9 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Geri alınıyor…" : "↶ Tamamlandı işaretini geri al"}
      </button>
      {errorMessage && (
        <span className="max-w-xs text-right text-[10px] font-semibold text-red-600">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
