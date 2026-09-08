import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

export type AdminRole =
  | "owner"
  | "admin"
  | "moderator"
  | "support";

const ADMIN_ROLES = new Set<AdminRole>([
  "owner",
  "admin",
  "moderator",
  "support",
]);

export function isAdminRole(
  value: unknown
): value is AdminRole {
  return (
    typeof value === "string" &&
    ADMIN_ROLES.has(value as AdminRole)
  );
}

export type StaffCapability =
  | "staff_identity"
  | "staff_messaging"
  | "member_messaging"
  | "edit_profiles";

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
    !isAdminRole(roleData)
  ) {
    redirect("/timeline");
  }

  return {
    supabase,
    user,
    role: roleData,
  };
}

export async function getMyStaffCapabilitySet(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data, error } = await supabase.rpc(
    "get_my_staff_capabilities"
  );

  if (error) {
    console.error("Staff capability query failed:", error);
    return new Set<StaffCapability>();
  }

  return new Set(
    ((data ?? []) as { capability?: StaffCapability; enabled?: boolean }[])
      .filter((row) => row.enabled !== false && row.capability)
      .map((row) => row.capability as StaffCapability)
  );
}
