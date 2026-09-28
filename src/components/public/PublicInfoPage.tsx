import Link from "next/link";

export default function PublicInfoPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-[#f5f7f5] px-5 py-8 text-[#101411] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" aria-label="UIN ana sayfa" className="rounded-2xl bg-[#07100b] px-3 py-2 shadow-sm">
            <img src="/uin-logo-outline.png" alt="UIN" className="h-9 w-auto" />
          </Link>
          <nav className="flex gap-4 text-sm font-semibold text-gray-600">
            <Link href="/about" className="hover:text-black">Hakkında</Link>
            <Link href="/privacy" className="hover:text-black">Gizlilik</Link>
            <Link href="/terms" className="hover:text-black">Koşullar</Link>
          </nav>
        </header>

        <article className="mt-8 rounded-[28px] border border-black/5 bg-white p-6 shadow-sm sm:mt-12 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">{title}</h1>
          <p className="mt-5 text-lg leading-8 text-gray-600">{intro}</p>
          <div className="mt-10 space-y-9 text-[15px] leading-7 text-gray-700">{children}</div>
        </article>

        <footer className="flex flex-col gap-2 px-2 py-8 text-xs text-gray-500 sm:flex-row sm:justify-between">
          <span>UIN · Are you in?</span>
          <a href="mailto:berkalp@hazircevap.tr" className="hover:text-black">berkalp@hazircevap.tr</a>
        </footer>
      </div>
    </main>
  );
}

export function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-black tracking-tight text-gray-950">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
