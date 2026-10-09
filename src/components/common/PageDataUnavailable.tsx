import Link from "next/link";

type PageDataUnavailableProps = {
  title: string;
  retryHref: string;
  backHref?: string;
  backLabel?: string;
  description?: string;
};

export default function PageDataUnavailable({
  title,
  retryHref,
  backHref,
  backLabel = "Geri dön",
  description =
    "Eksik veya yanlış bilgi göstermemek için sayfa içeriğini geçici olarak gizledik. Biraz sonra yeniden deneyebilirsin.",
}: PageDataUnavailableProps) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <section
        role="alert"
        className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl font-black text-red-700">
          !
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-red-700">
          Yükleme sorunu
        </p>
        <h1 className="mt-2 text-2xl font-black text-gray-950">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-gray-600">{description}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={retryHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-800"
          >
            Yeniden dene
          </a>
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
            >
              {backLabel}
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
