import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import ReputationFeedbackForm from "@/components/reputation/ReputationFeedbackForm";
import type {
  ReputationFeedbackFormData,
} from "@/utils/reputation";
import {
  createClient,
} from "@/utils/supabase/server";

type ReputationFeedbackDetailPageProps = {
  params: Promise<{
    planId: string;
    targetUserId: string;
  }>;
};

function isUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default async function ReputationFeedbackDetailPage({
  params,
}: ReputationFeedbackDetailPageProps) {
  const {
    planId,
    targetUserId,
  } = await params;

  if (
    !isUuid(planId) ||
    !isUuid(targetUserId)
  ) {
    notFound();
  }

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
  } = await supabase.rpc(
    "get_reputation_feedback_form",
    {
      p_plan_id: planId,
      p_target_user_id:
        targetUserId,
    }
  );

  if (error || !data) {
    if (error) {
      console.error(
        "Reputation feedback form query failed:",
        error
      );
    }

    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/reputation/feedback"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to feedback
          </Link>

          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-8">
            <h1 className="text-2xl font-bold text-amber-950">
              Feedback is unavailable
            </h1>

            <p className="mt-3 text-sm leading-7 text-amber-800">
              The feedback window may have closed, the Activity may not be completed, or this person is not eligible for peer reputation.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const form =
    data as ReputationFeedbackFormData;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/reputation/feedback"
          className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
        >
          ← Back to feedback
        </Link>

        <div className="mt-6">
          <ReputationFeedbackForm
            form={form}
          />
        </div>
      </div>
    </main>
  );
}
