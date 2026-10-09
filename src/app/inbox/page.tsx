import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

type ManagedProfileRow = {
  child_user_id: string;
  child_full_name: string | null;
  child_username: string;
  child_avatar_url: string | null;
  pending_invitation_count:
    | number
    | string;
};

function getInitial(
  value: string
) {
  return (
    value
      .trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function toCount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export default async function InboxPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [
    requestResponse,
    intentInvitationResponse,
    joinRequestResponse,
    managedProfileResponse,
    activeOwnedIntentResponse,
  ] = await Promise.all([
    supabase
      .from("intent_requests")
      .select(
        "id, receiver_id, status"
      )
      .eq(
        "receiver_id",
        user.id
      )
      .eq(
        "status",
        "pending"
      ),

    supabase.rpc(
      "get_my_received_intent_invitations"
    ),

    supabase.rpc(
      "get_my_intent_join_requests"
    ),

    supabase.rpc(
      "get_my_managed_profile_switcher"
    ),

    supabase
      .from("intents")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .is("expired_at", null),
  ]);

  const loadFailed = Boolean(
    requestResponse.error ||
      intentInvitationResponse.error ||
      joinRequestResponse.error ||
      managedProfileResponse.error ||
      activeOwnedIntentResponse.error
  );

  const pendingIntentRequestCount =
    requestResponse.error ? null : (requestResponse.data ?? []).length;

  const pendingIntentInvitationCount =
    intentInvitationResponse.error
      ? null
      : (
      (
        intentInvitationResponse.data ??
        []
      ) as {
        invitation_status?: string;
      }[]
    ).filter(
      (invitation) =>
        invitation.invitation_status ===
        "pending"
      ).length;

  const activeOwnedIntentIds = new Set(
    ((activeOwnedIntentResponse.data ?? []) as { id: string }[]).map(
      (intent) => intent.id
    )
  );

  const pendingJoinRequestCount =
    joinRequestResponse.error || activeOwnedIntentResponse.error
      ? null
      : (
      (
        joinRequestResponse.data ??
        []
      ) as {
        direction?: string;
        request_status?: string;
        intent_id?: string;
      }[]
    ).filter(
      (request) =>
        request.direction ===
          "received" &&
        request.request_status ===
          "pending" &&
        Boolean(
          request.intent_id &&
          activeOwnedIntentIds.has(request.intent_id)
        )
      ).length;

  const managedProfiles =
    managedProfileResponse.error
      ? []
      : ((managedProfileResponse.data ?? []) as ManagedProfileRow[]);

  const managedProfileCounts = managedProfiles.map((profile) =>
    toCount(profile.pending_invitation_count)
  );
  const managedProfileActionCount = managedProfileResponse.error || managedProfileCounts.some((count) => count === null)
    ? null
    : managedProfileCounts.reduce<number>((total, count) => total + (count ?? 0), 0);

  const knownCounts = [
    pendingIntentRequestCount,
    pendingIntentInvitationCount,
    pendingJoinRequestCount,
    managedProfileActionCount,
  ];
  const totalCount = knownCounts.some((count) => count === null)
    ? null
    : knownCounts.reduce<number>((total, count) => total + (count ?? 0), 0);

  const actionCards = [
    {
      title:
        "Niyet İstekleri",
      description:
        "Uyumlu kişisel niyetleri bir araya getiren istekler.",
      count:
        pendingIntentRequestCount,
      href: "/requests",
      tone:
        "border-green-200 bg-green-50/40 text-green-700",
    },
    {
      title:
        "Etkinlik Davetleri",
      description:
        "Kişisel profiline doğrudan gönderilen davetler.",
      count:
        pendingIntentInvitationCount,
      href:
        "/intent-invitations",
      tone:
        "border-purple-200 bg-purple-50/40 text-purple-700",
    },
    {
      title:
        "Katılım İstekleri",
      description:
        "Herkese açık etkinliklerine katılmak isteyen kişiler.",
      count:
        pendingJoinRequestCount,
      href: "/join-requests",
      tone:
        "border-blue-200 bg-blue-50/40 text-blue-700",
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/timeline"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
          </Link>

          <span className="rounded-full bg-gray-950 px-4 py-2 text-sm font-semibold text-white">
            {totalCount === null ? "Bekleyen sayısı yüklenemedi" : `${totalCount} bekleyen`}
          </span>
        </div>

        <header className="mt-8">
          <h1 className="text-4xl font-bold text-gray-950">
            Karar Merkezi
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
            Karar vermen gereken istekler, davetler ve yönetilen profil işlemleri burada. Mesajlar ve Bildirimler ayrı tutulur.
          </p>
        </header>

        {loadFailed && (
          <section role="alert" className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            <h2 className="font-bold">Bazı kararlar yüklenemedi</h2>
            <p className="mt-2 text-sm leading-6">
              Eksik kayıtları sıfır gibi göstermiyoruz. Yüklenemeyen sayaçlar çizgiyle işaretlendi.
            </p>
            <Link href="/inbox" className="mt-4 inline-flex rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white">
              Yeniden dene
            </Link>
          </section>
        )}

        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          {actionCards.map(
            (card) => (
              <Link
                key={card.title}
                href={card.href}
                className={`group rounded-3xl border p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-950">
                      {card.title}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {
                        card.description
                      }
                    </p>
                  </div>

                  <span className="rounded-full bg-white px-3 py-1 text-sm font-bold shadow-sm">
                    {card.count === null ? "—" : card.count}
                  </span>
                </div>

                <p className="mt-5 text-sm font-semibold">
                  Aç
                  <span className="ml-2 inline-block transition group-hover:translate-x-1">
                    →
                  </span>
                </p>
              </Link>
            )
          )}
        </section>

        {managedProfiles.length >
          0 && (
          <section className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Yönetilen Profiller
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Veli işlemleri
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              {managedProfiles.map(
                (profile) => {
                  const name =
                    profile.child_full_name ||
                    profile.child_username;

                  const count = toCount(profile.pending_invitation_count);

                  return (
                    <Link
                      key={
                        profile.child_user_id
                      }
                      href={`/managed/${encodeURIComponent(
                        profile.child_user_id
                      )}?view=pending`}
                      className="group flex items-center gap-4 rounded-3xl border border-blue-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      {profile.child_avatar_url ? (
                        <img
                          src={
                            profile.child_avatar_url
                          }
                          alt={name}
                          className="h-16 w-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-xl font-bold text-blue-700">
                          {getInitial(name)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-bold text-gray-950">
                          {name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          Yönetilen çocuk profili
                        </p>
                      </div>

                      <span className="rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white">
                        {count === null ? "—" : count}
                      </span>

                      <span className="text-gray-300 transition group-hover:translate-x-1 group-hover:text-blue-700">
                        →
                      </span>
                    </Link>
                  );
                }
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
