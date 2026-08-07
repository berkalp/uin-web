import { notFound } from "next/navigation";

import PlanRoomView from "../../../../components/plans/PlanRoomView";
import {
  resolveReturnNavigation,
  type ReturnSearchParams,
} from "../../../../utils/returnNavigation";

type ActivityRoomPageProps = {
  params: Promise<Record<string, string>>;
  searchParams?: Promise<ReturnSearchParams>;
};

export default async function ActivityRoomPage({
  params,
  searchParams,
}: ActivityRoomPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const backNavigation = resolveReturnNavigation(resolvedSearchParams, {
    href: "/timeline",
    label: "Timeline",
  });

  const planId =
    resolvedParams.planId ??
    resolvedParams.PlanId ??
    resolvedParams.PlansId ??
    Object.values(
      resolvedParams
    )[0];

  if (!planId) {
    notFound();
  }

  return (
    <PlanRoomView
      planId={planId}
      roomPhase="activity"
      backHref={backNavigation.href}
      backLabel={backNavigation.label}
    />
  );
}