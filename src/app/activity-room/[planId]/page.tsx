import { redirect } from "next/navigation";

type LegacyActivityRoomRouteProps = {
  params: Promise<{
    planId: string;
  }>;
};

export default async function LegacyActivityRoomRoute({
  params,
}: LegacyActivityRoomRouteProps) {
  const { planId } = await params;
  redirect(`/plans/${planId}/activity`);
}
