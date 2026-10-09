"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page render failed:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <section role="alert" className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl font-black text-red-700">
          !
        </div>
        <h1 className="mt-6 text-2xl font-black text-gray-950">
          Sayfa şu anda yüklenemedi
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Eksik bilgi göstermemek için içerik geçici olarak gizlendi. Bağlantını kontrol edip yeniden deneyebilirsin.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-800">
            Yeniden dene
          </button>
          <Link href="/ideas" className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Kütüphaneye dön
          </Link>
        </div>
      </section>
    </main>
  );
}
