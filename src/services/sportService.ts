import { supabase } from "@/utils/supabase/client";

export type Sport = {
  id: string;
  name: string;
  slug: string;
};

export async function getSports(): Promise<Sport[]> {
  const { data, error } = await supabase
    .from("sports")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as Sport[];
}
