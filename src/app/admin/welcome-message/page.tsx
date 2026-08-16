import Link from "next/link";

import WelcomeMessageManager, {
  type WelcomeAdminSettings,
} from "@/components/admin/WelcomeMessageManager";
import { requireAdmin } from "@/utils/admin";

export default async function AdminWelcomeMessagePage() {
  const { supabase, role, user } = await requireAdmin();

  if (role !== "owner") {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-3xl font-black text-gray-950">
              İlk Karşılama Mesajı
            </h1>
            <p className="mt-3 text-sm leading-7 text-red-700">
              Bu ayarı yalnızca UIN sahibi yönetebilir.
            </p>
            <Link
              href="/admin"
              className="mt-6 inline-flex rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700"
            >
              ← Admin
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { data, error } = await supabase.rpc(
    "get_uin_welcome_admin_settings"
  );

  const settings =
    !error && Array.isArray(data) && data.length > 0
      ? (data[0] as WelcomeAdminSettings)
      : null;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700"
          >
            ← Admin
          </Link>

          <span className="rounded-full bg-gray-950 px-4 py-2 text-xs font-black text-white">
            {user.email ?? "UIN Owner"}
          </span>
        </div>

        <header className="mt-6 rounded-[32px] border border-gray-200 bg-white p-7 shadow-sm md:p-9">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-green-700">
            ONBOARDING
          </p>
          <h1 className="mt-3 text-4xl font-black text-gray-950">
            İlk Karşılama Mesajı
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
            Onboarding&apos;i ilk kez tamamlayan kullanıcıya UIN özel mesajı olarak
            otomatik gider. Kullanıcı aynı hesabıyla yeniden giriş yaptığında tekrar gönderilmez.
          </p>
        </header>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            Karşılama mesajı ayarları yüklenemedi. Önce ilgili Supabase SQL migration&apos;ını çalıştır.
          </div>
        ) : null}

        <WelcomeMessageManager initialSettings={settings} />
      </div>
    </main>
  );
}
