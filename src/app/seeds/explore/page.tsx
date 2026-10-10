import type { Metadata } from "next";
import Link from "next/link";

import AddIdeaWeb from "@/components/ideas/AddIdeaWeb";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Yeni Konu Ekle | UIN",
  description: "Doğrulanmış kaynaklarda konu ara ve UIN Konulara ekle.",
};

type SeedType = { id: string; name: string; slug: string; icon: string };

function isSeedType(value: unknown): value is SeedType {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.slug === "string" &&
    typeof row.icon === "string";
}

export default async function SeedExplorePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const rawQuery = params.q;
  const initialQuery = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery || "").trim();
  const rawAction = params.action;
  const initialAction = (Array.isArray(rawAction) ? rawAction[0] : rawAction || "").trim();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_active_seed_types");
  const payloadValid = Array.isArray(data) && data.every(isSeedType);
  const readFailed = Boolean(error || !payloadValid);

  if (readFailed) {
    console.error("Seed explore Type query failed:", error ?? "Unexpected payload");
  }

  return <main className="min-h-screen bg-[#f7f8f4] px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex justify-end">
        <Link href="/ideas" className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-800 shadow-sm">← UIN Kartlarına dön</Link>
      </div>
      {readFailed
        ? <div role="alert" className="rounded-3xl bg-red-50 p-5 font-bold text-red-700">Konu bilgileri yüklenemedi. Lütfen yeniden dene.</div>
        : <AddIdeaWeb seedTypes={data} initialQuery={initialQuery} initialAction={initialAction} />}
    </div>
  </main>;
}
