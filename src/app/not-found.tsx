import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <section className="w-full max-w-xl rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">404</p>
        <h1 className="mt-3 text-3xl font-black text-gray-950">
          Bu sayfa bulunamadı
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Bağlantı değişmiş olabilir veya bu içeriği görüntüleme iznin olmayabilir.
        </p>
        <Link href="/ideas" className="mt-6 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800">
          Kütüphaneye dön
        </Link>
      </section>
    </main>
  );
}
