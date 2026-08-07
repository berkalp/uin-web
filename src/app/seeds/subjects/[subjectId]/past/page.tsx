import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PastSeedExperienceForm from "@/components/seeds/PastSeedExperienceForm";
import { createClient } from "@/utils/supabase/server";

type PastSeedExperiencePageProps = {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
};

type SubjectDetail = {
  subject: {
    catalog_item_id: string;
    seed_type_name: string;
    seed_type_slug: string;
    seed_type_icon: string;
    item_kind: string;
    canonical_title: string;
    creator_name: string | null;
    release_year: number | null;
    cover_url: string | null;
  };
  viewer_completed_seed?: {
    seed_id: string;
  } | null;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0]?.trim() || "" : value?.trim() || "";
}

function pastVerb(slug: string) {
  switch (slug) {
    case "read":
      return "I’ve read this";
    case "watch":
      return "I’ve watched this";
    case "listen":
      return "I’ve listened to this";
    case "visit":
      return "I’ve been here";
    case "play":
      return "I’ve played this";
    case "learn":
      return "I’ve completed this";
    default:
      return "I’ve already done this";
  }
}

export const metadata: Metadata = {
  title: "Add Past Experience | UIN",
};

export default async function PastSeedExperiencePage({
  params,
  searchParams,
}: PastSeedExperiencePageProps) {
  const [{ subjectId }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data, error } = await supabase.rpc("get_seed_catalog_detail", {
    p_catalog_item_id: subjectId,
  });

  if (error || !data) {
    notFound();
  }

  const detail = data as SubjectDetail;
  const subject = detail.subject;
  const errorMessage = one(query.error);
  const subjectPath = `/seeds/subjects/${encodeURIComponent(subjectId)}`;
  const returnTo = `${subjectPath}/past`;

  if (detail.viewer_completed_seed?.seed_id) {
    return (
      <main className="min-h-screen bg-[#f7f8f4] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-purple-200 bg-white p-7 shadow-sm sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">
            Past experience already recorded
          </p>
          <h1 className="mt-3 text-3xl font-black text-gray-950">
            {subject.canonical_title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            You already have a completed Seed for this Library subject. Open it
            instead of creating a duplicate.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/seeds/${encodeURIComponent(
                detail.viewer_completed_seed.seed_id
              )}`}
              className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-black text-white"
            >
              Open my experience
            </Link>
            <Link
              href={subjectPath}
              className="rounded-2xl border border-gray-300 px-5 py-3 text-sm font-bold text-gray-700"
            >
              Back to subject
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href={subjectPath}
          className="text-sm font-bold text-gray-600 hover:text-gray-950"
        >
          ← Back to subject
        </Link>

        <section className="mt-4 overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
          <div className="grid sm:grid-cols-[190px_1fr]">
            <div className="min-h-56 bg-gradient-to-br from-purple-50 to-emerald-100">
              {subject.cover_url ? (
                <img
                  src={subject.cover_url}
                  alt=""
                  className="h-full min-h-56 w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-56 items-center justify-center text-6xl">
                  {subject.seed_type_icon || "🌱"}
                </div>
              )}
            </div>
            <div className="p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">
                {pastVerb(subject.seed_type_slug)}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-950">
                {subject.canonical_title}
              </h1>
              {(subject.creator_name || subject.release_year) && (
                <p className="mt-2 font-semibold text-gray-600">
                  {[subject.creator_name, subject.release_year]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <p className="mt-4 max-w-xl text-sm leading-6 text-gray-600">
                Add this directly to your completed Seeds. It will not pass through
                the active or growing stage.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 p-6 sm:p-8">
            {errorMessage && (
              <p className="mb-6 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                {errorMessage}
              </p>
            )}
            <PastSeedExperienceForm
              catalogItemId={subject.catalog_item_id}
              returnTo={returnTo}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
