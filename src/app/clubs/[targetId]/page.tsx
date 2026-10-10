import Link from "next/link";
import { notFound } from "next/navigation";

import ClubProfilePage from "@/components/clubs/ClubProfilePage";
import PageDataUnavailable from "@/components/common/PageDataUnavailable";
import AppNavigation from "@/components/navigation/AppNavigation";
import { createClient } from "@/utils/supabase/server";
import type { CardLabels } from "@/utils/uinCardLanguage";

export const dynamic = "force-dynamic";

type ClubProfile = {
  title: string;
  creator_name: string | null;
  cover_url: string | null;
  metadata: Record<string, unknown>;
};

type ClubContentType = {
  id: string;
  label: string;
  icon: string;
  base_kind: string;
  ui_labels?: CardLabels;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseClubProfile(value: unknown): ClubProfile | null {
  if (!isRecord(value) || !isRecord(value.metadata)) return null;
  if (typeof value.title !== "string" || !value.title.trim()) return null;

  const contentTypeId = value.metadata.content_type_id;
  if (typeof contentTypeId !== "string" || !contentTypeId.trim()) return null;

  if (value.creator_name != null && typeof value.creator_name !== "string") {
    return null;
  }

  if (value.cover_url != null && typeof value.cover_url !== "string") {
    return null;
  }

  return {
    title: value.title,
    creator_name: value.creator_name ?? null,
    cover_url: value.cover_url ?? null,
    metadata: value.metadata,
  };
}

function parseContentType(value: unknown): ClubContentType | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    typeof value.icon !== "string" ||
    typeof value.base_kind !== "string"
  ) {
    return null;
  }

  if (value.ui_labels != null && !isRecord(value.ui_labels)) return null;

  return {
    id: value.id,
    label: value.label,
    icon: value.icon,
    base_kind: value.base_kind,
    ui_labels: isRecord(value.ui_labels)
      ? (value.ui_labels as CardLabels)
      : undefined,
  };
}

export default async function ClubPage({
  params,
}: {
  params: Promise<{ targetId: string }>;
}) {
  const { targetId } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(targetId)) notFound();

  const retryHref = `/clubs/${encodeURIComponent(targetId)}`;
  const unavailable = (
    <PageDataUnavailable
      title="Kulüp profili şu anda yüklenemedi"
      retryHref={retryHref}
      backHref="/ideas?kind=club"
      backLabel="Spor kulüplerine dön"
    />
  );
  const supabase = await createClient();
  const { data: profileData, error: profileError } = await supabase.rpc(
    "get_uin_card_profile_v60",
    { p_target_id: targetId }
  );

  if (profileError) {
    console.error("Club profile query failed:", profileError);
    return unavailable;
  }

  if (profileData == null) notFound();

  const profile = parseClubProfile(profileData);
  if (!profile) {
    console.error("Club profile query returned an incomplete payload.");
    return unavailable;
  }

  const { data: contentTypesData, error: contentTypesError } = await supabase
    .from("uin_content_types")
    .select("id,label,icon,base_kind,ui_labels");

  if (contentTypesError || !Array.isArray(contentTypesData)) {
    console.error("Club content type query failed:", contentTypesError);
    return unavailable;
  }

  const contentTypeId = profile.metadata.content_type_id as string;
  const rawContentType = contentTypesData.find(
    (item) => isRecord(item) && item.id === contentTypeId
  );

  if (!rawContentType) {
    console.error("Club profile content type is missing.", { contentTypeId });
    return unavailable;
  }

  const contentType = parseContentType(rawContentType);
  if (!contentType) {
    console.error("Club content type query returned an incomplete payload.");
    return unavailable;
  }

  if (contentType.base_kind !== "club") notFound();

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || typeof isAdmin !== "boolean") {
    console.error("Club admin status query failed:", adminError);
    return unavailable;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <AppNavigation />
        <Link
          href="/ideas?kind=club"
          className="my-6 inline-block text-sm font-bold text-emerald-800"
        >
          ← Spor kulüpleri
        </Link>
        <ClubProfilePage
          isAdmin={isAdmin === true}
          targetId={targetId}
          title={profile.title}
          subtitle={profile.creator_name}
          coverUrl={profile.cover_url}
          metadata={profile.metadata}
          contentType={contentType}
        />
      </div>
    </main>
  );
}
