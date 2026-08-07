import { supabase } from "@/utils/supabase/client";
import {
  sortLocations,
  type HierarchicalLocation,
} from "@/utils/location";

export async function getLocations() {
  const {
    data,
    error,
  } = await supabase
    .from("locations")
    .select(
      "id, country_code, country_name, city, district, scope"
    );

  if (error) {
    throw error;
  }

  return sortLocations(
    (data ?? []) as HierarchicalLocation[]
  );
}
