import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import ManagedMinorProfileForm from "@/components/family/ManagedMinorProfileForm";
import { createClient } from "@/utils/supabase/server";

type ManagedProfilePageProps = {
  params: Promise<{
    childId: string;
  }>;
};

type ManagedProfileRow = {
  child_user_id: string;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
};

function isValidUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default async function ManagedProfilePage({
  params,
}: ManagedProfilePageProps) {
  const {
    childId,
  } = await params;

  if (
    !childId ||
    !isValidUuid(childId)
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_managed_minor_profile_settings",
    {
      p_child_user_id:
        childId,
    }
  );

  if (
    error ||
    !Array.isArray(data) ||
    data.length ===
      0
  ) {
    console.error(
      "Managed child profile settings query failed:",
      error
    );

    redirect(
      "/settings/family"
    );
  }

  const row =
    data[0] as ManagedProfileRow;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/settings/family"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to Family Settings
          </Link>

          <Link
            href={`/u/${encodeURIComponent(
              row.username
            )}`}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
          >
            Open Public Profile
          </Link>
        </div>

        <div className="mt-8">
          <ManagedMinorProfileForm
            childUserId={
              row.child_user_id
            }
            username={
              row.username
            }
            initialFullName={
              row.full_name ||
              ""
            }
            initialBio={
              row.bio ||
              ""
            }
            initialAvatarUrl={
              row.avatar_url ||
              ""
            }
            initialCoverUrl={
              row.cover_url ||
              ""
            }
            initialCity={
              row.city ||
              ""
            }
            initialCountry={
              row.country ||
              ""
            }
          />
        </div>
      </div>
    </main>
  );
}
