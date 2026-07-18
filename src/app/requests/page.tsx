import Link from "next/link";
import { redirect } from "next/navigation";

import ProfileNameLink from "../../components/profile/ProfileNameLink";
import LeaveActivityButton from "../../components/requests/LeaveActivityButton";
import RequestActionButtons from "../../components/requests/RequestActionButtons";
import { createClient } from "../../utils/supabase/server";

type RequestStatus =
  | "pending"
  | "accepted"
  | "rejected";

type DeclineReason =
  | "plans_changed"
  | "capacity_complete"
  | "dates_incompatible"
  | "group_format"
  | "accepted_another"
  | "prefer_not_to_say";

type IntentStatus =
  | "active"
  | "planned"
  | "completed"
  | "cancelled";

type RecruitmentStatus =
  | "open"
  | "full"
  | "closed";

type RequestDirection =
  | "incoming"
  | "sent";

type ParticipationStatus =
  | "active"
  | "removed"
  | "withdrawn";

type WithdrawalReason =
  | "plans_changed"
  | "unexpected_event"
  | "no_longer_available"
  | "joined_by_mistake"
  | "prefer_not_to_say";

type RemovalReason =
  | "participant_withdrew"
  | "plans_changed"
  | "no_response"
  | "group_changed"
  | "other";

type IntentRequest = {
  id: string;
  requester_id: string;
  receiver_id: string;
  own_intent_id: string;
  target_intent_id: string;
  status: RequestStatus;
  message: string | null;
  decline_reason: DeclineReason | null;
  declined_at: string | null;
  created_at: string;
};

type RequestProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type RequestLocation = {
  city: string;
  district: string;
};

type RequestActivityCategory = {
  name: string;
};

type RequestActivity = {
  name: string;
  activity_categories:
    | RequestActivityCategory
    | RequestActivityCategory[]
    | null;
};

type RequestIntent = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  status: IntentStatus;
  recruitment_status: RecruitmentStatus;
  max_participants: number | null;
  locations:
    | RequestLocation
    | RequestLocation[]
    | null;
  activities:
    | RequestActivity
    | RequestActivity[]
    | null;
};

type RequestParticipation = {
  id: string;
  source_request_id: string | null;
  user_id: string;
  status: ParticipationStatus;
  withdrawal_reason: WithdrawalReason | null;
  withdrawn_at: string | null;
  removal_reason: RemovalReason | null;
  removed_at: string | null;
};

type AvailabilityResult = {
  label: string;
  classes: string;
  canAccept: boolean;
  unavailableReason: string | null;
};

function getFirst<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function getDeclineReasonLabel(
  reason: DeclineReason | null
) {
  if (reason === "plans_changed") {
    return "The participant’s plans changed.";
  }

  if (reason === "capacity_complete") {
    return "The participant capacity is complete.";
  }

  if (reason === "dates_incompatible") {
    return "The dates are no longer compatible.";
  }

  if (reason === "group_format") {
    return "The group format is not suitable.";
  }

  if (reason === "accepted_another") {
    return "Another matching request was accepted.";
  }

  return "No specific reason was provided.";
}

function getWithdrawalReasonLabel(
  reason: WithdrawalReason | null
) {
  if (reason === "plans_changed") {
    return "The participant’s plans changed.";
  }

  if (reason === "unexpected_event") {
    return "Something unexpected happened.";
  }

  if (reason === "no_longer_available") {
    return "The participant is no longer available.";
  }

  if (reason === "joined_by_mistake") {
    return "The participant joined by mistake.";
  }

  return "No specific reason was provided.";
}

function getRemovalReasonLabel(
  reason: RemovalReason | null
) {
  if (reason === "participant_withdrew") {
    return "The participant asked to leave.";
  }

  if (reason === "plans_changed") {
    return "The plans changed.";
  }

  if (reason === "no_response") {
    return "The participant was not responding.";
  }

  if (reason === "group_changed") {
    return "The group plan changed.";
  }

  return "Another reason was selected.";
}

function getRequestStatusClasses(
  status: RequestStatus
) {
  if (status === "accepted") {
    return "bg-green-50 text-green-700";
  }

  if (status === "rejected") {
    return "bg-red-50 text-red-700";
  }

  return "bg-amber-50 text-amber-700";
}

function getRequestStatusLabel(
  status: RequestStatus
) {
  if (status === "rejected") {
    return "Declined";
  }

  if (status === "accepted") {
    return "Accepted";
  }

  return "Pending";
}

function getIntentAvailability(
  intent: RequestIntent | null
): AvailabilityResult {
  if (!intent) {
    return {
      label: "Intent unavailable",
      classes: "bg-gray-100 text-gray-600",
      canAccept: false,
      unavailableReason:
        "The related Intent could not be found.",
    };
  }

  if (intent.status === "planned") {
    return {
      label: "Planned",
      classes: "bg-blue-50 text-blue-700",
      canAccept: false,
      unavailableReason:
        "This Activity has already been planned.",
    };
  }

  if (intent.status === "completed") {
    return {
      label: "Completed",
      classes: "bg-purple-50 text-purple-700",
      canAccept: false,
      unavailableReason:
        "This Activity has already been completed.",
    };
  }

  if (intent.status === "cancelled") {
    return {
      label: "Cancelled",
      classes: "bg-red-50 text-red-700",
      canAccept: false,
      unavailableReason:
        "This Intent has been cancelled.",
    };
  }

  if (intent.recruitment_status === "full") {
    return {
      label: "Capacity Full",
      classes: "bg-amber-50 text-amber-700",
      canAccept: false,
      unavailableReason:
        "Participant capacity is full.",
    };
  }

  if (
    intent.recruitment_status === "closed"
  ) {
    return {
      label: "Recruitment Closed",
      classes: "bg-gray-100 text-gray-700",
      canAccept: false,
      unavailableReason:
        "Recruitment is currently closed.",
    };
  }

  return {
    label: "Open",
    classes: "bg-green-50 text-green-700",
    canAccept: true,
    unavailableReason: null,
  };
}

function RequestStatusBadge({
  status,
}: {
  status: RequestStatus;
}) {
  return (
    <span
      className={`rounded-full px-4 py-2 text-xs font-semibold ${getRequestStatusClasses(
        status
      )}`}
    >
      {getRequestStatusLabel(status)}
    </span>
  );
}

export default async function RequestsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data: requestData,
    error: requestError,
  } = await supabase
    .from("intent_requests")
    .select(`
      id,
      requester_id,
      receiver_id,
      own_intent_id,
      target_intent_id,
      status,
      message,
      decline_reason,
      declined_at,
      created_at
    `)
    .or(
      `requester_id.eq.${user.id},receiver_id.eq.${user.id}`
    )
    .order("created_at", {
      ascending: false,
    });

  if (requestError) {
    console.error(
      "Requests query failed:",
      requestError
    );
  }

  const requests =
    (requestData ?? []) as IntentRequest[];

  const profileIds = Array.from(
    new Set(
      requests.flatMap(
        (request) => [
          request.requester_id,
          request.receiver_id,
        ]
      )
    )
  );

  const intentIds = Array.from(
    new Set(
      requests.flatMap(
        (request) => [
          request.own_intent_id,
          request.target_intent_id,
        ]
      )
    )
  );

  const acceptedRequestIds =
    requests
      .filter(
        (request) =>
          request.status ===
          "accepted"
      )
      .map(
        (request) =>
          request.id
      );

  let profiles: RequestProfile[] = [];

  let intents: RequestIntent[] = [];

  let participations:
    RequestParticipation[] = [];

  if (profileIds.length > 0) {
    const {
      data: profileData,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        username,
        avatar_url
      `)
      .in("id", profileIds);

    if (profileError) {
      console.error(
        "Request profiles query failed:",
        profileError
      );
    }

    profiles =
      (profileData ??
        []) as RequestProfile[];
  }

  if (intentIds.length > 0) {
    const {
      data: intentData,
      error: intentError,
    } = await supabase
      .from("intents")
      .select(`
        id,
        user_id,
        start_date,
        end_date,
        status,
        recruitment_status,
        max_participants,
        locations (
          city,
          district
        ),
        activities (
          name,
          activity_categories (
            name
          )
        )
      `)
      .in("id", intentIds);

    if (intentError) {
      console.error(
        "Request intents query failed:",
        intentError
      );
    }

    intents =
      (
        intentData ?? []
      ) as unknown as RequestIntent[];
  }

  if (
    acceptedRequestIds.length > 0
  ) {
    const {
      data: participationData,
      error: participationError,
    } = await supabase
      .from(
        "intent_participants"
      )
      .select(`
        id,
        source_request_id,
        user_id,
        status,
        withdrawal_reason,
        withdrawn_at,
        removal_reason,
        removed_at
      `)
      .in(
        "source_request_id",
        acceptedRequestIds
      );

    if (participationError) {
      console.error(
        "Request participation query failed:",
        participationError
      );
    }

    participations =
      (
        participationData ?? []
      ) as RequestParticipation[];
  }

  const profileById =
    new Map(
      profiles.map(
        (profile) => [
          profile.id,
          profile,
        ]
      )
    );

  const intentById =
    new Map(
      intents.map(
        (intent) => [
          intent.id,
          intent,
        ]
      )
    );

  const participationByRequestId =
    new Map<
      string,
      RequestParticipation
    >();

  participations.forEach(
    (participation) => {
      if (
        participation.source_request_id
      ) {
        participationByRequestId.set(
          participation.source_request_id,
          participation
        );
      }
    }
  );

  const pendingIncomingRequests =
    requests.filter(
      (request) =>
        request.receiver_id ===
          user.id &&
        request.status ===
          "pending"
    );

  const pendingSentRequests =
    requests.filter(
      (request) =>
        request.requester_id ===
          user.id &&
        request.status ===
          "pending"
    );

  const acceptedRequests =
    requests.filter(
      (request) =>
        request.status ===
        "accepted"
    );

  const declinedRequests =
    requests.filter(
      (request) =>
        request.status ===
        "rejected"
    );

  const getRequestDirection = (
    request: IntentRequest
  ): RequestDirection => {
    return request.requester_id ===
      user.id
      ? "sent"
      : "incoming";
  };

  const renderRequestCard = (
    request: IntentRequest,
    direction: RequestDirection
  ) => {
    const relatedProfileId =
      direction === "incoming"
        ? request.requester_id
        : request.receiver_id;

    const relatedProfile =
      profileById.get(
        relatedProfileId
      ) ?? null;

    const relatedName =
      relatedProfile?.full_name ??
      "UIN member";

    const requesterIntent =
      intentById.get(
        request.own_intent_id
      ) ?? null;

    const targetIntent =
      intentById.get(
        request.target_intent_id
      ) ?? null;

    const requesterActivity =
      getFirst(
        requesterIntent?.activities
      );

    const requesterCategory =
      getFirst(
        requesterActivity
          ?.activity_categories
      );

    const requesterLocation =
      getFirst(
        requesterIntent?.locations
      );

    const targetActivity =
      getFirst(
        targetIntent?.activities
      );

    const targetCategory =
      getFirst(
        targetActivity
          ?.activity_categories
      );

    const targetLocation =
      getFirst(
        targetIntent?.locations
      );

    const participation =
      participationByRequestId.get(
        request.id
      ) ?? null;

    const availability =
      getIntentAvailability(
        targetIntent
      );

    const profileInitial =
      relatedName
        .trim()
        .charAt(0)
        .toUpperCase() || "?";

    const requestDirectionLabel =
      direction === "incoming"
        ? "Received from"
        : "Sent to";

    const canLeaveActivity =
      direction === "sent" &&
      request.status ===
        "accepted" &&
      participation?.status ===
        "active" &&
      targetIntent !== null &&
      targetIntent.status !==
        "completed" &&
      targetIntent.status !==
        "cancelled";

    return (
      <article
        key={request.id}
        className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <ProfileNameLink
            username={
              relatedProfile?.username
            }
            title={`View ${relatedName}'s profile`}
            className="group flex w-fit items-center gap-4 rounded-2xl transition hover:bg-green-50"
          >
            <div className="shrink-0">
              {relatedProfile?.avatar_url ? (
                <img
                  src={
                    relatedProfile.avatar_url
                  }
                  alt={relatedName}
                  className="h-14 w-14 rounded-full object-cover transition group-hover:ring-2 group-hover:ring-green-300"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-500 transition group-hover:bg-green-100 group-hover:text-green-700">
                  {profileInitial}
                </div>
              )}
            </div>

            <div className="pr-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                {requestDirectionLabel}
              </p>

              <h3 className="mt-1 text-xl font-bold text-gray-900 transition group-hover:text-green-700 group-hover:underline group-hover:underline-offset-4">
                {relatedName}
              </h3>

              {relatedProfile?.username && (
                <p className="mt-1 text-sm text-gray-500 transition group-hover:text-green-600">
                  @
                  {
                    relatedProfile.username
                  }
                </p>
              )}
            </div>
          </ProfileNameLink>

          <div className="flex flex-wrap gap-2">
            <RequestStatusBadge
              status={request.status}
            />

            <span
              className={`rounded-full px-4 py-2 text-xs font-semibold ${availability.classes}`}
            >
              {availability.label}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm font-semibold text-gray-500">
              Requester&apos;s Intent
            </p>

            <h4 className="mt-3 font-bold text-gray-900">
              {requesterActivity?.name ??
                "Unknown Activity"}
            </h4>

            <p className="mt-1 text-sm text-gray-500">
              {requesterCategory?.name ??
                "Unknown Category"}
            </p>

            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <p>
                📅{" "}
                {requesterIntent?.start_date ??
                  "-"}{" "}
                →{" "}
                {requesterIntent?.end_date ??
                  "-"}
              </p>

              <p>
                📍{" "}
                {requesterLocation?.district ??
                  "Unknown District"}
                ,{" "}
                {requesterLocation?.city ??
                  "Unknown City"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm font-semibold text-gray-500">
              Target Intent
            </p>

            <h4 className="mt-3 font-bold text-gray-900">
              {targetActivity?.name ??
                "Unknown Activity"}
            </h4>

            <p className="mt-1 text-sm text-gray-500">
              {targetCategory?.name ??
                "Unknown Category"}
            </p>

            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <p>
                📅{" "}
                {targetIntent?.start_date ??
                  "-"}{" "}
                →{" "}
                {targetIntent?.end_date ??
                  "-"}
              </p>

              <p>
                📍{" "}
                {targetLocation?.district ??
                  "Unknown District"}
                ,{" "}
                {targetLocation?.city ??
                  "Unknown City"}
              </p>

              <p>
                👥 Capacity:{" "}
                {targetIntent
                  ?.max_participants ===
                null
                  ? "Unlimited"
                  : targetIntent
                      ?.max_participants ??
                    "-"}
              </p>
            </div>
          </div>
        </div>

        {request.message && (
          <div className="mt-5 rounded-2xl border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-500">
              Message
            </p>

            <p className="mt-2 text-gray-700">
              {request.message}
            </p>
          </div>
        )}

        {direction === "incoming" &&
          request.status ===
            "pending" && (
            <RequestActionButtons
              requestId={request.id}
              canAccept={
                availability.canAccept
              }
              unavailableReason={
                availability.unavailableReason
              }
            />
          )}

        {request.status ===
          "accepted" &&
          (
            !participation ||
            participation.status ===
              "active"
          ) && (
            <div className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              {direction === "sent"
                ? "Your participation request was accepted."
                : "You accepted this participation request."}
            </div>
          )}

        {canLeaveActivity &&
          participation && (
            <LeaveActivityButton
              participantId={
                participation.id
              }
              activityName={
                targetActivity?.name ??
                "this Activity"
              }
            />
          )}

        {request.status ===
          "accepted" &&
          participation?.status ===
            "withdrawn" && (
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-5">
              <p className="font-semibold text-amber-800">
                {direction === "sent"
                  ? "You left this Activity."
                  : `${relatedName} left this Activity.`}
              </p>

              <div className="mt-3 rounded-xl bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Reason
                </p>

                <p className="mt-1 text-sm text-gray-700">
                  {getWithdrawalReasonLabel(
                    participation.withdrawal_reason
                  )}
                </p>
              </div>
            </div>
          )}

        {request.status ===
          "accepted" &&
          participation?.status ===
            "removed" && (
            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <p className="font-semibold text-gray-800">
                {direction === "sent"
                  ? "The Intent owner removed you from this Activity."
                  : "You removed this participant from the Activity."}
              </p>

              <div className="mt-3 rounded-xl bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Reason
                </p>

                <p className="mt-1 text-sm text-gray-700">
                  {getRemovalReasonLabel(
                    participation.removal_reason
                  )}
                </p>
              </div>
            </div>
          )}

        {request.status ===
          "rejected" && (
            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-5">
              <p className="font-semibold text-red-700">
                {direction === "sent"
                  ? "Your participation request was declined."
                  : "You declined this participation request."}
              </p>

              <div className="mt-3 rounded-xl bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Reason
                </p>

                <p className="mt-1 text-sm text-gray-700">
                  {getDeclineReasonLabel(
                    request.decline_reason
                  )}
                </p>
              </div>

              <p className="mt-3 text-xs leading-5 text-red-600">
                This decision does not
                affect UIN reputation.
              </p>
            </div>
          )}
      </article>
    );
  };

  const renderEmptyState = (
    message: string
  ) => (
    <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center text-gray-500">
      {message}
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="text-center">
          <img
            src="/uin-logo.png"
            alt="uin? logo"
            className="mx-auto h-16 w-auto"
          />

          <h1 className="mt-8 text-4xl font-bold text-gray-900">
            Intent Requests
          </h1>

          <p className="mt-3 text-gray-500">
            Review pending requests,
            participation and request
            history.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/timeline"
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:border-green-500"
            >
              Timeline
            </Link>

            <Link
              href="/matches"
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:border-green-500"
            >
              View Matches
            </Link>

            <Link
              href="/onboarding"
              className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700"
            >
              Create New Intent
            </Link>
          </div>
        </header>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900">
            Incoming Requests
          </h2>

          <div className="mt-6 space-y-6">
            {pendingIncomingRequests.map(
              (request) =>
                renderRequestCard(
                  request,
                  "incoming"
                )
            )}

            {pendingIncomingRequests.length ===
              0 &&
              renderEmptyState(
                "No pending incoming requests."
              )}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-gray-900">
            Sent Requests
          </h2>

          <div className="mt-6 space-y-6">
            {pendingSentRequests.map(
              (request) =>
                renderRequestCard(
                  request,
                  "sent"
                )
            )}

            {pendingSentRequests.length ===
              0 &&
              renderEmptyState(
                "No pending sent requests."
              )}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-gray-900">
            Accepted Requests
          </h2>

          <div className="mt-6 space-y-6">
            {acceptedRequests.map(
              (request) =>
                renderRequestCard(
                  request,
                  getRequestDirection(
                    request
                  )
                )
            )}

            {acceptedRequests.length ===
              0 &&
              renderEmptyState(
                "No accepted requests yet."
              )}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-gray-900">
            Declined Requests
          </h2>

          <div className="mt-6 space-y-6">
            {declinedRequests.map(
              (request) =>
                renderRequestCard(
                  request,
                  getRequestDirection(
                    request
                  )
                )
            )}

            {declinedRequests.length ===
              0 &&
              renderEmptyState(
                "No declined requests."
              )}
          </div>
        </section>
      </div>
    </main>
  );
}