import { supabase } from "@/utils/supabase/client";

export type ActivityCategory = {
  id: string;
  name: string;
};

export type Activity = {
  id: string;
  category_id: string;
  name: string;
};

export async function getActivityCategories() {
  const { data, error } = await supabase
    .from("activity_categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data as ActivityCategory[];
}

export async function getActivitiesByCategory(categoryId: string) {
  const { data, error } = await supabase
    .from("activities")
    .select("id, category_id, name")
    .eq("category_id", categoryId)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data as Activity[];
}