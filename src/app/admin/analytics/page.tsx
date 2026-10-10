import Link from "next/link";
import { requireAdmin } from "@/utils/admin";
import {
  firstAdminReadError,
  getAdminArrayReadError,
} from "../_lib/read-state";

export const dynamic = "force-dynamic";

type SummaryRow = {
  event_name: string;
  event_count: number | string;
  unique_users: number | string;
  latest_at: string | null;
};

type DailyRow = {
  event_day: string;
  event_name: string;
  event_count: number | string;
  unique_users: number | string;
};

const labels: Record<string, { title: string; description: string }> = {
  common_card_viewed: { title: "Ortak kart görüntülendi", description: "Giriş yapmış kullanıcıların günlük tekil kart görüntülemeleri" },
  intent_created: { title: "Niyet oluşturuldu", description: "Bir ortak kart için ilk kişisel niyet" },
  collaboration_requested: { title: "Birlikte yapma önerildi", description: "Başarıyla gönderilen işbirliği önerileri" },
  social_plan_created: { title: "Sosyal plan oluşturuldu", description: "Ortak karta bağlı yeni etkinlikler" },
  social_plan_completed: { title: "Sosyal plan tamamlandı", description: "Tamamlama akışından geçen planlar" },
  experience_created: { title: "Deneyim oluşturuldu", description: "Tamamlandı durumuna geçen kişisel deneyimler" },
};

function number(value: number | string) {
  return new Intl.NumberFormat("tr-TR").format(Number(value || 0));
}

function dateTime(value: string | null) {
  if (!value) return "Henüz olay yok";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(value));
}

export default async function ProductAnalyticsPage() {
  const { supabase } = await requireAdmin();
  const [summaryResult, dailyResult] = await Promise.all([
    supabase.rpc("get_product_analytics_summary_v81", { p_days: 30 }),
    supabase.rpc("get_product_analytics_daily_v81", { p_days: 30 }),
  ]);
  const summary = (summaryResult.data ?? []) as SummaryRow[];
  const daily = (dailyResult.data ?? []) as DailyRow[];
  const error = firstAdminReadError(
    getAdminArrayReadError(
      summaryResult.data,
      summaryResult.error,
      "Analytics summary",
      ["event_name", "event_count", "unique_users", "latest_at"],
      ["event_count", "unique_users"]
    ),
    getAdminArrayReadError(
      dailyResult.data,
      dailyResult.error,
      "Daily analytics",
      ["event_day", "event_name", "event_count", "unique_users"],
      ["event_count", "unique_users"]
    )
  );

  return <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/admin" className="text-sm font-bold text-gray-600">← Yönetim paneline dön</Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">ÜRÜN ANALYTICS</p><h1 className="mt-2 text-3xl font-black">Çekirdek ürün döngüsü</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">Son 30 gün. Mesaj, not, arama, IP ve cihaz bilgisi kaydedilmez. Kart görüntülemeleri kullanıcı ve kart başına günde bir kez sayılır.</p></div>
        <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-600 shadow-sm">Europe/Istanbul</span>
      </div>
      {error && <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">Analytics verileri yüklenemedi: {error.message}</p>}
      {!error && <><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{summary.map(row => {
        const copy = labels[row.event_name] || { title: row.event_name, description: "Ürün olayı" };
        return <article key={row.event_name} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">{copy.title}</p><div className="mt-4 flex items-end justify-between gap-4"><p className="text-4xl font-black">{number(row.event_count)}</p><p className="text-right text-sm font-bold text-gray-500">{number(row.unique_users)} kullanıcı</p></div><p className="mt-3 text-sm text-gray-600">{copy.description}</p><p className="mt-4 text-xs text-gray-400">Son olay: {dateTime(row.latest_at)}</p></article>;
      })}</section>
      <section className="mt-8 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"><div className="border-b p-5 md:p-6"><h2 className="text-xl font-black">Günlük hareket</h2><p className="mt-1 text-sm text-gray-500">Yalnızca olay oluşan günler gösterilir.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Gün</th><th className="px-5 py-3">Olay</th><th className="px-5 py-3">Adet</th><th className="px-5 py-3">Kullanıcı</th></tr></thead><tbody className="divide-y">{daily.length ? daily.map(row => <tr key={`${row.event_day}:${row.event_name}`}><td className="whitespace-nowrap px-5 py-3 font-bold">{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(new Date(`${row.event_day}T12:00:00+03:00`))}</td><td className="px-5 py-3">{labels[row.event_name]?.title || row.event_name}</td><td className="px-5 py-3 font-black">{number(row.event_count)}</td><td className="px-5 py-3">{number(row.unique_users)}</td></tr>) : <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-500">Henüz analytics olayı yok.</td></tr>}</tbody></table></div></section></>}
    </div>
  </main>;
}
