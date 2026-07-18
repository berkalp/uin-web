import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import PlanCompletionReview, {
  type CompletionMemberData,
  type CompletionPlanData,
} from "@/components/plans/PlanCompletionReview";
import { createClient } from "@/utils/supabase/server";

type PlanCompletionPageProps = {
  params: Promise<{
    planId: string;
  }>;
};

type CompletionReviewData = {
  plan: CompletionPlanData;
  members: CompletionMemberData[];
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isCompletionReviewData(
  value: unknown
): value is CompletionReviewData {
  if (
    typeof value !==
      "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as {
      plan?: unknown;
      members?: unknown;
    };

  return (
    typeof candidate.plan ===
      "object" &&
    candidate.plan !== null &&
    Array.isArray(
      candidate.members
    )
  );
}

export default async function PlanCompletionPage({
  params,
}: PlanCompletionPageProps) {
  const { planId } =
    await params;

  if (
    !planId ||
    !isValidUuid(planId)
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_shared_plan_completion_review",
    {
      p_plan_id:
        planId,
    }
  );

  if (error) {
    console.error(
      "Plan completion review query failed:",
      error
    );

    redirect(
      "/timeline?view=planned"
    );
  }

  if (
    !isCompletionReviewData(
      data
    )
  ) {
    notFound();
  }

  if (
    data.plan.status !==
      "planned" ||
    !data.plan.scheduled_end ||
    new Date(
      data.plan.scheduled_end
    ).getTime() >
      Date.now()
  ) {
    redirect(
      `/plans/${encodeURIComponent(
        planId
      )}`
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/timeline?view=action_required"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to Action Required
          </Link>

          <Link
            href={`/plans/${encodeURIComponent(
              planId
            )}`}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
          >
            Open Activity Room
          </Link>
        </div>

        <PlanCompletionReview
          plan={data.plan}
          members={
            data.members
          }
        />
      </div>
    </main>
  );
}
