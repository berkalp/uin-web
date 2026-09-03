"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type Kind =
  | "artist"
  | "book"
  | "movie"
  | "series"
  | "game"
  | "place"
  | "director"
  | "actor"
  | "writer"
  | "comedian"
  | "theatre_artist"
  | "athlete"
  | "club"
  | "sport"
  | "hobby"
  | "activity";

type SearchItem = {
  provider: string;
  externalId: string;
  title: string;
  subtitle: string | null;
  creatorName: string | null;
  coverUrl: string | null;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
};

const KINDS: Array<{ id: Kind; label: string; icon: string; placeholder: string }> = [
  { id: "artist", label: "Sanatçı", icon: "🎵", placeholder: "Epica, Metallica..." },
  { id: "book", label: "Kitap", icon: "📚", placeholder: "Kitap veya yazar ara" },
  { id: "movie", label: "Film", icon: "🎬", placeholder: "Film ara" },
  { id: "series", label: "Dizi", icon: "📺", placeholder: "Dizi ara" },
  { id: "game", label: "Oyun", icon: "🎮", placeholder: "Oyun ara" },
  { id: "place", label: "Yer", icon: "📍", placeholder: "İzlanda, Roma, müze..." },
  { id: "director", label: "Yönetmen", icon: "🎥", placeholder: "Christopher Nolan..." },
  { id: "actor", label: "Oyuncu", icon: "🎭", placeholder: "Oyuncu ara" },
  { id: "writer", label: "Yazar", icon: "✍️", placeholder: "Yazar ara" },
  { id: "comedian", label: "Komedyen", icon: "🎙️", placeholder: "Komedyen ara" },
  { id: "theatre_artist", label: "Tiyatrocu", icon: "🎭", placeholder: "Tiyatro sanatçısı ara" },
  { id: "athlete", label: "Sporcu", icon: "🏅", placeholder: "Sporcu ara" },
  { id: "club", label: "Spor kulübü", icon: "⚽", placeholder: "Kulüp veya takım ara" },
  { id: "sport", label: "Spor", icon: "🏃", placeholder: "Spor dalı ara" },
  { id: "hobby", label: "Hobi", icon: "🧩", placeholder: "Hobi ara" },
  { id: "activity", label: "Aktivite", icon: "✨", placeholder: "Piknik, kamp, quiz..." },
];

export default function AddFavoriteWeb() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("artist");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  const current = useMemo(() => KINDS.find((item) => item.id === kind) ?? KINDS[0], [kind]);

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) {
      setError("Aramak için en az 2 karakter yaz.");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const response = await fetch(
        `/api/favorites/search?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(q)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as { items?: SearchItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Arama yapılamadı.");
      setResults(Array.isArray(payload.items) ? payload.items : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Arama yapılamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function add(item: SearchItem) {
    const key = `${item.provider}:${item.externalId}`;
    setWorking(key);
    setError("");

    try {
      const { error: addError } = await supabase.rpc("add_my_loved_subject_v2922", {
        p_kind: kind,
        p_title: item.title,
        p_subtitle: item.subtitle ?? item.creatorName ?? null,
        p_cover_url: item.coverUrl ?? null,
        p_provider: item.provider || "uin",
        p_external_id: item.externalId || null,
        p_source_url: item.sourceUrl ?? null,
        p_metadata: item.metadata ?? {},
      });

      if (addError) throw addError;

      router.push("/favorites");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sevdiklerine eklenemedi.");
    } finally {
      setWorking("");
    }
  }

  return (
    <>
      <header className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-9">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">SEVDİKLERİM</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 md:text-4xl">
              Sevdiğin bir şey ekle
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
              Sevdiğin kişi, eser, yer, kulüp, spor, hobi veya aktiviteyi seç. Bu bir niyet değil;
              “bunu seviyorum” katmanı.
            </p>
          </div>
          <Link
            href="/favorites"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-800 hover:border-gray-400"
          >
            ← Sevdiklerim
          </Link>
        </div>
      </header>

      <section className="mt-6 rounded-[32px] border border-gray-200 bg-white p-5 shadow-sm md:p-7">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Tür</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {KINDS.map((item) => {
            const active = item.id === kind;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setKind(item.id);
                  setResults([]);
                  setError("");
                  setQuery("");
                }}
                className={`rounded-full border px-3.5 py-2 text-sm font-black transition ${
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                {item.icon} {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-7">
          <h2 className="text-xl font-black text-gray-950">
            Hangi {current.label.toLocaleLowerCase("tr-TR")} seviyorsun?
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Sonuçlar seçtiğin türe göre aranır. Sağlayıcı adı kullanıcıya gösterilmez.
          </p>

          <div className="mt-4 flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void runSearch();
              }}
              placeholder={current.placeholder}
              className="min-w-0 flex-1 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-950 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void runSearch()}
              className="rounded-2xl bg-gray-950 px-6 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {loading ? "Aranıyor…" : "Ara"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {!loading && query.trim().length >= 2 && results.length === 0 && !error ? (
          <div className="mt-6 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-7 text-center">
            <p className="font-black text-gray-950">Bu türde sonuç bulunamadı.</p>
            <p className="mt-1 text-sm text-gray-500">Yazımı değiştirip tekrar ara.</p>
          </div>
        ) : null}

        {results.length > 0 ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {results.map((item) => {
              const key = `${item.provider}:${item.externalId}`;
              const isWorking = working === key;
              return (
                <article
                  key={key}
                  className="flex min-h-28 items-center gap-4 rounded-3xl border border-gray-200 bg-white p-3"
                >
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt=""
                      className="h-24 w-20 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-3xl">
                      {current.icon}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-base font-black text-gray-950">{item.title}</h3>
                    {item.subtitle || item.creatorName ? (
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-500">
                        {item.subtitle ?? item.creatorName}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => void add(item)}
                    title="Sevdiklerime ekle"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-600 text-xl text-white shadow-sm disabled:opacity-50"
                  >
                    {isWorking ? "…" : "♡"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </>
  );
}
