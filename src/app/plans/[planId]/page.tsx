import {
  notFound,
  redirect,
} from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import PageDataUnavailable from "@/components/common/PageDataUnavailable";
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

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default async function PlanRedirectPage({
  params,
  searchParams,
}: PlanRedirectPageProps) {
  const { planId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  if (!isValidUuid(planId)) {
    notFound();
  }

  const forwardedParams = new URLSearchParams();

  for (const key of ["from", "returnTo", "returnLabel"]) {
    const value = resolvedSearchParams[key];
    const firstValue = Array.isArray(value) ? value[0] : value;
    if (firstValue) {
      forwardedParams.set(key, firstValue);
    }
  }

  const query = forwardedParams.toString();
  const retryPath = `/plans/${encodeURIComponent(planId)}`;
  const retryHref = query ? `${retryPath}?${query}` : retryPath;

  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && !isAuthSessionMissingError(userError)) {
    console.error("Plan redirect session query failed:", userError);
    return (
      <PageDataUnavailable
        title="Plan şu anda yüklenemedi"
        retryHref={retryHref}
        backHref="/timeline"
        backLabel="Niyetlere dön"
      />
    );
  }

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

  if (error) {
    console.error(
      "Plan redirect query failed:",
      error
    );

    return (
      <PageDataUnavailable
        title="Plan şu anda yüklenemedi"
        retryHref={retryHref}
        backHref="/timeline"
        backLabel="Niyetlere dön"
      />
    );
  }

  if (!data) {
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
  redirect(query ? `${targetPath}?${query}` : targetPath);
}
