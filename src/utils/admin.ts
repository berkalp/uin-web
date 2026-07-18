import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

export type AdminRole =
  | "owner"
  | "admin"
  | "moderator"
  | "support";

export async function requireAdmin() {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (
    userError ||
    !user
  ) {
    redirect("/");
  }

  const {
    data: roleData,
    error: roleError,
  } = await supabase.rpc(
    "get_admin_role"
  );

  if (
    roleError ||
    !roleData
  ) {
    redirect("/timeline");
  }

  return {
    supabase,
    user,
    role:
      roleData as AdminRole,
  };
}