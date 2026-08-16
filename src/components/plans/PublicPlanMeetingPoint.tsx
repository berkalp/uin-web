import { createClient } from "@/utils/supabase/server";

type PublicPlanContent = {
  meeting_point?: string | null;
  meeting_point_is_public?: boolean;
  activity_location_name?: string | null;
};

export default async function PublicPlanMeetingPoint({
  planId,
}: {
  planId: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "get_visible_plan_public_content",
    {
      p_plan_id: planId,
    }
  );

  if (error || !data) {
    return null;
  }

  const content = data as PublicPlanContent;
  const meetingPoint =
    typeof content.meeting_point === "string"
      ? content.meeting_point.trim()
      : "";
  const activityLocation =
    typeof content.activity_location_name === "string"
      ? content.activity_location_name.trim()
      : "";

  if (!meetingPoint) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-cyan-200 bg-cyan-50/50 p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">
        Buluşma
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Buluşma noktası
          </p>
          <p className="mt-1 text-lg font-black text-gray-950">
            {meetingPoint}
          </p>
        </div>

        {activityLocation && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Aktivite yeri
            </p>
            <p className="mt-1 text-lg font-black text-gray-950">
              {activityLocation}
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-gray-500">
        Tam adres ve özel ulaşım ayrıntıları Plan üyelerine özel tutulur.
      </p>
    </section>
  );
}
