import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import AdminProfileEditForm from "@/components/admin/AdminProfileEditForm";
import {
  type AdminRole,
  getMyStaffCapabilitySet,
  requireAdmin,
} from "@/utils/admin";

type AdminUserEditPageProps = {
  params: Promise<Record<string, string>>;
};

type AdminUserDetail = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  email: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  admin_role: AdminRole | null;
};

export default async function AdminUserEditPage({ params }: AdminUserEditPageProps) {
  const resolvedParams = await params;
  const userId = resolvedParams.userId || Object.values(resolvedParams)[0];
  if (!userId) notFound();

  const { supabase } = await requireAdmin();
  const capabilities = await getMyStaffCapabilitySet(supabase);

  if (!capabilities.has("edit_profiles")) {
    redirect(`/admin/users/${encodeURIComponent(userId)}`);
  }

  const { data, error } = await supabase.rpc("get_admin_user_detail", {
    p_user_id: userId,
  });

  if (error) {
    console.error("Admin edit profile query failed:", error);
    notFound();
  }

  const profile = ((data ?? []) as unknown as AdminUserDetail[])[0] ?? null;
  if (!profile) notFound();

  const displayName = profile.full_name || profile.username || "UIN member";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/admin/users/${encodeURIComponent(profile.username || profile.user_id)}`}
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to {displayName}
          </Link>

          {profile.username && (
            <Link
              href={`/u/${encodeURIComponent(profile.username)}`}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
            >
              Public Profile
            </Link>
          )}
        </div>

        <AdminProfileEditForm
          profile={{
            userId: profile.user_id,
            fullName: profile.full_name || "",
            username: profile.username || "",
            bio: profile.bio || "",
            city: profile.city || "",
            country: profile.country || "",
            avatarUrl: profile.avatar_url || "",
            coverUrl: profile.cover_url || "",
          }}
        />
      </div>
    </main>
  );
}
