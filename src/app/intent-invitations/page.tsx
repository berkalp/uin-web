import Link from "next/link";
import { redirect } from "next/navigation";

import IntentInvitationActions from "@/components/intents/IntentInvitationActions";
import IntentInvitationRevokeButton from "@/components/intents/IntentInvitationRevokeButton";
import { createClient } from "@/utils/supabase/server";

type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked"
  | "expired";

type ReceivedInvitationRow = {
  invitation_id: string;
  invitation_status: InvitationStatus;
  invitation_message: string | null;
  invitation_expires_at: string;
  invitation_created_at: string;
  intent_id: string;
  plan_id: string | null;
  intent_owner_full_name: string | null;
  intent_owner_username: string | null;
  intent_owner_avatar_url: string | null;
  activity_name: string;
  category_name: string;
  city: string;
  district: string;
  start_date: string;
  end_date: string;
};

type SentInvitationRow = {
  invitation_id: string;
  invitation_status: InvitationStatus;
  invitation_message: string | null;
  invitation_expires_at: string;
  invitation_created_at: string;
  intent_id: string;
  plan_id: string | null;
  invited_user_full_name: string | null;
  invited_user_username: string | null;
  invited_user_avatar_url: string | null;
  activity_name: string;
  category_name: string;
  city: string;
  district: string;
  start_date: string;
  end_date: string;
};

type PageProps = {
  searchParams: Promise<{
    view?: string | string[];
  }>;
};

function getParam(
  value: string | string[] | undefined
) {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
}

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function statusLabel(status: InvitationStatus) {
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "revoked") return "Revoked";
  if (status === "expired") return "Expired";
  return "Pending";
}

function statusClasses(status: InvitationStatus) {
  if (status === "accepted") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "declined") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-gray-200 bg-gray-100 text-gray-600";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function ReceivedCard({
  invitation,
}: {
  invitation: ReceivedInvitationRow;
}) {
  const ownerName =
    invitation.intent_owner_full_name ||
    invitation.intent_owner_username ||
    "UIN member";

  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        {invitation.intent_owner_avatar_url ? (
          <img
            src={invitation.intent_owner_avatar_url}
            alt={ownerName}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-50 text-2xl font-bold text-purple-700">
            {getInitial(ownerName)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
              Intent Invitation
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                invitation.invitation_status
              )}`}
            >
              {statusLabel(invitation.invitation_status)}
            </span>
          </div>

          <h2 className="mt-4 text-2xl font-bold text-gray-950">
            {invitation.activity_name}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {invitation.category_name}
          </p>
          <p className="mt-4 text-sm text-gray-600">
            Invited by <span className="font-semibold text-gray-900">{ownerName}</span>
            {invitation.intent_owner_username
              ? ` · @${invitation.intent_owner_username}`
              : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Availability
          </p>
          <p className="mt-2 font-semibold text-gray-900">
            {invitation.start_date} → {invitation.end_date}
          </p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Area
          </p>
          <p className="mt-2 font-semibold text-gray-900">
            {invitation.district}, {invitation.city}
          </p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Role
          </p>
          <p className="mt-2 font-semibold text-gray-900">Participant</p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Expires
          </p>
          <p className="mt-2 font-semibold text-gray-900">
            {formatDate(invitation.invitation_expires_at)}
          </p>
        </div>
      </div>

      {invitation.invitation_message && (
        <div className="mt-5 rounded-2xl border border-purple-100 bg-purple-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
            Message
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-purple-950">
            {invitation.invitation_message}
          </p>
        </div>
      )}

      {invitation.invitation_status === "pending" ? (
        <IntentInvitationActions
          invitationId={invitation.invitation_id}
          activityName={invitation.activity_name}
        />
      ) : invitation.invitation_status === "accepted" && invitation.plan_id ? (
        <Link
          href={`/plans/${encodeURIComponent(invitation.plan_id)}/planning`}
          className="mt-6 block rounded-xl bg-green-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-green-700"
        >
          Open Shared Plan
        </Link>
      ) : null}
    </article>
  );
}

function SentCard({
  invitation,
}: {
  invitation: SentInvitationRow;
}) {
  const invitedName =
    invitation.invited_user_full_name ||
    invitation.invited_user_username ||
    "UIN member";

  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        {invitation.invited_user_avatar_url ? (
          <img
            src={invitation.invited_user_avatar_url}
            alt={invitedName}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold text-gray-500">
            {getInitial(invitedName)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-gray-950 px-3 py-1 text-xs font-semibold text-white">
              Sent Invitation
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                invitation.invitation_status
              )}`}
            >
              {statusLabel(invitation.invitation_status)}
            </span>
          </div>

          <h2 className="mt-4 text-2xl font-bold text-gray-950">
            {invitation.activity_name}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {invitation.category_name}
          </p>
          <p className="mt-4 text-sm text-gray-600">
            Sent to <span className="font-semibold text-gray-900">{invitedName}</span>
            {invitation.invited_user_username
              ? ` · @${invitation.invited_user_username}`
              : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Availability
          </p>
          <p className="mt-2 font-semibold text-gray-900">
            {invitation.start_date} → {invitation.end_date}
          </p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Area
          </p>
          <p className="mt-2 font-semibold text-gray-900">
            {invitation.district}, {invitation.city}
          </p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Sent
          </p>
          <p className="mt-2 font-semibold text-gray-900">
            {formatDate(invitation.invitation_created_at)}
          </p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Expires
          </p>
          <p className="mt-2 font-semibold text-gray-900">
            {formatDate(invitation.invitation_expires_at)}
          </p>
        </div>
      </div>

      {invitation.invitation_message && (
        <div className="mt-5 rounded-2xl bg-gray-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Message
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">
            {invitation.invitation_message}
          </p>
        </div>
      )}

      {invitation.invitation_status === "pending" && (
        <IntentInvitationRevokeButton
          invitationId={invitation.invitation_id}
          invitedName={invitedName}
        />
      )}

      {invitation.invitation_status === "accepted" && invitation.plan_id && (
        <Link
          href={`/plans/${encodeURIComponent(invitation.plan_id)}/planning`}
          className="mt-5 block rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-center text-sm font-semibold text-green-700 transition hover:bg-green-100"
        >
          Open Shared Plan
        </Link>
      )}
    </article>
  );
}

export default async function IntentInvitationsPage({
  searchParams,
}: PageProps) {
  const resolved = await searchParams;
  const selectedView =
    getParam(resolved.view) === "sent"
      ? "sent"
      : "received";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [receivedResponse, sentResponse] = await Promise.all([
    supabase.rpc("get_my_received_intent_invitations"),
    supabase.rpc("get_my_sent_intent_invitations"),
  ]);

  if (receivedResponse.error) {
    console.error("Received Intent invitation query failed:", receivedResponse.error);
  }

  if (sentResponse.error) {
    console.error("Sent Intent invitation query failed:", sentResponse.error);
  }

  const received = (receivedResponse.data ?? []) as ReceivedInvitationRow[];
  const sent = (sentResponse.data ?? []) as SentInvitationRow[];
  const pendingReceived = received.filter((item) => item.invitation_status === "pending").length;
  const pendingSent = sent.filter((item) => item.invitation_status === "pending").length;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/timeline" className="text-sm font-semibold text-gray-600 transition hover:text-green-700">
            <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
          </Link>
          <Link href="/requests" className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700">
            Match Requests
          </Link>
        </div>

        <header className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
            Direct Invitations
          </p>
          <h1 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">
            Intent Invitations
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
            A direct invitation does not make another person an owner of your personal Intent. Acceptance creates or joins a Shared Plan where the person becomes a Participant.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link
              href="/intent-invitations?view=received"
              className={`rounded-2xl px-5 py-4 text-center transition ${
                selectedView === "received"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide">Received</p>
              <p className="mt-2 text-2xl font-bold">{pendingReceived}</p>
            </Link>

            <Link
              href="/intent-invitations?view=sent"
              className={`rounded-2xl px-5 py-4 text-center transition ${
                selectedView === "sent"
                  ? "bg-gray-950 text-white shadow-sm"
                  : "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide">Sent</p>
              <p className="mt-2 text-2xl font-bold">{pendingSent}</p>
            </Link>
          </div>
        </header>

        <section className="mt-8">
          <h2 className="text-2xl font-bold text-gray-950">
            {selectedView === "received" ? "Received Invitations" : "Sent Invitations"}
          </h2>

          {selectedView === "received" ? (
            receivedResponse.error ? (
              <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
                {receivedResponse.error.message}
              </div>
            ) : received.length > 0 ? (
              <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {received.map((invitation) => (
                  <ReceivedCard key={invitation.invitation_id} invitation={invitation} />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
                <h3 className="text-xl font-bold text-gray-950">No Intent invitations</h3>
              </div>
            )
          ) : sentResponse.error ? (
            <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
              {sentResponse.error.message}
            </div>
          ) : sent.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {sent.map((invitation) => (
                <SentCard key={invitation.invitation_id} invitation={invitation} />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <h3 className="text-xl font-bold text-gray-950">No sent invitations</h3>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
