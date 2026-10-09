import Link from "next/link";

import AppNavigation from "@/components/navigation/AppNavigation";

export default function CommonIntentUnavailable({
  retryHref,
  backHref = "/ideas",
}: {
  retryHref: string;
  backHref?: string;
}) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6">
      <div className="relative z-50 mx-auto mb-8 max-w-[1320px]">
        <AppNavigation />
      </div>
      <section role="alert" className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl font-black text-red-700">
          !
        </div>
        <h1 className="mt-6 text-2xl font-black text-gray-950">
          Kart ayrıntıları yüklenemedi
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Kişileri, etkinlikleri veya deneyimleri eksik göstermemek için içerik geçici olarak gizlendi.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={retryHref} className="rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-800">
            Yeniden dene
          </Link>
          <Link href={backHref} className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Kütüphaneye dön
          </Link>
        </div>
      </section>
    </main>
  );
}
