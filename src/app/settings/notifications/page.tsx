import Link from "next/link";
import { redirect } from "next/navigation";

import ReminderDefaultsPanel from "@/components/reminders/ReminderDefaultsPanel";
import { createClient } from "@/utils/supabase/server";

export default async function NotificationReminderSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-green-700">Bildirimler & Hatırlatıcılar</p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">Zamanı gelmeden UIN seni geri çağırsın</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-600">Activity ve Tohumlar için varsayılan kişisel hatırlatmalarını seç. Her kayıt içinde ayrıca farklılaştırabilirsin.</p>
        </div>
        <Link href="/timeline" className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700">← Niyet Yolculuğu</Link>
      </div>

      <div className="mt-8">
        <ReminderDefaultsPanel />
      </div>
    </main>
  );
}
