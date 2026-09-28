import { cache } from "react";

import { isAdminRole, type AdminRole } from "@/utils/admin";
import { createClient } from "@/utils/supabase/server";

export const getViewerContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, adminRole: null as AdminRole | null };
  }

  const { data } = await supabase.rpc("get_admin_role");

  return {
    user,
    adminRole: isAdminRole(data) ? data : null,
  };
});
