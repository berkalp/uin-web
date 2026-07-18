import { notFound } from "next/navigation";

import PlanRoomView from "../../../../components/plans/PlanRoomView";

type ActivityRoomPageProps = {
  params: Promise<
    Record<string, string>
  >;
};

export default async function ActivityRoomPage({
  params,
}: ActivityRoomPageProps) {
  const resolvedParams =
    await params;

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
    />
  );
}