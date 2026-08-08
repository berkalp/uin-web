"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type AttendanceStatus = "pending" | "attended" | "no_show";
type MemberRole = "host" | "co_host" | "participant";

export type CompletionPlanData = {
  id: string;
  title: string | null;
  status: "forming" | "planned" | "completed" | "cancelled";
  host_user_id: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  timezone: string;
  window_start: string | null;
  window_end: string | null;
  meeting_point: string | null;
  meeting_address_text: string | null;
  activity_location_name: string | null;
  activity_address_text: string | null;
  meeting_location_same_as_activity: boolean;
  intent_notes: string | null;
  schedule_notes: string | null;
  cancellation_reason: string | null;
  actor_role: "host" | "co_host";
  activity_name: string | null;
  category_name: string | null;
  city: string | null;
  district: string | null;
};

export type CompletionMemberData = {
  member_id: string;
  user_id: string;
  role: MemberRole;
  status: "active";
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  attendance_status: AttendanceStatus | "cancelled";
  attendance_updated_at: string | null;
  attendance_updated_by: string | null;
};

type PlanCompletionReviewProps = {
  plan: CompletionPlanData;
  members: CompletionMemberData[];
  outcomeUnknown?: boolean;
};

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The Activity outcome could not be saved.";
}

function getRoleLabel(role: MemberRole) {
  if (role === "host") return "Primary Host";
  if (role === "co_host") return "Co-host";
  return "Participant";
}

function formatSchedule(value: string | null, timezone: string) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  } catch {
    return date.toLocaleString("en-GB");
  }
}

function formatDateOnly(value: string | null, timezone: string) {
  if (!value) return "Not available";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return value;
  }
}

function joinLocation(primary: string | null, secondary: string | null) {
  const values = [primary, secondary].map((value) => value?.trim()).filter(Boolean);
  return values.length > 0 ? values.join(" · ") : "Not recorded";
}

export default function PlanCompletionReview({
  plan,
  members,
  outcomeUnknown = false,
}: PlanCompletionReviewProps) {
  const router = useRouter();

  const initialAttendance = useMemo(() => {
    const result: Record<string, AttendanceStatus> = {};

    members.forEach((member) => {
      result[member.user_id] =
        member.attendance_status === "attended" || member.attendance_status === "no_show"
          ? member.attendance_status
          : "pending";
    });

    return result;
  }, [members]);

  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(
    initialAttendance
  );
  const [cancellationReason, setCancellationReason] = useState("");
  const [showNotHappened, setShowNotHappened] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const counts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = {
      attended: 0,
      no_show: 0,
      pending: 0,
    };

    (Object.values(attendance) as AttendanceStatus[]).forEach((status) => {
      result[status] += 1;
    });

    return result;
  }, [attendance]);

  const confirmedSchedule = `${formatSchedule(plan.scheduled_start, plan.timezone)} → ${formatSchedule(
    plan.scheduled_end,
    plan.timezone
  )}`;
  const originalIntentWindow = `${formatDateOnly(plan.window_start, plan.timezone)} → ${formatDateOnly(
    plan.window_end,
    plan.timezone
  )}`;
  const meetingPoint = joinLocation(plan.meeting_point, plan.meeting_address_text);
  const activityLocation = plan.meeting_location_same_as_activity
    ? meetingPoint
    : joinLocation(plan.activity_location_name, plan.activity_address_text);
  const intentArea = [plan.district, plan.city].filter(Boolean).join(", ") || "Not recorded";

  async function completeActivity() {
    setIsWorking(true);
    setErrorMessage("");

    try {
      const records = members.map((member) => ({
        user_id: member.user_id,
        status: attendance[member.user_id] ?? "pending",
      }));

      const { error } = await supabase.rpc("complete_shared_plan", {
        p_plan_id: plan.id,
        p_attendance: records,
      });

      if (error) throw error;

      router.push(`/plans/${encodeURIComponent(plan.id)}/activity#activity-feedback`);
      router.refresh();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setIsWorking(false);
    }
  }

  async function markNotHappened() {
    const cleanedReason = cancellationReason.trim();

    if (!cleanedReason) {
      setErrorMessage("A reason is required.");
      return;
    }

    if (cleanedReason.length > 1000) {
      setErrorMessage("Reason cannot exceed 1000 characters.");
      return;
    }

    setIsWorking(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase.rpc("mark_shared_plan_not_happened_v2", {
        p_plan_id: plan.id,
        p_reason: cleanedReason,
      });

      if (error) throw error;

      if (
        typeof data === "object" &&
        data !== null &&
        "ok" in data &&
        data.ok === false
      ) {
        throw new Error(
          "message" in data && typeof data.message === "string"
            ? data.message
            : "The Activity could not be marked as not happened."
        );
      }

      router.push(`/plans/${encodeURIComponent(plan.id)}/activity`);
      router.refresh();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setIsWorking(false);
    }
  }

  return (
    <section
      id="attendance-review"
      className="scroll-mt-24 rounded-[30px] border border-amber-200 bg-white p-5 shadow-sm md:p-7"
    >
      <div className="flex flex-col gap-4 border-b border-gray-100 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            Activity Outcome
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950 md:text-3xl">
            Review Activity Outcome & Attendance
          </h2>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            Confirm what happened to this Activity. If it happened, record attendance and complete it.
            If it did not happen, the Primary Host can record that outcome with a reason.
          </p>
        </div>

        {outcomeUnknown && (
          <div className="max-w-md rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            <span className="font-bold text-slate-950">Outcome Unknown.</span> No final outcome was
            confirmed within seven days of the scheduled end. The Activity is archived from the active
            Timeline, but a Host or Co-host can still resolve it here later.
          </div>
        )}
      </div>

      <div className="mt-6 rounded-3xl border border-blue-200 bg-blue-50/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">
              Intent / Activity
            </p>
            <h3 className="mt-2 text-xl font-bold text-blue-950">{plan.title || plan.activity_name || "UIN Activity"}</h3>
            <p className="mt-1 text-sm font-medium text-blue-800">
              {[plan.category_name, plan.activity_name].filter(Boolean).join(" · ") || "Activity"}
            </p>
            {plan.intent_notes && (
              <div className="mt-3 max-w-3xl rounded-2xl border border-blue-100 bg-white/80 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Intent note</p>
                <p className="mt-1 text-sm font-medium leading-6 text-gray-900">{plan.intent_notes}</p>
              </div>
            )}
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3 text-right shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Original Intent window</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{originalIntentWindow}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-blue-100 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Confirmed schedule</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-gray-950">{confirmedSchedule}</p>
          </div>
          <div className="rounded-2xl border border-green-100 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-green-700">Activity location</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-gray-950">{activityLocation}</p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700">Meeting point</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-gray-950">{meetingPoint}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Intent area</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-gray-950">{intentArea}</p>
          </div>
        </div>

        {plan.schedule_notes && (
          <div className="mt-3 rounded-2xl bg-white/80 px-4 py-3 text-sm leading-6 text-gray-700">
            <span className="font-semibold text-gray-950">Schedule note:</span> {plan.schedule_notes}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div>
          <div className="space-y-4">
            {members.map((member) => {
              const displayName = member.full_name || member.username || "UIN member";
              const currentStatus = attendance[member.user_id] ?? "pending";

              return (
                <article key={member.member_id} className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={displayName}
                          className="h-14 w-14 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-xl font-bold text-gray-500 shadow-sm">
                          {getInitial(displayName)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-gray-950">{displayName}</p>
                        {member.username && <p className="mt-1 truncate text-sm text-gray-500">@{member.username}</p>}
                        <span className="mt-2 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                          {getRoleLabel(member.role)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:min-w-[430px]">
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => {
                          setAttendance((current) => ({ ...current, [member.user_id]: "attended" }));
                          setErrorMessage("");
                        }}
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          currentStatus === "attended"
                            ? "border-green-600 bg-green-600 text-white"
                            : "border-green-200 bg-white text-green-700 hover:bg-green-50"
                        }`}
                      >
                        Attended
                      </button>

                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => {
                          setAttendance((current) => ({ ...current, [member.user_id]: "no_show" }));
                          setErrorMessage("");
                        }}
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          currentStatus === "no_show"
                            ? "border-red-600 bg-red-600 text-white"
                            : "border-red-200 bg-white text-red-700 hover:bg-red-50"
                        }`}
                      >
                        Did Not Attend
                      </button>

                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => {
                          setAttendance((current) => ({ ...current, [member.user_id]: "pending" }));
                          setErrorMessage("");
                        }}
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          currentStatus === "pending"
                            ? "border-gray-700 bg-gray-700 text-white"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        Not Recorded
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">{errorMessage}</p>
            </div>
          )}

          <button
            type="button"
            disabled={isWorking}
            onClick={completeActivity}
            className="mt-5 w-full rounded-xl bg-green-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isWorking ? "Completing Activity..." : "Complete Activity"}
          </button>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Attendance Summary</p>
            <dl className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-green-50 p-4">
                <dt className="text-sm font-semibold text-green-700">Attended</dt>
                <dd className="text-2xl font-bold text-green-950">{counts.attended}</dd>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-red-50 p-4">
                <dt className="text-sm font-semibold text-red-700">Did not attend</dt>
                <dd className="text-2xl font-bold text-red-950">{counts.no_show}</dd>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-gray-100 p-4">
                <dt className="text-sm font-semibold text-gray-600">Not recorded</dt>
                <dd className="text-2xl font-bold text-gray-950">{counts.pending}</dd>
              </div>
            </dl>
          </section>

          {plan.actor_role === "host" && (
            <section className="rounded-3xl border border-red-200 bg-red-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Activity Did Not Happen</p>
              <h3 className="mt-2 text-lg font-bold text-red-950">Mark Activity as not happened</h3>
              <p className="mt-2 text-sm leading-6 text-red-700">
                This records a real-world outcome, not a return to planning. Attendance remains Not Recorded and linked Intents are detached safely before being reopened or expired.
              </p>

              {!showNotHappened ? (
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => {
                    setShowNotHappened(true);
                    setErrorMessage("");
                  }}
                  className="mt-4 w-full rounded-xl border border-red-300 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  It did not happen
                </button>
              ) : (
                <div className="mt-4">
                  <label className="block">
                    <span className="text-sm font-semibold text-red-900">Reason</span>
                    <textarea
                      value={cancellationReason}
                      disabled={isWorking}
                      maxLength={1000}
                      rows={5}
                      onChange={(event) => {
                        setCancellationReason(event.target.value);
                        setErrorMessage("");
                      }}
                      className="mt-2 w-full resize-y rounded-xl border border-red-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-red-500"
                    />
                    <p className="mt-2 text-right text-xs text-red-500">{cancellationReason.length}/1000</p>
                  </label>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => {
                        setShowNotHappened(false);
                        setCancellationReason("");
                        setErrorMessage("");
                      }}
                      className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700"
                    >
                      Keep unresolved
                    </button>
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={markNotHappened}
                      className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {isWorking ? "Updating..." : "Confirm outcome"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}
