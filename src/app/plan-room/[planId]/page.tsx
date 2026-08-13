import { redirect } from "next/navigation";

type LegacyPlanningRoomRouteProps = {
  params: Promise<{
    planId: string;
  }>;
};

export default async function LegacyPlanningRoomRoute({
  params,
}: LegacyPlanningRoomRouteProps) {
  const { planId } = await params;
  redirect(`/plans/${planId}/planning`);
}
