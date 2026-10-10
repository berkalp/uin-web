import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import ReputationFeedbackForm from "@/components/reputation/ReputationFeedbackForm";
import PageDataUnavailable from "@/components/common/PageDataUnavailable";
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
  searchParams?: Promise<{
    returnTo?: string | string[];
  }>;
};

function isUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFeedbackFormData(value: unknown): value is ReputationFeedbackFormData {
  if (!isRecord(value) || !isRecord(value.plan) || !isRecord(value.target)) return false;
  return typeof value.plan.id === "string" &&
    typeof value.plan.title === "string" &&
    typeof value.target.id === "string" &&
    typeof value.target.username === "string" &&
    Array.isArray(value.questions) &&
    value.questions.every((question) =>
      isRecord(question) &&
      typeof question.id === "string" &&
      typeof question.prompt === "string" &&
      (question.response_type === "yes_no" || question.response_type === "scale_5")
    );
}

function getSafeReturnHref(
  value: string | string[] | undefined,
  fallback: string
) {
  const candidate =
    Array.isArray(value)
      ? value[0]
      : value;

  if (
    typeof candidate !== "string" ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.length > 500
  ) {
    return fallback;
  }

  return candidate;
}

export default async function ReputationFeedbackDetailPage({
  params,
  searchParams,
}: ReputationFeedbackDetailPageProps) {
  const {
    planId,
    targetUserId,
  } = await params;

  const resolvedSearchParams =
    searchParams
      ? await searchParams
      : {};

  const fallbackReturnHref =
    `/plans/${encodeURIComponent(
      planId
    )}/activity#activity-feedback`;

  const returnHref =
    getSafeReturnHref(
      resolvedSearchParams.returnTo,
      fallbackReturnHref
    );

  const returnLabel =
    returnHref.startsWith(
      "/plans/"
    )
      ? "← Aktivite Odasına Dön"
      : "← Değerlendirmeye Dön";

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

  if (error) {
    console.error(
      "Reputation feedback form query failed:",
      error
    );
    return (
      <PageDataUnavailable
        title="Değerlendirme şu anda yüklenemedi"
        retryHref={`/reputation/feedback/${encodeURIComponent(planId)}/${encodeURIComponent(targetUserId)}?returnTo=${encodeURIComponent(returnHref)}`}
        backHref={returnHref}
        backLabel={returnLabel.replace("← ", "")}
      />
    );
  }

  if (!data) {

    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-4xl">
          <Link
            href={returnHref}
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            {returnLabel}
          </Link>

          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-8">
            <h1 className="text-2xl font-bold text-amber-950">
              Değerlendirme kullanılamıyor
            </h1>

            <p className="mt-3 text-sm leading-7 text-amber-800">
              Değerlendirme süresi kapanmış olabilir, Aktivite tamamlanmamış olabilir veya bu kişi karşılıklı değerlendirmeye uygun olmayabilir.
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (!isFeedbackFormData(data)) {
    console.error("Reputation feedback form query returned a malformed payload.");
    return (
      <PageDataUnavailable
        title="Değerlendirme şu anda yüklenemedi"
        retryHref={`/reputation/feedback/${encodeURIComponent(planId)}/${encodeURIComponent(targetUserId)}?returnTo=${encodeURIComponent(returnHref)}`}
        backHref={returnHref}
        backLabel={returnLabel.replace("← ", "")}
      />
    );
  }

  const form = data;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href={returnHref}
          className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
        >
          {returnLabel}
        </Link>

        <div className="mt-6">
          <ReputationFeedbackForm
            form={form}
            returnHref={returnHref}
          />
        </div>
      </div>
    </main>
  );
}
