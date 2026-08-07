"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import BadgeIcon from "@/components/badges/BadgeIcon";
import {
  BADGE_ICON_OPTIONS,
  BADGE_TONE_OPTIONS,
  getBadgeScopeLabel,
  getBadgeToneClasses,
  slugifyBadgeName,
  type AdminBadgeAssignment,
  type AdminBadgeCatalogue,
  type AdminBadgeDefinition,
  type AdminBadgeUser,
  type AdminBadgeUserAssignments,
  type BadgeAwardMode,
  type BadgeConfidence,
  type BadgeCriteriaRole,
  type BadgeIconKey,
  type BadgeScopeType,
  type BadgeTone,
} from "@/utils/badges";
import {
  supabase,
} from "@/utils/supabase/client";

type BadgeDraft = {
  slug: string;
  name: string;
  description: string;
  iconKey: BadgeIconKey;
  iconUrl: string;
  tone: BadgeTone;
  scopeType: BadgeScopeType;
  categoryId: string;
  activityId: string;
  awardMode: BadgeAwardMode;
  criteriaRole: BadgeCriteriaRole;
  minimumActivityCount: string;
  minimumAttendanceRate: string;
  minimumFeedbackCount: string;
  minimumWouldJoinAgainRate: string;
  dimensionKey: string;
  minimumDimensionScore: string;
  minimumDimensionResponses: string;
  minimumOverallScore: string;
  minimumConfidence: "" | BadgeConfidence;
  isPublic: boolean;
  allowManagedMinor: boolean;
  sortOrder: string;
};

const EMPTY_DRAFT: BadgeDraft = {
  slug: "",
  name: "",
  description: "",
  iconKey: "star",
  iconUrl: "",
  tone: "green",
  scopeType: "global",
  categoryId: "",
  activityId: "",
  awardMode: "manual",
  criteriaRole: "combined",
  minimumActivityCount: "",
  minimumAttendanceRate: "",
  minimumFeedbackCount: "",
  minimumWouldJoinAgainRate: "",
  dimensionKey: "",
  minimumDimensionScore: "",
  minimumDimensionResponses: "",
  minimumOverallScore: "",
  minimumConfidence: "",
  isPublic: true,
  allowManagedMinor: false,
  sortOrder: "100",
};

function nullableNumber(
  value: string
) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function toDraft(
  badge: AdminBadgeDefinition
): BadgeDraft {
  return {
    slug: badge.slug,
    name: badge.name,
    description:
      badge.description,
    iconKey: badge.icon_key,
    iconUrl:
      badge.icon_url ?? "",
    tone: badge.tone,
    scopeType:
      badge.scope_type,
    categoryId:
      badge.category_id ?? "",
    activityId:
      badge.activity_id ?? "",
    awardMode:
      badge.award_mode,
    criteriaRole:
      badge.criteria_role,
    minimumActivityCount:
      badge.minimum_activity_count ===
      null
        ? ""
        : String(
            badge.minimum_activity_count
          ),
    minimumAttendanceRate:
      badge.minimum_attendance_rate ===
      null
        ? ""
        : String(
            badge.minimum_attendance_rate
          ),
    minimumFeedbackCount:
      badge.minimum_feedback_count ===
      null
        ? ""
        : String(
            badge.minimum_feedback_count
          ),
    minimumWouldJoinAgainRate:
      badge.minimum_would_join_again_rate ===
      null
        ? ""
        : String(
            badge.minimum_would_join_again_rate
          ),
    dimensionKey:
      badge.dimension_key ?? "",
    minimumDimensionScore:
      badge.minimum_dimension_score ===
      null
        ? ""
        : String(
            badge.minimum_dimension_score
          ),
    minimumDimensionResponses:
      badge.minimum_dimension_responses ===
      null
        ? ""
        : String(
            badge.minimum_dimension_responses
          ),
    minimumOverallScore:
      badge.minimum_overall_score ===
      null
        ? ""
        : String(
            badge.minimum_overall_score
          ),
    minimumConfidence:
      badge.minimum_confidence ??
      "",
    isPublic: badge.is_public,
    allowManagedMinor:
      badge.allow_managed_minor,
    sortOrder: String(
      badge.sort_order
    ),
  };
}

function formatTimestamp(
  value: string | null
) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function BadgePreview({
  draft,
  categoryName,
  activityName,
}: {
  draft: BadgeDraft;
  categoryName: string | null;
  activityName: string | null;
}) {
  const tone = getBadgeToneClasses(
    draft.tone
  );

  return (
    <article
      className={`rounded-2xl border p-4 ${tone.wrapper}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}
        >
          <BadgeIcon
            iconKey={draft.iconKey}
            iconUrl={
              draft.iconUrl.trim() ||
              null
            }
            className="h-7 w-7"
            imageClassName="h-9 w-9 object-contain"
          />
        </div>

        <div className="min-w-0">
          <p className="font-bold">
            {draft.name ||
              "Badge name"}
          </p>

          <p className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-70">
            {getBadgeScopeLabel({
              scopeType:
                draft.scopeType,
              categoryName,
              activityName,
            })}
          </p>

          <p className="mt-2 text-sm leading-6 opacity-80">
            {draft.description ||
              "A concise explanation of what this badge recognises."}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function BadgeManager({
  catalogue,
}: {
  catalogue: AdminBadgeCatalogue;
}) {
  const router = useRouter();

  const [badges, setBadges] =
    useState(
      catalogue.badges
    );

  const [draft, setDraft] =
    useState<BadgeDraft>(
      EMPTY_DRAFT
    );

  const [editingBadgeId, setEditingBadgeId] =
    useState<string | null>(
      null
    );

  const [working, setWorking] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(
      null
    );

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [userQuery, setUserQuery] =
    useState("");

  const [userResults, setUserResults] =
    useState<AdminBadgeUser[]>(
      []
    );

  const [selectedUser, setSelectedUser] =
    useState<AdminBadgeUser | null>(
      null
    );

  const [assignments, setAssignments] =
    useState<AdminBadgeAssignment[]>(
      []
    );

  const [grantBadgeId, setGrantBadgeId] =
    useState("");

  const [awardNote, setAwardNote] =
    useState("");

  const [expiresAt, setExpiresAt] =
    useState("");

  useEffect(() => {
    setBadges(
      catalogue.badges
    );
  }, [catalogue.badges]);

  const visibleActivities =
    useMemo(
      () =>
        catalogue.activities.filter(
          (activity) =>
            !draft.categoryId ||
            activity.category_id ===
              draft.categoryId
        ),
      [
        catalogue.activities,
        draft.categoryId,
      ]
    );

  const selectedCategoryName =
    catalogue.categories.find(
      (category) =>
        category.id ===
        draft.categoryId
    )?.name ?? null;

  const selectedActivityName =
    catalogue.activities.find(
      (activity) =>
        activity.id ===
        draft.activityId
    )?.name ?? null;

  const activeBadges =
    badges.filter(
      (badge) =>
        badge.is_active &&
        badge.award_mode !==
          "automatic"
    );

  function resetMessages() {
    setMessage(null);
    setError(null);
  }

  function updateDraft<
    Key extends keyof BadgeDraft,
  >(
    key: Key,
    value: BadgeDraft[Key]
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setEditingBadgeId(null);
  }

  function startEdit(
    badge: AdminBadgeDefinition
  ) {
    setDraft(toDraft(badge));
    setEditingBadgeId(
      badge.id
    );
    resetMessages();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveBadge() {
    resetMessages();

    if (
      !draft.name.trim() ||
      !draft.slug.trim()
    ) {
      setError(
        "Badge name and slug are required."
      );
      return;
    }

    if (
      draft.scopeType !==
        "global" &&
      !draft.categoryId
    ) {
      setError(
        "Select a category for this badge scope."
      );
      return;
    }

    if (
      draft.scopeType ===
        "activity" &&
      !draft.activityId
    ) {
      setError(
        "Select an Activity for this badge scope."
      );
      return;
    }

    setWorking(true);

    const parameters = {
      p_slug:
        draft.slug.trim(),
      p_name:
        draft.name.trim(),
      p_description:
        draft.description.trim(),
      p_icon_key:
        draft.iconKey,
      p_icon_url:
        draft.iconUrl.trim() ||
        null,
      p_tone:
        draft.tone,
      p_scope_type:
        draft.scopeType,
      p_category_id:
        draft.categoryId ||
        null,
      p_activity_id:
        draft.activityId ||
        null,
      p_award_mode:
        draft.awardMode,
      p_criteria_role:
        draft.criteriaRole,
      p_minimum_activity_count:
        nullableNumber(
          draft.minimumActivityCount
        ),
      p_minimum_attendance_rate:
        nullableNumber(
          draft.minimumAttendanceRate
        ),
      p_minimum_feedback_count:
        nullableNumber(
          draft.minimumFeedbackCount
        ),
      p_minimum_would_join_again_rate:
        nullableNumber(
          draft.minimumWouldJoinAgainRate
        ),
      p_dimension_key:
        draft.dimensionKey.trim() ||
        null,
      p_minimum_dimension_score:
        nullableNumber(
          draft.minimumDimensionScore
        ),
      p_minimum_dimension_responses:
        nullableNumber(
          draft.minimumDimensionResponses
        ),
      p_minimum_overall_score:
        nullableNumber(
          draft.minimumOverallScore
        ),
      p_minimum_confidence:
        draft.minimumConfidence ||
        null,
      p_is_public:
        draft.isPublic,
      p_allow_managed_minor:
        draft.allowManagedMinor,
      p_sort_order:
        nullableNumber(
          draft.sortOrder
        ) ?? 100,
    };

    const result = editingBadgeId
      ? await supabase.rpc(
          "admin_update_badge",
          {
            p_badge_id:
              editingBadgeId,
            ...parameters,
          }
        )
      : await supabase.rpc(
          "admin_create_badge",
          parameters
        );

    setWorking(false);

    if (result.error) {
      setError(
        result.error.message
      );
      return;
    }

    setMessage(
      editingBadgeId
        ? "Badge updated."
        : "Badge created."
    );

    resetDraft();
    router.refresh();
  }

  async function toggleBadge(
    badge: AdminBadgeDefinition
  ) {
    resetMessages();
    setWorking(true);

    const { error: toggleError } =
      await supabase.rpc(
        "admin_set_badge_active",
        {
          p_badge_id:
            badge.id,
          p_is_active:
            !badge.is_active,
        }
      );

    setWorking(false);

    if (toggleError) {
      setError(
        toggleError.message
      );
      return;
    }

    setMessage(
      badge.is_active
        ? "Badge deactivated."
        : "Badge activated."
    );

    router.refresh();
  }

  async function refreshAllBadges() {
    resetMessages();
    setWorking(true);

    const {
      data,
      error: refreshError,
    } = await supabase.rpc(
      "admin_refresh_all_automatic_badges"
    );

    setWorking(false);

    if (refreshError) {
      setError(
        refreshError.message
      );
      return;
    }

    setMessage(
      `Automatic badges recalculated for ${Number(
        data ?? 0
      )} profiles.`
    );

    router.refresh();
  }

  async function searchUsers() {
    resetMessages();

    if (
      userQuery.trim().length < 2
    ) {
      setError(
        "Enter at least two characters to search."
      );
      return;
    }

    setWorking(true);

    const {
      data,
      error: searchError,
    } = await supabase.rpc(
      "admin_search_badge_users",
      {
        p_query:
          userQuery.trim(),
      }
    );

    setWorking(false);

    if (searchError) {
      setError(
        searchError.message
      );
      return;
    }

    setUserResults(
      (data ?? []) as AdminBadgeUser[]
    );
  }

  async function loadAssignments(
    user: AdminBadgeUser
  ) {
    resetMessages();
    setSelectedUser(user);
    setGrantBadgeId("");
    setAwardNote("");
    setExpiresAt("");
    setWorking(true);

    const {
      data,
      error: assignmentError,
    } = await supabase.rpc(
      "get_admin_user_badge_assignments",
      {
        p_user_id:
          user.user_id,
      }
    );

    setWorking(false);

    if (assignmentError) {
      setError(
        assignmentError.message
      );
      return;
    }

    const result =
      (data ?? {
        profile: null,
        assignments: [],
      }) as AdminBadgeUserAssignments;

    setAssignments(
      result.assignments
    );
  }

  async function reloadSelectedUser() {
    if (!selectedUser) {
      return;
    }

    await loadAssignments(
      selectedUser
    );
  }

  async function grantBadge() {
    resetMessages();

    if (
      !selectedUser ||
      !grantBadgeId
    ) {
      setError(
        "Select a person and a badge."
      );
      return;
    }

    setWorking(true);

    const { error: grantError } =
      await supabase.rpc(
        "admin_grant_badge",
        {
          p_badge_id:
            grantBadgeId,
          p_user_id:
            selectedUser.user_id,
          p_award_note:
            awardNote.trim() ||
            null,
          p_expires_at:
            expiresAt
              ? new Date(
                  `${expiresAt}T23:59:59`
                ).toISOString()
              : null,
        }
      );

    setWorking(false);

    if (grantError) {
      setError(
        grantError.message
      );
      return;
    }

    setMessage(
      "Badge awarded manually."
    );
    setAwardNote("");
    setExpiresAt("");
    await reloadSelectedUser();
    router.refresh();
  }

  async function revokeAssignment(
    assignment: AdminBadgeAssignment
  ) {
    resetMessages();

    const reason =
      window.prompt(
        assignment.source ===
          "automatic"
          ? "Reason for suppressing this automatic badge:"
          : "Reason for revoking this badge:",
        assignment.revoke_reason ??
          ""
      );

    if (reason === null) {
      return;
    }

    setWorking(true);

    const { error: revokeError } =
      await supabase.rpc(
        "admin_revoke_badge_assignment",
        {
          p_assignment_id:
            assignment.id,
          p_reason:
            reason.trim() ||
            null,
        }
      );

    setWorking(false);

    if (revokeError) {
      setError(
        revokeError.message
      );
      return;
    }

    setMessage(
      assignment.source ===
        "automatic"
        ? "Automatic badge suppressed for this person."
        : "Badge revoked."
    );

    await reloadSelectedUser();
    router.refresh();
  }

  async function restoreAssignment(
    assignment: AdminBadgeAssignment
  ) {
    resetMessages();
    setWorking(true);

    const { error: restoreError } =
      await supabase.rpc(
        "admin_restore_badge_assignment",
        {
          p_assignment_id:
            assignment.id,
        }
      );

    setWorking(false);

    if (restoreError) {
      setError(
        restoreError.message
      );
      return;
    }

    setMessage(
      assignment.source ===
        "automatic"
        ? "Automatic suppression removed and criteria rechecked."
        : "Badge restored."
    );

    await reloadSelectedUser();
    router.refresh();
  }

  async function refreshSelectedUser() {
    if (!selectedUser) {
      return;
    }

    resetMessages();
    setWorking(true);

    const { error: refreshError } =
      await supabase.rpc(
        "admin_refresh_user_badges",
        {
          p_user_id:
            selectedUser.user_id,
        }
      );

    setWorking(false);

    if (refreshError) {
      setError(
        refreshError.message
      );
      return;
    }

    setMessage(
      "This person's reputation and automatic badges were recalculated."
    );

    await reloadSelectedUser();
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {(message || error) && (
        <div
          className={`rounded-2xl border p-4 text-sm font-semibold ${
            error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              Badge definition
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              {editingBadgeId
                ? "Edit badge"
                : "Create badge"}
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Choose the icon, context and award method. Automatic badges use verified contextual reputation summaries; manual badges are awarded by an administrator.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshAllBadges}
            disabled={working}
            className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-semibold text-purple-800 transition hover:bg-purple-100 disabled:opacity-50"
          >
            Recalculate all automatic badges
          </button>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-xs font-semibold text-gray-600">
                  Badge name
                </span>
                <input
                  value={draft.name}
                  onChange={(event) => {
                    const name =
                      event.target.value;

                    setDraft((current) => ({
                      ...current,
                      name,
                      slug:
                        editingBadgeId ||
                        current.slug
                          ? current.slug
                          : slugifyBadgeName(
                              name
                            ),
                    }));
                  }}
                  placeholder="Reliable Participant"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                />
              </label>

              <label>
                <span className="text-xs font-semibold text-gray-600">
                  Slug
                </span>
                <input
                  value={draft.slug}
                  onChange={(event) =>
                    updateDraft(
                      "slug",
                      slugifyBadgeName(
                        event.target.value
                      )
                    )
                  }
                  placeholder="reliable-participant"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-gray-600">
                Description
              </span>
              <textarea
                value={draft.description}
                onChange={(event) =>
                  updateDraft(
                    "description",
                    event.target.value
                  )
                }
                rows={3}
                placeholder="Explain the verified pattern or contribution this badge recognises."
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label>
                <span className="text-xs font-semibold text-gray-600">
                  Icon
                </span>
                <select
                  value={draft.iconKey}
                  onChange={(event) =>
                    updateDraft(
                      "iconKey",
                      event.target.value as BadgeIconKey
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                >
                  {BADGE_ICON_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span className="text-xs font-semibold text-gray-600">
                  Tone
                </span>
                <select
                  value={draft.tone}
                  onChange={(event) =>
                    updateDraft(
                      "tone",
                      event.target.value as BadgeTone
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                >
                  {BADGE_TONE_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="md:col-span-2">
                <span className="text-xs font-semibold text-gray-600">
                  Custom icon URL, optional
                </span>
                <input
                  value={draft.iconUrl}
                  onChange={(event) =>
                    updateDraft(
                      "iconUrl",
                      event.target.value
                    )
                  }
                  placeholder="https://.../badge.svg"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label>
                <span className="text-xs font-semibold text-gray-600">
                  Scope
                </span>
                <select
                  value={draft.scopeType}
                  onChange={(event) => {
                    const scope =
                      event.target.value as BadgeScopeType;

                    setDraft((current) => ({
                      ...current,
                      scopeType: scope,
                      categoryId:
                        scope ===
                        "global"
                          ? ""
                          : current.categoryId,
                      activityId:
                        scope ===
                        "activity"
                          ? current.activityId
                          : "",
                    }));
                  }}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="global">
                    Global
                  </option>
                  <option value="category">
                    Category
                  </option>
                  <option value="activity">
                    Activity
                  </option>
                </select>
              </label>

              {draft.scopeType !==
                "global" && (
                <label>
                  <span className="text-xs font-semibold text-gray-600">
                    Category
                  </span>
                  <select
                    value={draft.categoryId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        categoryId:
                          event.target.value,
                        activityId: "",
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="">
                      Select category
                    </option>
                    {catalogue.categories.map(
                      (category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}

              {draft.scopeType ===
                "activity" && (
                <label>
                  <span className="text-xs font-semibold text-gray-600">
                    Activity
                  </span>
                  <select
                    value={draft.activityId}
                    onChange={(event) =>
                      updateDraft(
                        "activityId",
                        event.target.value
                      )
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="">
                      Select Activity
                    </option>
                    {visibleActivities.map(
                      (activity) => (
                        <option
                          key={activity.id}
                          value={activity.id}
                        >
                          {activity.name}
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}

              <label>
                <span className="text-xs font-semibold text-gray-600">
                  Award mode
                </span>
                <select
                  value={draft.awardMode}
                  onChange={(event) =>
                    updateDraft(
                      "awardMode",
                      event.target.value as BadgeAwardMode
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="manual">
                    Manual only
                  </option>
                  <option value="automatic">
                    Automatic only
                  </option>
                  <option value="both">
                    Automatic + manual
                  </option>
                </select>
              </label>
            </div>

            {draft.awardMode !==
              "manual" && (
              <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                    Automatic criteria
                  </p>
                  <p className="mt-2 text-sm leading-6 text-purple-900">
                    Empty conditions are ignored. The person must satisfy every condition you fill in.
                  </p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label>
                    <span className="text-xs font-semibold text-gray-600">
                      Reputation role
                    </span>
                    <select
                      value={draft.criteriaRole}
                      onChange={(event) =>
                        updateDraft(
                          "criteriaRole",
                          event.target.value as BadgeCriteriaRole
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="combined">
                        Combined
                      </option>
                      <option value="host">
                        Host
                      </option>
                      <option value="participant">
                        Participant
                      </option>
                    </select>
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-gray-600">
                      Minimum Activities
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={draft.minimumActivityCount}
                      onChange={(event) =>
                        updateDraft(
                          "minimumActivityCount",
                          event.target.value
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-sm"
                    />
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-gray-600">
                      Attendance rate %
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draft.minimumAttendanceRate}
                      onChange={(event) =>
                        updateDraft(
                          "minimumAttendanceRate",
                          event.target.value
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-sm"
                    />
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-gray-600">
                      Minimum feedback
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={draft.minimumFeedbackCount}
                      onChange={(event) =>
                        updateDraft(
                          "minimumFeedbackCount",
                          event.target.value
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-sm"
                    />
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-gray-600">
                      Would join again %
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draft.minimumWouldJoinAgainRate}
                      onChange={(event) =>
                        updateDraft(
                          "minimumWouldJoinAgainRate",
                          event.target.value
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-sm"
                    />
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-gray-600">
                      Overall score %
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draft.minimumOverallScore}
                      onChange={(event) =>
                        updateDraft(
                          "minimumOverallScore",
                          event.target.value
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-sm"
                    />
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-gray-600">
                      Confidence
                    </span>
                    <select
                      value={draft.minimumConfidence}
                      onChange={(event) =>
                        updateDraft(
                          "minimumConfidence",
                          event.target.value as "" | BadgeConfidence
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="">
                        Any confidence
                      </option>
                      <option value="low">
                        Low or higher
                      </option>
                      <option value="medium">
                        Medium or higher
                      </option>
                      <option value="high">
                        High only
                      </option>
                    </select>
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-gray-600">
                      Dimension key
                    </span>
                    <input
                      value={draft.dimensionKey}
                      onChange={(event) =>
                        updateDraft(
                          "dimensionKey",
                          event.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, "_")
                        )
                      }
                      placeholder="sportsmanship"
                      className="mt-1.5 w-full rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-sm"
                    />
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-gray-600">
                      Dimension score %
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draft.minimumDimensionScore}
                      onChange={(event) =>
                        updateDraft(
                          "minimumDimensionScore",
                          event.target.value
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-sm"
                    />
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-gray-600">
                      Dimension responses
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={draft.minimumDimensionResponses}
                      onChange={(event) =>
                        updateDraft(
                          "minimumDimensionResponses",
                          event.target.value
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-sm"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label>
                <span className="text-xs font-semibold text-gray-600">
                  Sort order
                </span>
                <input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(event) =>
                    updateDraft(
                      "sortOrder",
                      event.target.value
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 md:mt-6">
                <input
                  type="checkbox"
                  checked={draft.isPublic}
                  onChange={(event) =>
                    updateDraft(
                      "isPublic",
                      event.target.checked
                    )
                  }
                />
                <span className="text-sm font-semibold text-gray-700">
                  Show publicly
                </span>
              </label>

            </div>

            <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={saveBadge}
                disabled={working}
                className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
              >
                {working
                  ? "Saving..."
                  : editingBadgeId
                    ? "Save badge"
                    : "Create badge"}
              </button>

              {editingBadgeId && (
                <button
                  type="button"
                  onClick={resetDraft}
                  disabled={working}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </div>

          <aside>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Profile preview
            </p>

            <BadgePreview
              draft={draft}
              categoryName={
                selectedCategoryName
              }
              activityName={
                selectedActivityName
              }
            />

            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs leading-5 text-gray-600">
              Manual notes and administrator identities are never exposed on the public profile. Public viewers see only the badge, its context and whether it was earned automatically or awarded by UIN.
            </div>
          </aside>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
              Badge catalogue
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Defined badges
            </h2>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            {badges.length} definitions
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {badges.map((badge) => {
            const tone = getBadgeToneClasses(
              badge.tone
            );
            const categoryName =
              catalogue.categories.find(
                (category) =>
                  category.id ===
                  badge.category_id
              )?.name ?? null;
            const activityName =
              catalogue.activities.find(
                (activity) =>
                  activity.id ===
                  badge.activity_id
              )?.name ?? null;

            return (
              <article
                key={badge.id}
                className={`rounded-2xl border p-5 ${
                  badge.is_active
                    ? "border-gray-200 bg-white"
                    : "border-gray-200 bg-gray-50 opacity-65"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}
                  >
                    <BadgeIcon
                      iconKey={badge.icon_key}
                      iconUrl={badge.icon_url}
                      className="h-6 w-6"
                      imageClassName="h-8 w-8 object-contain"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-gray-950">
                        {badge.name}
                      </h3>

                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.wrapper}`}>
                        {getBadgeScopeLabel({
                          scopeType:
                            badge.scope_type,
                          categoryName,
                          activityName,
                        })}
                      </span>

                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                        {badge.award_mode}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {badge.description}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-gray-600">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1">
                        {badge.active_assignment_count} active
                      </span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                        {badge.automatic_assignment_count} automatic
                      </span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                        {badge.manual_assignment_count} manual
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      startEdit(badge)
                    }
                    disabled={working}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      toggleBadge(badge)
                    }
                    disabled={working}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                      badge.is_active
                        ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    {badge.is_active
                      ? "Deactivate"
                      : "Activate"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">
            Manual assignment
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Award or revoke a person&apos;s badge
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Search by name, username or email. Manual reasons are kept for administration and never shown on the public profile.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            value={userQuery}
            onChange={(event) =>
              setUserQuery(
                event.target.value
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void searchUsers();
              }
            }}
            placeholder="Search name, username or email"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm"
          />

          <button
            type="button"
            onClick={searchUsers}
            disabled={working}
            className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
          >
            Search people
          </button>
        </div>

        {userResults.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {userResults.map((user) => (
              <button
                key={user.user_id}
                type="button"
                onClick={() =>
                  loadAssignments(user)
                }
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:border-purple-300 ${
                  selectedUser?.user_id ===
                  user.user_id
                    ? "border-purple-300 bg-purple-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={
                      user.full_name ??
                      user.username
                    }
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-700">
                    {(user.full_name ??
                      user.username)
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-gray-950">
                    {user.full_name ??
                      user.username}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">
                    @{user.username}
                    {user.email
                      ? ` · ${user.email}`
                      : ""}
                  </span>
                  <span className="mt-1 block text-[11px] font-semibold text-purple-700">
                    {user.active_badge_count} active badges
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Award badge
                  </p>
                  <h3 className="mt-1 font-bold text-gray-950">
                    {selectedUser.full_name ??
                      selectedUser.username}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    @{selectedUser.username}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={refreshSelectedUser}
                  disabled={working}
                  className="rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs font-semibold text-purple-700 transition hover:bg-purple-50 disabled:opacity-50"
                >
                  Recalculate
                </button>
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-semibold text-gray-600">
                  Badge
                </span>
                <select
                  value={grantBadgeId}
                  onChange={(event) =>
                    setGrantBadgeId(
                      event.target.value
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-amber-100 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">
                    Select badge
                  </option>
                  {activeBadges.map(
                    (badge) => (
                      <option
                        key={badge.id}
                        value={badge.id}
                      >
                        {badge.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-semibold text-gray-600">
                  Internal award note, optional
                </span>
                <textarea
                  value={awardNote}
                  onChange={(event) =>
                    setAwardNote(
                      event.target.value
                    )
                  }
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-amber-100 bg-white px-3 py-2.5 text-sm"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-semibold text-gray-600">
                  Expiry date, optional
                </span>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(event) =>
                    setExpiresAt(
                      event.target.value
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-amber-100 bg-white px-3 py-2.5 text-sm"
                />
              </label>

              <button
                type="button"
                onClick={grantBadge}
                disabled={
                  working ||
                  !grantBadgeId
                }
                className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
              >
                Award badge manually
              </button>
            </div>

            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Assignment history
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-gray-950">
                    Current and revoked badges
                  </h3>
                </div>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {assignments.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {assignments.length ===
                0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
                    No badge assignments yet.
                  </div>
                ) : (
                  assignments.map(
                    (assignment) => {
                      const tone =
                        getBadgeToneClasses(
                          assignment.tone
                        );

                      const active =
                        assignment.status ===
                          "active" &&
                        !assignment.is_expired;

                      return (
                        <article
                          key={assignment.id}
                          className={`rounded-2xl border p-4 ${
                            active
                              ? "border-gray-200 bg-white"
                              : "border-gray-200 bg-gray-50 opacity-75"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}
                            >
                              <BadgeIcon
                                iconKey={
                                  assignment.icon_key
                                }
                                iconUrl={
                                  assignment.icon_url
                                }
                                className="h-5 w-5"
                                imageClassName="h-7 w-7 object-contain"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-bold text-gray-950">
                                  {assignment.badge_name}
                                </p>

                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                                  {assignment.source}
                                </span>

                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    active
                                      ? "bg-green-50 text-green-700"
                                      : "bg-red-50 text-red-700"
                                  }`}
                                >
                                  {assignment.is_expired
                                    ? "expired"
                                    : assignment.status}
                                </span>
                              </div>

                              <p className="mt-1 text-xs text-gray-500">
                                Awarded {formatTimestamp(
                                  assignment.awarded_at
                                )}
                                {assignment.expires_at
                                  ? ` · Expires ${formatTimestamp(
                                      assignment.expires_at
                                    )}`
                                  : ""}
                              </p>

                              {assignment.award_note && (
                                <p className="mt-2 text-xs leading-5 text-gray-600">
                                  Internal note: {assignment.award_note}
                                </p>
                              )}

                              {assignment.revoke_reason && (
                                <p className="mt-2 text-xs leading-5 text-red-700">
                                  Reason: {assignment.revoke_reason}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                            {assignment.status ===
                            "active" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  revokeAssignment(
                                    assignment
                                  )
                                }
                                disabled={working}
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                              >
                                {assignment.source ===
                                "automatic"
                                  ? "Suppress automatic badge"
                                  : "Revoke"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  restoreAssignment(
                                    assignment
                                  )
                                }
                                disabled={working}
                                className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                              >
                                {assignment.source ===
                                "automatic"
                                  ? "Remove suppression"
                                  : "Restore"}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    }
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
