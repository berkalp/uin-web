import Link from "next/link";

import IntentForm from "@/components/onboarding/IntentForm";

type OnboardingPageProps = {
  searchParams: Promise<{
    copyFrom?: string | string[];
  }>;
};

function getSearchParamValue(
  value: string | string[] | undefined
) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const resolvedSearchParams = await searchParams;

  const copyFromValue = getSearchParamValue(
    resolvedSearchParams.copyFrom
  ).trim();

  const hasValidCopySource =
    copyFromValue.length > 0 &&
    isValidUuid(copyFromValue);

  const backHref = hasValidCopySource
    ? "/timeline?view=expired"
    : "/timeline";

  const backLabel = hasValidCopySource
    ? "Back to Expired Activities"
    : "Back to Timeline";

  return (
    <div className="relative min-h-screen">
      <Link
        href={backHref}
        className="fixed left-6 top-6 z-50 rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 shadow-sm transition hover:border-green-500 hover:text-green-700"
      >
        ← {backLabel}
      </Link>

      <IntentForm />
    </div>
  );
}