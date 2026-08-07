import { redirect } from "next/navigation";

export default function FollowingCommunitiesPage() {
  redirect("/communities?scope=following");
}
