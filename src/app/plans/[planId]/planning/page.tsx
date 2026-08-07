import PlanRoomView from "../../../../components/plans/PlanRoomView";
import {
  resolveReturnNavigation,
  type ReturnSearchParams,
} from "../../../../utils/returnNavigation";

type PlanningRoomPageProps = {
  params: Promise<{
    planId: string;
  }>;
  searchParams?: Promise<ReturnSearchParams>;
};

export default async function PlanningRoomPage({
  params,
  searchParams,
}: PlanningRoomPageProps) {
  const { planId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const backNavigation = resolveReturnNavigation(resolvedSearchParams, {
    href: "/timeline",
    label: "Timeline",
  });

  return (
    <PlanRoomView
      planId={planId}
      roomPhase="planning"
      backHref={backNavigation.href}
      backLabel={backNavigation.label}
    />
  );
}