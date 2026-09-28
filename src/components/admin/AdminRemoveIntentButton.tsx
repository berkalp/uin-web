"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function AdminRemoveIntentButton({ intentId }: { intentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm("Bu etkinlik yayından kaldırılacak ve hiçbir kullanıcı ekranında görünmeyecek. Devam edilsin mi?")) return;
    setBusy(true);
    const { error: removeError } = await supabase.rpc("admin_remove_social_intent_v48", { p_intent_id: intentId });
    if (removeError) window.alert(removeError.message || "Etkinlik kaldırılamadı.");
    else router.refresh();
    setBusy(false);
  }

  return <button type="button" disabled={busy} onClick={() => void remove()} title="Etkinliği kaldır" aria-label="Etkinliği kaldır" className="grid h-9 w-9 place-items-center rounded-full border border-red-200 bg-white/95 text-sm text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50">{busy ? "…" : "🗑️"}</button>;
}
