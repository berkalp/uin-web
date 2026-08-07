import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import CommunitySuggestionForm, {
  type CommunitySuggestionRow,
} from "@/components/communities/CommunitySuggestionForm";

import {
  createClient,
} from "@/utils/supabase/server";

type SuggestionSearchParams =
  Promise<
    Record<
      string,
      string |
      string[] |
      undefined
    >
  >;

function getParam(
  searchParams:
    Record<
      string,
      string |
      string[] |
      undefined
    >,
  key: string
) {
  const value =
    searchParams[key];

  if (
    Array.isArray(value)
  ) {
    return (
      value[0] ??
      ""
    );
  }

  return (
    value ??
    ""
  );
}

export default async function SuggestCommunityPage({
  searchParams,
}: {
  searchParams:
    SuggestionSearchParams;
}) {
  const resolvedSearchParams =
    await searchParams;

  const initialCategoryId =
    getParam(
      resolvedSearchParams,
      "category"
    );

  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [
    categoriesResult,
    suggestionsResult,
  ] = await Promise.all([
    supabase
      .from(
        "activity_categories"
      )
      .select(
        "id, name"
      )
      .eq(
        "is_active",
        true
      )
      .order(
        "name",
        {
          ascending:
            true,
        }
      ),

    supabase.rpc(
      "get_my_community_suggestions"
    ),
  ]);

  if (
    categoriesResult.error
  ) {
    console.error(
      "Community suggestion categories failed:",
      categoriesResult.error
    );
  }

  if (
    suggestionsResult.error
  ) {
    console.error(
      "Community suggestion history failed:",
      suggestionsResult.error
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
                Curated Communities
              </p>

              <h1 className="mt-2 text-3xl font-bold text-gray-950">
                Suggest a Community
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
                People cannot create
                Communities directly.
                Suggestions are reviewed,
                merged or rejected by UIN
                administrators before they
                become available in Intent
                Builder and Discover.
              </p>
            </div>

            <Link
              href="/discover"
              className="shrink-0 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-indigo-400 hover:text-indigo-700"
            >
              ← Discover
            </Link>
          </div>
        </header>

        <div className="mt-7">
          <CommunitySuggestionForm
            categories={
              (
                categoriesResult.data ??
                []
              ) as {
                id: string;
                name: string;
              }[]
            }
            initialCategoryId={
              initialCategoryId
            }
            initialSuggestions={
              (
                suggestionsResult.data ??
                []
              ) as CommunitySuggestionRow[]
            }
          />
        </div>
      </div>
    </main>
  );
}
