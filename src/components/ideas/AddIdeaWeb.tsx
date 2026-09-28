"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SeedType = { id: string; name: string; slug: string; icon: string };
type Kind = "artist" | "book" | "movie" | "game" | "place" | "hobby" | "activity";
type SearchItem = { provider: string; externalId: string; title: string; subtitle: string | null; creatorName: string | null; coverUrl: string | null; sourceUrl: string | null; metadata: Record<string, unknown> };
type InternalTopic = { catalogItemId: string; canonicalTargetId: string | null; title: string; subtitle: string | null; coverUrl: string | null; status: "active" | "pending"; seedTypeIcon: string | null };
type Choice = { key: string; label: string; icon: string; kind: Kind; match: RegExp; question: string; placeholder: string };

const CHOICES: Choice[] = [
  { key: "live", label: "Canlı izle", icon: "🎭", kind: "activity", match: /live|canlı/, question: "Neyi canlı izlemek istiyorsun?", placeholder: "Konser, maç, tiyatro…" },
  { key: "read", label: "Oku", icon: "📚", kind: "book", match: /read|oku/, question: "Ne okumak istiyorsun?", placeholder: "Kitap veya yazar ara" },
  { key: "watch", label: "İzle", icon: "🎬", kind: "movie", match: /watch|izle/, question: "Ne izlemek istiyorsun?", placeholder: "Film veya dizi ara" },
  { key: "listen", label: "Dinle", icon: "🎧", kind: "artist", match: /listen|dinle/, question: "Ne dinlemek istiyorsun?", placeholder: "Sanatçı veya müzik ara" },
  { key: "visit", label: "Ziyaret Et", icon: "📍", kind: "place", match: /visit|git|ziyaret/, question: "Nereyi ziyaret etmek istiyorsun?", placeholder: "Şehir, ülke, müze veya yer ara" },
  { key: "try", label: "Dene", icon: "🍽️", kind: "activity", match: /try|dene/, question: "Ne denemek istiyorsun?", placeholder: "Yemek, hobi veya deneyim ara" },
  { key: "learn", label: "Öğren", icon: "🎓", kind: "activity", match: /learn|öğren/, question: "Ne öğrenmek istiyorsun?", placeholder: "Beceri, konu, teknoloji veya dil ara" },
  { key: "play", label: "Oyna", icon: "🎮", kind: "game", match: /play|oyna/, question: "Ne oynamak istiyorsun?", placeholder: "Oyun ara" },
  { key: "do", label: "Yap", icon: "🛠️", kind: "hobby", match: /(^|[-_ ])do($|[-_ ])|yap|make|create|üret/, question: "Ne yapmak istiyorsun?", placeholder: "Aktivite, üretim veya hobi ara" },
  { key: "explore", label: "Keşfet", icon: "🧭", kind: "place", match: /explore|keşfet/, question: "Neyi keşfetmek istiyorsun?", placeholder: "Yer veya konu ara" },
  { key: "practice", label: "Pratik Yap", icon: "🎯", kind: "activity", match: /practice|pratik/, question: "Neyin pratiğini yapmak istiyorsun?", placeholder: "Beceri veya çalışma alanı ara" },
];

function meta(data: Record<string, unknown>, key: string) { const raw = data[key]; if (Array.isArray(raw)) return raw.filter((v) => typeof v === "string").join(", "); return typeof raw === "string" || typeof raw === "number" ? String(raw) : ""; }
function entityName(choice: Choice) { return ({ read: "kitap", watch: "film veya dizi", listen: "müzik", visit: "yer", play: "oyun", learn: "öğrenme konusu", live: "sahne konusu", try: "deneyim konusu", do: "aktivite", explore: "yer", practice: "beceri" } as Record<string,string>)[choice.key] || "konu"; }

export default function AddIdeaWeb({ seedTypes, initialQuery = "", initialAction = "" }: { seedTypes: SeedType[]; initialQuery?: string; initialAction?: string }) {
  const router = useRouter();
  const choices = useMemo(() => CHOICES.flatMap((choice) => { const seedType = seedTypes.find((row) => choice.match.test(`${row.slug} ${row.name}`.toLocaleLowerCase("tr-TR"))); return seedType ? [{ ...choice, seedType }] : []; }), [seedTypes]);
  const normalizedInitialAction = initialAction.toLocaleLowerCase("tr-TR");
  const initialChoice = choices.find(item => item.key === normalizedInitialAction || item.label.toLocaleLowerCase("tr-TR") === normalizedInitialAction || item.match.test(normalizedInitialAction));
  const [choiceKey, setChoiceKey] = useState(initialChoice?.key ?? choices[0]?.key ?? "");
  const [query, setQuery] = useState(initialQuery); const [internalTopics, setInternalTopics] = useState<InternalTopic[]>([]); const [results, setResults] = useState<SearchItem[]>([]); const [selected, setSelected] = useState<SearchItem | null>(null);
  const [searched, setSearched] = useState(false); const [manual, setManual] = useState(false); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const current = choices.find((item) => item.key === choiceKey) ?? choices[0];
  const currentEntityName = entityName(current);

  async function search() {
    if (!current || query.trim().length < 2) { setError("Aramak için en az 2 karakter yaz."); return; }
    setLoading(true); setError(""); setInternalTopics([]); setResults([]); setSearched(false); setManual(false);
    try {
      const localResponse = await fetch(`/api/ideas?q=${encodeURIComponent(query.trim())}&seedTypeId=${encodeURIComponent(current.seedType.id)}`, { cache: "no-store" });
      const localPayload = await localResponse.json() as { items?: InternalTopic[]; error?: string };
      if (!localResponse.ok) throw new Error(localPayload.error || "UIN konuları aranamadı.");
      const existing = localPayload.items ?? [];
      setInternalTopics(existing);
      if (existing.length === 0) {
        const response = await fetch(`/api/favorites/search?kind=${current.kind}&q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
        const payload = await response.json() as { items?: SearchItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Dış kaynak araması yapılamadı.");
        setResults(payload.items ?? []);
      }
      setSearched(true);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Arama yapılamadı."); } finally { setLoading(false); }
  }

  async function save(mode: "verified" | "manual", form?: HTMLFormElement) {
    if (!current) return; setSaving(true); setError(""); const fields = form ? new FormData(form) : null;
    try { const response = await fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mode === "verified" ? { mode, seedTypeId: current.seedType.id, kind: current.kind, item: selected } : { mode, seedTypeId: current.seedType.id, kind: current.kind, title: fields?.get("title"), description: fields?.get("description"), referenceUrl: fields?.get("referenceUrl") }) }); const payload = await response.json() as { seedId?: string; error?: string }; if (!response.ok) throw new Error(payload.error || "Konu eklenemedi."); router.push(mode === "verified" && payload.seedId ? `/seeds/${payload.seedId}` : `/ideas?${mode === "manual" ? "suggested" : "added"}=1`); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Konu eklenemedi."); } finally { setSaving(false); }
  }

  if (!current) return <div className="rounded-3xl bg-red-50 p-5 font-bold text-red-700">Konu türleri yüklenemedi.</div>;
  return <>
    <section className="rounded-[32px] border border-emerald-100 bg-white p-5 shadow-sm md:p-8">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">YENİ {currentEntityName.toLocaleUpperCase("tr-TR")}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 md:text-4xl">{currentEntityName.charAt(0).toLocaleUpperCase("tr-TR") + currentEntityName.slice(1)} ara ve ekle</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">Önce UIN kayıtlarında, ardından yalnızca bu alana uygun doğrulanmış kaynakta ara. Kapak ve temel bilgiler otomatik gelir.</p>
      <p className="mt-7 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Ne yapmak istiyorsun?</p><div className="mt-3 flex flex-wrap gap-2">{choices.map((item) => <button key={item.key} type="button" onClick={() => { setChoiceKey(item.key); setQuery(""); setInternalTopics([]); setResults([]); setSelected(null); setSearched(false); setManual(false); setError(""); }} className={`rounded-full border px-4 py-2.5 text-sm font-black ${item.key === current.key ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-white text-gray-800 hover:border-gray-400"}`}>{item.icon} {item.label}</button>)}</div>
      <h2 className="mt-8 text-2xl font-black text-gray-950">{current.question}</h2><p className="mt-1 text-sm text-gray-500">Önce UIN Konuları aranır. Yalnızca bulunamazsa doğrulanmış dış kaynaklara bakılır.</p><div className="mt-4 flex gap-2"><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} placeholder={current.placeholder} className="min-w-0 flex-1 rounded-2xl border border-gray-300 px-4 py-3.5 text-base font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /><button type="button" onClick={() => void search()} disabled={loading} className="rounded-2xl bg-emerald-600 px-7 py-3 font-black text-white disabled:opacity-50">{loading ? "Aranıyor…" : "Ara"}</button></div>
      {error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
      {internalTopics.length > 0 && <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-4"><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">UIN KATALOĞUNDA BULUNDU</p><p className="mt-1 text-sm text-emerald-900">Bu konu zaten var. Yeniden eklemek yerine mevcut konuya devam et.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{internalTopics.map((item) => <article key={item.catalogItemId} className="flex min-h-28 items-center gap-4 rounded-2xl border border-emerald-200 bg-white p-3">{item.coverUrl ? <img src={item.coverUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-emerald-50 text-3xl">{item.seedTypeIcon || current.icon}</div>}<div className="min-w-0 flex-1"><h3 className="line-clamp-2 font-black text-gray-950">{item.title}</h3>{item.subtitle&&<p className="mt-1 truncate text-sm text-gray-500">{item.subtitle}</p>}<p className="mt-1 text-xs font-bold text-emerald-700">{item.status === "pending" ? "İnceleniyor" : "UIN Konusu"}</p></div>{item.canonicalTargetId ? <Link href={`/intentions/${encodeURIComponent(item.canonicalTargetId)}`} className="shrink-0 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">Konuyu aç</Link> : <span className="shrink-0 rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-800">İnceleniyor</span>}</article>)}</div></section>}
      {results.length > 0 && <section className="mt-6"><p className="text-xs font-black uppercase tracking-[.16em] text-gray-500">UIN'DE BULUNAMADI · DOĞRULANMIŞ KAYNAK SONUÇLARI</p><div className="mt-3 grid gap-3 md:grid-cols-2">{results.map((item) => <article key={`${item.provider}:${item.externalId}`} className="flex min-h-32 items-center gap-4 rounded-3xl border border-gray-200 p-3">{item.coverUrl ? <img src={item.coverUrl} alt="" className="h-28 w-24 shrink-0 rounded-2xl object-cover" /> : <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-3xl">{current.icon}</div>}<div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-lg font-black text-gray-950">{item.title}</h3>{(item.creatorName || item.subtitle) && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{item.creatorName || item.subtitle}</p>}</div><button type="button" onClick={() => setSelected(item)} className="shrink-0 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Seç</button></article>)}</div></section>}
      {searched && internalTopics.length === 0 && results.length === 0 && !error && <div className="mt-6 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center"><p className="font-black text-gray-950">UIN'de ve doğrulanmış kaynaklarda sonuç bulunamadı.</p><p className="mt-1 text-sm text-gray-500">Yazımı değiştirerek yeniden arayabilir veya yeni konuyu yönetici onayına gönderebilirsin.</p><button type="button" onClick={() => setManual(true)} className="mt-4 rounded-2xl border border-emerald-300 bg-white px-5 py-3 text-sm font-black text-emerald-800">Onaya yeni konu gönder</button></div>}
    </section>
    {manual && <form onSubmit={(event) => { event.preventDefault(); void save("manual", event.currentTarget); }} className="mt-5 rounded-[28px] border border-amber-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">YÖNETİCİ ONAYI</p><h2 className="mt-2 text-2xl font-black">Yeni {currentEntityName} öner</h2><p className="mt-2 text-sm text-gray-500">Doğrulanmış kaynakta bulunmayan kayıt, yayına alınmadan önce kontrol edilir.</p><div className="mt-5 grid gap-3 md:grid-cols-2"><input name="title" defaultValue={query} required maxLength={240} placeholder={`${currentEntityName} adı`} className="rounded-2xl border border-gray-300 px-4 py-3" /><input name="referenceUrl" type="url" placeholder="Varsa kaynak bağlantısı" className="rounded-2xl border border-gray-300 px-4 py-3" /><textarea name="description" required maxLength={1000} placeholder="Kısaca açıkla" className="min-h-28 rounded-2xl border border-gray-300 px-4 py-3 md:col-span-2" /></div><button disabled={saving} className="mt-4 rounded-2xl bg-gray-950 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Gönderiliyor…" : "Yönetici onayına gönder"}</button></form>}
      {selected && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/55 p-4 backdrop-blur-sm"><div className="mx-auto my-6 w-full max-w-3xl overflow-hidden rounded-[32px] bg-white shadow-2xl"><div className="relative bg-gray-100">{selected.coverUrl ? <img src={selected.coverUrl} alt="" className="h-72 w-full object-contain md:h-96" /> : <div className="flex h-56 items-center justify-center text-7xl">{current.icon}</div>}<button type="button" onClick={() => setSelected(null)} className="absolute right-4 top-4 h-11 w-11 rounded-full bg-white text-xl font-black shadow">×</button></div><div className="p-6 md:p-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">{current.icon} {current.label}</p><h2 className="mt-2 text-3xl font-black text-gray-950">{selected.title}</h2>{(selected.creatorName || selected.subtitle) && <p className="mt-2 text-lg font-semibold text-gray-500">{selected.creatorName || selected.subtitle}</p>}{(meta(selected.metadata, "description") || selected.subtitle) && <section className="mt-6 rounded-3xl border border-gray-200 p-5"><h3 className="text-lg font-black">Hakkında</h3><p className="mt-2 leading-7 text-gray-700">{meta(selected.metadata, "description") || selected.subtitle}</p></section>}<dl className="mt-5 grid gap-3 rounded-3xl bg-gray-50 p-5 sm:grid-cols-2">{[["Eylem", current.label], ["Alan", meta(selected.metadata, "genres") || meta(selected.metadata, "publisher") || meta(selected.metadata, "uin_item_kind")], ["Yayın tarihi", meta(selected.metadata, "published_date") || meta(selected.metadata, "premiered")], ["Dil", meta(selected.metadata, "language")]].filter(([,v]) => v).map(([key,val]) => <div key={key}><dt className="text-xs font-black uppercase text-gray-400">{key}</dt><dd className="mt-1 font-bold text-gray-900">{val}</dd></div>)}</dl>{selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 block rounded-2xl border border-emerald-200 px-5 py-3 text-center font-black text-emerald-700">Kaynakta aç ↗</a>}<button type="button" onClick={() => void save("verified")} disabled={saving} className="mt-6 w-full rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-black text-white disabled:opacity-50">{saving ? "Ekleniyor…" : `+ ${currentEntityName.charAt(0).toLocaleUpperCase("tr-TR") + currentEntityName.slice(1)} olarak ekle`}</button></div></div></div>}
  </>;
}
