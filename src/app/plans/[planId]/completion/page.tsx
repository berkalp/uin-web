import { notFound, redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

type PlanCompletionPageProps = {
  params: Promise<{ planId: string }>;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default async function PlanCompletionPage({ params }: PlanCompletionPageProps) {
  const { planId } = await params;

  if (!planId || !isValidUuid(planId)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Attendance/outcome review now lives inside the Activity Room so the
  // Activity title, Activity location and meeting point remain visible.
  redirect(`/plans/${encodeURIComponent(planId)}/activity#attendance-review`);
}
