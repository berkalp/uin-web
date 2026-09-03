import Link from "next/link";
import { redirect } from "next/navigation";

import SeedForm from "@/components/seeds/SeedForm";
import type { SeedTypeOption } from "@/utils/seeds";
import { createClient } from "@/utils/supabase/server";

type NewSeedPageProps = {
  searchParams: Promise<{
    mode?: string | string[];
    type?: string | string[];
  }>;
};

const CATALOGUE_BACKED_SLUGS = new Set([
  "read",
  "watch",
  "listen",
  "visit",
  "try",
  "learn",
  "play",
]);

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() || "";
  }

  return value?.trim() || "";
}

export default async function NewSeedPage({
  searchParams,
}: NewSeedPageProps) {
  const params = await searchParams;
  const mode = one(params.mode);
  const privateMode = mode === "private" || mode === "personal";
  const requestedTypeId = one(params.type);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data, error } = await supabase.rpc("get_active_seed_types");

  if (error) {
    console.error("Seed Type query failed:", error);
  }

  const seedTypes = (data ?? []) as SeedTypeOption[];
  const initialSeedTypeId = seedTypes.some(
    (seedType) => seedType.id === requestedTypeId
  )
    ? requestedTypeId
    : seedTypes[0]?.id ?? null;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-[1450px]">
        {error || seedTypes.length === 0 ? (
          <section className="rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-black text-gray-950">
              Seed Types are not available
            </h1>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              Run migrations 032, 033 and 034 before planting the first Seed.
            </p>
          </section>
        ) : privateMode ? (
          <SeedForm
            seedTypes={seedTypes}
            initialSeedTypeId={initialSeedTypeId}
            notice="Standart görünürlük: Herkese açık. İstersen aşağıdan Arkadaşlarım veya Sadece ben olarak değiştirebilirsin. Kitap, film, müzik, sanatçı ve yer için Kütüphane aramasını kullanarak doğrulanmış kaynağa bağlanabilirsin."
          />
        ) : (
          <>
            <header className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
              <div className="grid lg:grid-cols-[minmax(0,1.3fr)_380px]">
                <div className="p-6 md:p-9">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-green-700">
                    Plant a Seed
                  </p>
                  <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">
                    What kind of possibility is this?
                  </h1>
                  <p className="mt-4 max-w-3xl text-base leading-8 text-gray-600">
                    Books, films, games and other shared subjects begin in the Seed Library, so alternate spellings resolve to one subject. Private thoughts stay owner-only and do not need to be forced into a shared catalogue.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href="/seeds/explore"
                      className="rounded-xl bg-green-600 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-green-700"
                    >
                      Explore Seed Library
                    </Link>
                    <Link
                      href="/seeds"
                      className="rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
                    >
                      ← My Seeds
                    </Link>
                  </div>
                </div>

                <div className="relative min-h-56 overflow-hidden bg-gradient-to-br from-emerald-950 via-green-800 to-lime-600 p-8 text-white">
                  <div
                    className="absolute -right-8 -top-12 text-[170px] opacity-15"
                    aria-hidden="true"
                  >
                    🌱
                  </div>
                  <div className="relative">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-green-200">
                      Two paths
                    </p>
                    <div className="mt-6 space-y-5">
                      <div>
                        <p className="font-black">Shared subject</p>
                        <p className="mt-1 text-sm leading-6 text-white/75">
                          Suç ve Ceza, Interstellar, Kyoto, a course or a game.
                        </p>
                      </div>
                      <div>
                        <p className="font-black">Private Seed</p>
                        <p className="mt-1 text-sm leading-6 text-white/75">
                          A thought, possibility or goal that is visible only to you.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {seedTypes.map((seedType) => {
                const usesCatalogue = CATALOGUE_BACKED_SLUGS.has(seedType.slug);
                const href = usesCatalogue
                  ? `/seeds/explore?type=${encodeURIComponent(seedType.id)}`
                  : `/seeds/new?mode=private&type=${encodeURIComponent(seedType.id)}`;

                return (
                  <Link
                    key={seedType.id}
                    href={href}
                    className="group rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-green-400 hover:shadow-md"
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {seedType.icon}
                    </span>
                    <h2 className="mt-4 text-lg font-black text-gray-950">
                      {seedType.name}
                    </h2>
                    <p className="mt-2 min-h-16 text-sm leading-6 text-gray-500">
                      {seedType.description}
                    </p>
                    <span className="mt-5 inline-flex text-xs font-black uppercase tracking-wide text-green-700">
                      {usesCatalogue
                        ? "Search shared subjects →"
                        : "Create Private Seed →"}
                    </span>
                  </Link>
                );
              })}
            </section>

            <section className="mt-7 rounded-[28px] border border-dashed border-gray-300 bg-white p-6 text-center">
              <h2 className="text-xl font-black text-gray-950">
                This does not belong in a shared catalogue?
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                Create a Private Seed with your own title, notes, links and optional cover. It is always visible only to you and can be connected to the Library later.
              </p>
              <Link
                href="/seeds/new?mode=private"
                className="mt-5 inline-flex rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-black text-gray-800 transition hover:border-gray-950 hover:bg-gray-950 hover:text-white"
              >
                Create a Private Seed
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
