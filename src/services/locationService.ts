import { supabase } from "@/utils/supabase/client";

export type Location = {
  id: string;
  city: string;
  district: string;
};

export async function getLocations() {
  const { data, error } = await supabase
    .from("locations")
    .select("id, city, district")
    .order("district", { ascending: true });

  if (error) {
    throw error;
  }

  return data as Location[];
}