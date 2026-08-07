import { supabase } from "@/utils/supabase/client";

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message || fallback;
  }
  return fallback;
}

export async function dismissWeatherAlert(alertId: string) {
  const { error } = await supabase.rpc("dismiss_plan_weather_alert", {
    p_alert_id: alertId,
  });
  if (error) throw new Error(errorMessage(error, "Weather alert could not be dismissed."));
}

export async function addWeatherSuggestedPlanNeed(alertId: string) {
  const { data, error } = await supabase.rpc("add_weather_suggested_plan_need", {
    p_alert_id: alertId,
  });
  if (error) throw new Error(errorMessage(error, "Weather suggestion could not be added to Plan Needs."));
  return typeof data === "string" ? data : null;
}
