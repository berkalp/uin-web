import PlanRoomView from "../../../../components/plans/PlanRoomView";

type PlanningRoomPageProps = {
  params: Promise<{
    planId: string;
  }>;
};

export default async function PlanningRoomPage({
  params,
}: PlanningRoomPageProps) {
  const { planId } = await params;

  return (
    <PlanRoomView
      planId={planId}
      roomPhase="planning"
    />
  );
}