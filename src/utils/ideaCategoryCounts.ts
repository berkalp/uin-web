import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

export type IdeaCategoryCounts = Record<string, number>;

function validCounts(value: unknown): value is IdeaCategoryCounts {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

async function loadPublicIdeaCategoryCounts(): Promise<IdeaCategoryCounts> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_FUNCTION_ANON_KEY;
  if (!url || !key) throw new Error("Public Supabase configuration is missing.");

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let result = await db.rpc("get_uin_category_counts_v129");
  if (result.error || !validCounts(result.data)) {
    result = await db.rpc("get_uin_category_counts_v129");
  }
  if (result.error || !validCounts(result.data)) {
    throw new Error(result.error?.message || "Category counts were empty.");
  }
  return Object.fromEntries(Object.entries(result.data).map(([id, count]) => [id, Number(count)]));
}

export const getCachedIdeaCategoryCounts = unstable_cache(
  loadPublicIdeaCategoryCounts,
  ["uin-public-category-counts-v129"],
  { revalidate: 60 },
);
