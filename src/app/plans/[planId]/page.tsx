import {
  notFound,
  redirect,
} from "next/navigation";

import { createClient } from "../../../utils/supabase/server";

type PlanRedirectPageProps = {
  params: Promise<{
    planId: string;
  }>;
};

type PlanRedirectData = {
  id: string;
  status:
    | "forming"
    | "planned"
    | "completed"
    | "cancelled";
  creation_mode:
    | "matched"
    | "scheduled_direct";
  planned_at: string | null;
};

export default async function PlanRedirectPage({
  params,
}: PlanRedirectPageProps) {
  const { planId } = await params;

  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase
    .from("plans")
    .select(`
      id,
      status,
      creation_mode,
      planned_at
    `)
    .eq("id", planId)
    .maybeSingle();

  if (
    error ||
    !data
  ) {
    if (error) {
      console.error(
        "Plan redirect query failed:",
        error
      );
    }

    notFound();
  }

  const plan =
    data as PlanRedirectData;

  const activityRoomExists =
    plan.creation_mode ===
      "scheduled_direct" ||
    plan.status === "planned" ||
    plan.status === "completed" ||
    (
      plan.status === "cancelled" &&
      plan.planned_at !== null
    );

  redirect(
    activityRoomExists
      ? `/plans/${plan.id}/activity`
      : `/plans/${plan.id}/planning`
  );
}