import {
  notFound,
  redirect,
} from "next/navigation";

import { createClient } from "../../../utils/supabase/server";
import type { ReturnSearchParams } from "../../../utils/returnNavigation";

type PlanRedirectPageProps = {
  params: Promise<{
    planId: string;
  }>;
  searchParams?: Promise<ReturnSearchParams>;
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
  searchParams,
}: PlanRedirectPageProps) {
  const { planId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

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

  const targetPath = activityRoomExists
    ? `/plans/${plan.id}/activity`
    : `/plans/${plan.id}/planning`;
  const forwardedParams = new URLSearchParams();

  for (const key of ["from", "returnTo", "returnLabel"]) {
    const value = resolvedSearchParams[key];
    const firstValue = Array.isArray(value) ? value[0] : value;
    if (firstValue) {
      forwardedParams.set(key, firstValue);
    }
  }

  const query = forwardedParams.toString();
  redirect(query ? `${targetPath}?${query}` : targetPath);
}