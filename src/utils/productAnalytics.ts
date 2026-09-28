import { supabase } from "@/utils/supabase/client";

export type ProductAnalyticsEvent =
  | "common_card_viewed"
  | "intent_created"
  | "collaboration_requested"
  | "social_plan_created"
  | "social_plan_completed"
  | "experience_created";

type TrackOptions = {
  targetId?: string | null;
  intentId?: string | null;
  planId?: string | null;
  resourceId?: string | null;
  source?: string;
  flow?: string;
  contentType?: string;
  actionType?: string;
};

export async function trackProductEvent(eventName: ProductAnalyticsEvent, options: TrackOptions = {}) {
  const properties = Object.fromEntries(Object.entries({
    source: options.source,
    flow: options.flow,
    content_type: options.contentType,
    action_type: options.actionType,
  }).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0));

  try {
    await supabase.rpc("record_product_analytics_event_v81", {
      p_event_name: eventName,
      p_target_id: options.targetId || null,
      p_intent_id: options.intentId || null,
      p_plan_id: options.planId || null,
      p_resource_id: options.resourceId || null,
      p_surface: "web",
      p_properties: properties,
    });
  } catch {
    // Analytics must never block the product action that already succeeded.
  }
}
