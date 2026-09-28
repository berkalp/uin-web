import ActivityLocationSwitcher from "@/components/activities/ActivityLocationSwitcher";
import { createClient } from "@/utils/supabase/server";

type PublicPlanContent = {
  meeting_point?: string | null;
  meeting_point_is_public?: boolean;
  activity_location_name?: string | null;
};

export default async function ActivityPublicMapPanel({
  planId,
  title,
  fallbackActivityLocation,
  fallbackLocationScope,
}: {
  planId: string | null;
  title: string;
  fallbackActivityLocation: string | null;
  fallbackLocationScope?: string | null;
}) {
  let activityLocation = fallbackActivityLocation?.trim() || null;
  let activityLocationScope = fallbackLocationScope ?? null;
  let meetingPoint: string | null = null;

  if (planId) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "get_visible_plan_public_content",
      {
        p_plan_id: planId,
      }
    );

    if (!error && data) {
      const content = data as PublicPlanContent;
      const visibleActivityLocation =
        typeof content.activity_location_name === "string"
          ? content.activity_location_name.trim()
          : "";
      const visibleMeetingPoint =
        typeof content.meeting_point === "string"
          ? content.meeting_point.trim()
          : "";

      if (visibleActivityLocation) {
        activityLocation = visibleActivityLocation;
        activityLocationScope = null;
      }
      if (visibleMeetingPoint) {
        meetingPoint = visibleMeetingPoint;
      }
    }
  }

  return (
    <ActivityLocationSwitcher
      title={title}
      activityLocation={activityLocation}
      meetingPoint={meetingPoint}
      locationScope={activityLocationScope}
    />
  );
}
