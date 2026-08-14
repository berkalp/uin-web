"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import CommunityPicker from "@/components/communities/CommunityPicker";
import IntentLinksEditor from "@/components/intents/IntentLinksEditor";
import JoinRequestMessageSettings from "@/components/intents/JoinRequestMessageSettings";
import LocationHierarchySelect from "@/components/locations/LocationHierarchySelect";
import SportPicker from "@/components/onboarding/SportPicker";
import {
  updateIntent,
} from "@/services/intentEditService";
import { getVisibleIntentLinks } from "@/services/intentLinksService";
import { supabase } from "@/utils/supabase/client";
import {
  applyCommunityAccessContexts,
  parseCommunityAccessContexts,
  parseCommunityOptions,
  type CommunityOption,
} from "@/utils/communities";
import type { IntentLinkInput } from "@/utils/intentLinks";
import {
  PARTICIPANT_ELIGIBILITY_OPTIONS,
  canGenderUseEligibility,
  type ParticipantEligibility,
  type ProfileGender,
} from "@/utils/participationEligibility";
import {
  formatEstimatedCost,
  getEstimatedCostMode,
  parseEstimatedCost,
  type EstimatedCostMode,
} from "@/utils/estimatedCost";
import {
  isJoinMessageSettingsValid,
  type JoinMessageMode,
} from "@/utils/joinRequestMessage";

type SelectOption = {
  value: string;
  label: string;
};

type ActivityOption = {
  id: string;
  categoryId: string;
  name: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type LocationOption = {
  id: string;
  country_code?: string | null;
  country_name?: string | null;
  city?: string | null;
  district?: string | null;
  scope?: string | null;
};

type EditableIntent = {
  id: string;
  activityId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  people: string;
  recurrence: string;
  visibility: string;
  budget: number | null;
  maxParticipants: number | null;
  participantEligibility: ParticipantEligibility;
  joinMessageMode: JoinMessageMode;
  joinMessagePrompt: string | null;
  notes: string | null;
};

type EditIntentFormProps = {
  intent: EditableIntent;
  categories: CategoryOption[];
  activities: ActivityOption[];
  locations: LocationOption[];
  currentUserGender: ProfileGender | null;
  hasAcceptedParticipants: boolean;
};

const DEFAULT_PEOPLE_OPTIONS: SelectOption[] = [
  {
    value: "anyone",
    label: "Anyone",
  },
  {
    value: "friends",
    label: "Friends",
  },
  {
    value: "partner",
    label: "Partner",
  },
  {
    value: "family",
    label: "Family",
  },
  {
    value: "children",
    label: "With children",
  },
  {
    value: "alone",
    label: "Alone",
  },
];

const DEFAULT_RECURRENCE_OPTIONS: SelectOption[] = [
  {
    value: "one-time",
    label: "One-time",
  },
  {
    value: "daily",
    label: "Daily",
  },
  {
    value: "weekly",
    label: "Weekly",
  },
  {
    value: "monthly",
    label: "Monthly",
  },
];

const DEFAULT_VISIBILITY_OPTIONS: SelectOption[] = [
  {
    value: "public",
    label: "Anyone",
  },
  {
    value: "friends",
    label: "Friends only",
  },
  {
    value: "except_friends",
    label: "Anyone except friends",
  },
  {
    value: "invite_only",
    label: "Invite only",
  },
  {
    value: "private",
    label: "Only me",
  },
];

function includeCurrentOption(
  options: SelectOption[],
  currentValue: string
) {
  const exists = options.some(
    (option) =>
      option.value === currentValue
  );

  if (exists || !currentValue) {
    return options;
  }

  return [
    {
      value: currentValue,
      label: currentValue,
    },
    ...options,
  ];
}

export default function EditIntentForm({
  intent,
  categories,
  activities,
  locations,
  currentUserGender,
  hasAcceptedParticipants,
}: EditIntentFormProps) {
  const router = useRouter();

  const currentActivity =
    activities.find(
      (activity) =>
        activity.id ===
        intent.activityId
    ) ?? null;

  const [
    categoryId,
    setCategoryId,
  ] = useState(
    currentActivity?.categoryId ??
      categories[0]?.id ??
      ""
  );

  const [
    activityId,
    setActivityId,
  ] = useState(
    intent.activityId
  );

  const [
    sportId,
    setSportId,
  ] = useState("");

  const [
    requiresSport,
    setRequiresSport,
  ] = useState(false);

  const previousActivityIdRef =
    useRef(intent.activityId);

  const [
    communities,
    setCommunities,
  ] = useState<
    CommunityOption[]
  >([]);

  const [
    communityIds,
    setCommunityIds,
  ] = useState<string[]>([]);

  const [
    isLoadingCommunities,
    setIsLoadingCommunities,
  ] = useState(false);

  const [
    locationId,
    setLocationId,
  ] = useState(
    intent.locationId
  );

  const [
    startDate,
    setStartDate,
  ] = useState(
    intent.startDate
  );

  const [
    endDate,
    setEndDate,
  ] = useState(
    intent.endDate
  );

  const [people, setPeople] =
    useState(intent.people);

  const [
    recurrence,
    setRecurrence,
  ] = useState(
    intent.recurrence
  );

  const [
    visibility,
    setVisibility,
  ] = useState(
    intent.visibility
  );

  const [
    participantEligibility,
    setParticipantEligibility,
  ] = useState<ParticipantEligibility>(
    intent.participantEligibility
  );

  const [
    joinMessageMode,
    setJoinMessageMode,
  ] = useState<JoinMessageMode>(
    intent.joinMessageMode
  );

  const [
    joinMessagePrompt,
    setJoinMessagePrompt,
  ] = useState(
    intent.joinMessagePrompt ?? ""
  );

  const [
    estimatedCostMode,
    setEstimatedCostMode,
  ] = useState<EstimatedCostMode>(
    getEstimatedCostMode(
      intent.budget
    )
  );

  const [budget, setBudget] =
    useState(
      intent.budget !== null &&
      intent.budget > 0
        ? String(intent.budget)
        : ""
    );

  const [
    maxParticipants,
    setMaxParticipants,
  ] = useState(
    intent.maxParticipants === null
      ? ""
      : String(
          intent.maxParticipants
        )
  );

  const [notes, setNotes] =
    useState(
      intent.notes ?? ""
    );

  const [
    relatedLinks,
    setRelatedLinks,
  ] = useState<
    IntentLinkInput[]
  >([]);

  const [
    linksLoading,
    setLinksLoading,
  ] = useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadCurrentSport() {
      const {
        data,
        error,
      } = await supabase
        .from("intents")
        .select("sport_id")
        .eq("id", intent.id)
        .maybeSingle();

      if (error) {
        console.error(
          "Current sport could not be loaded:",
          error
        );
        return;
      }

      if (isCurrent) {
        setSportId(
          typeof data?.sport_id === "string"
            ? data.sport_id
            : ""
        );
      }
    }

    loadCurrentSport();

    return () => {
      isCurrent = false;
    };
  }, [intent.id]);

  useEffect(() => {
    let isCurrent = true;

    if (
      previousActivityIdRef.current !==
      activityId
    ) {
      setSportId("");
      previousActivityIdRef.current =
        activityId;
    }

    async function loadSportRequirement() {
      if (!activityId) {
        setRequiresSport(false);
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("activities")
        .select("requires_sport")
        .eq("id", activityId)
        .maybeSingle();

      if (error) {
        console.error(
          "Sport requirement could not be loaded:",
          error
        );

        if (isCurrent) {
          setRequiresSport(false);
        }

        return;
      }

      if (isCurrent) {
        setRequiresSport(
          data?.requires_sport === true
        );
      }
    }

    loadSportRequirement();

    return () => {
      isCurrent = false;
    };
  }, [activityId]);

  useEffect(() => {
    let isCurrent = true;

    async function loadCurrentCommunities() {
      const { data, error } = await supabase.rpc(
        "get_my_intent_communities",
        { p_intent_id: intent.id }
      );

      if (error) {
        console.error(
          "Current Communities could not be loaded:",
          error
        );
        return;
      }

      if (isCurrent) {
        setCommunityIds(
          ((data ?? []) as { community_id: string; position: number }[])
            .sort((left, right) => left.position - right.position)
            .map((row) => row.community_id)
            .slice(0, 3)
        );
      }
    }

    loadCurrentCommunities();

    return () => {
      isCurrent = false;
    };
  }, [intent.id]);

  useEffect(() => {
    let isCurrent = true;

    async function loadCommunities() {
      setCommunities([]);

      if (!activityId) {
        setCommunityIds([]);
        return;
      }

      setIsLoadingCommunities(true);

      try {
        const [
          communityResult,
          communityAccessResult,
        ] = await Promise.all([
          supabase.rpc(
            "get_active_communities",
            {
              p_category_id:
                categoryId,
              p_activity_id:
                activityId,
            }
          ),
          supabase.rpc(
            "get_my_community_intent_access"
          ),
        ]);

        if (communityResult.error) {
          throw communityResult.error;
        }

        if (communityAccessResult.error) {
          console.warn(
            "Community membership access could not be loaded; defaulting to open access until the migration is applied.",
            communityAccessResult.error
          );
        }

        if (!isCurrent) {
          return;
        }

        const parsedCommunities =
          applyCommunityAccessContexts(
            parseCommunityOptions(
              communityResult.data
            ),
            parseCommunityAccessContexts(
              communityAccessResult.error
                ? []
                : communityAccessResult.data
            )
          ).filter(
            (community) =>
              community.relevanceRank ===
                0 &&
              (
                community.activityIds
                  .length ===
                  0 ||
                community.activityIds.includes(
                  activityId
                )
              )
          );

        setCommunities(
          parsedCommunities
        );

        setCommunityIds(
          (currentCommunityIds) =>
            currentCommunityIds
              .filter(
                (communityId) =>
                  parsedCommunities.some(
                    (community) =>
                      community.id ===
                      communityId
                  )
              )
              .slice(0, 3)
        );
      } catch (error) {
        console.error(
          "Communities could not be loaded:",
          error
        );

        if (isCurrent) {
          setCommunities([]);
          setCommunityIds([]);
        }
      } finally {
        if (isCurrent) {
          setIsLoadingCommunities(false);
        }
      }
    }

    loadCommunities();

    return () => {
      isCurrent = false;
    };
  }, [
    activityId,
    categoryId,
  ]);

  useEffect(() => {
    let isCancelled =
      false;

    async function loadLinks() {
      try {
        const links =
          await getVisibleIntentLinks([
            intent.id,
          ]);

        if (
          isCancelled
        ) {
          return;
        }

        setRelatedLinks(
          links.map(
            (link) => ({
              id:
                link.id,
              linkType:
                link.linkType,
              label:
                link.label ??
                "",
              url:
                link.url,
            })
          )
        );
      } catch (error) {
        if (
          !isCancelled
        ) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Related links could not be loaded."
          );
        }
      } finally {
        if (
          !isCancelled
        ) {
          setLinksLoading(
            false
          );
        }
      }
    }

    loadLinks();

    return () => {
      isCancelled =
        true;
    };
  }, [intent.id]);

  const filteredActivities =
    useMemo(
      () =>
        activities.filter(
          (activity) =>
            activity.categoryId ===
            categoryId
        ),
      [
        activities,
        categoryId,
      ]
    );

  const selectedActivity =
    activities.find(
      (activity) =>
        activity.id ===
        activityId
    ) ?? null;

  const peopleOptions =
    includeCurrentOption(
      DEFAULT_PEOPLE_OPTIONS,
      intent.people
    );

  const recurrenceOptions =
    includeCurrentOption(
      DEFAULT_RECURRENCE_OPTIONS,
      intent.recurrence
    );

  const visibilityOptions =
    includeCurrentOption(
      DEFAULT_VISIBILITY_OPTIONS,
      intent.visibility
    );

  function handleCategoryChange(
    nextCategoryId: string
  ) {
    setCategoryId(
      nextCategoryId
    );

    const firstActivity =
      activities.find(
        (activity) =>
          activity.categoryId ===
          nextCategoryId
      );

    setActivityId(
      firstActivity?.id ?? ""
    );
  }

  function handleStartDateChange(
    nextStartDate: string
  ) {
    setStartDate(
      nextStartDate
    );

    if (
      endDate <
      nextStartDate
    ) {
      setEndDate(
        nextStartDate
      );
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage(null);

    let parsedBudget:
      | number
      | null;

    try {
      parsedBudget =
        parseEstimatedCost(
          estimatedCostMode,
          budget
        );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Enter a valid estimated cost per person."
      );

      return;
    }

    const parsedMaxParticipants =
      maxParticipants.trim() === ""
        ? null
        : Number(
            maxParticipants
          );

    if (
      parsedMaxParticipants !== null &&
      (
        !Number.isInteger(
          parsedMaxParticipants
        ) ||
        parsedMaxParticipants < 1
      )
    ) {
      setErrorMessage(
        "Participant capacity must be a whole number of at least 1."
      );

      return;
    }

    if (
      requiresSport &&
      !sportId
    ) {
      setErrorMessage(
        "Select a sport for this Activity."
      );

      return;
    }

    if (
      !isJoinMessageSettingsValid(
        joinMessageMode,
        joinMessagePrompt
      )
    ) {
      setErrorMessage(
        "Enter the question participants should answer."
      );

      return;
    }

    if (
      linksLoading
    ) {
      setErrorMessage(
        "Related links are still loading."
      );

      return;
    }

    try {
      setIsSaving(true);

      await updateIntent({
        intentId: intent.id,
        activityId,
        sportId:
          requiresSport
            ? sportId
            : null,
        locationId,
        startDate,
        endDate,
        people,
        recurrence,
        visibility,
        budget: parsedBudget,
        maxParticipants:
          parsedMaxParticipants,
        participantEligibility,
        joinMessageMode,
        joinMessagePrompt,
        notes,
        communityIds,
        relatedLinks,
      });

      router.push(
        "/timeline"
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The Intent could not be updated."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label
            htmlFor="edit-category"
            className="text-sm font-semibold text-gray-700"
          >
            Category
          </label>

          <select
            id="edit-category"
            value={categoryId}
            onChange={(event) =>
              handleCategoryChange(
                event.target.value
              )
            }
            required
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          >
            {categories.map(
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
        </div>

        <div>
          <label
            htmlFor="edit-activity"
            className="text-sm font-semibold text-gray-700"
          >
            Activity
          </label>

          <select
            id="edit-activity"
            value={activityId}
            onChange={(event) =>
              setActivityId(
                event.target.value
              )
            }
            required
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          >
            {filteredActivities.map(
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
        </div>

        {requiresSport && (
          <div className="md:col-span-2">
            <SportPicker
              value={sportId}
              onChange={setSportId}
              required
            />
          </div>
        )}

        <CommunityPicker
          categoryId={
            categoryId
          }
          activityId={
            activityId
          }
          activityName={
            selectedActivity?.name ??
            ""
          }
          value={
            communityIds
          }
          communities={
            communities
          }
          isLoading={
            isLoadingCommunities
          }
          onChange={
            setCommunityIds
          }
        />

        <div className="md:col-span-2">
          <p className="text-sm font-semibold text-gray-700">
            Location
          </p>

          <div className="mt-2">
            <LocationHierarchySelect
              locations={locations}
              value={locationId}
              onChange={setLocationId}
              required
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="edit-people"
            className="text-sm font-semibold text-gray-700"
          >
            With whom
          </label>

          <select
            id="edit-people"
            value={people}
            onChange={(event) =>
              setPeople(
                event.target.value
              )
            }
            required
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          >
            {peopleOptions.map(
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
        </div>

        <div>
          <label
            htmlFor="edit-participant-eligibility"
            className="text-sm font-semibold text-gray-700"
          >
            Who can participate?
          </label>

          <select
            id="edit-participant-eligibility"
            value={participantEligibility}
            onChange={(event) =>
              setParticipantEligibility(
                event.target.value as ParticipantEligibility
              )
            }
            required
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          >
            {PARTICIPANT_ELIGIBILITY_OPTIONS.map(
              (option) => {
                const isCurrent =
                  option.value ===
                  participantEligibility;

                const isAllowedByGender =
                  canGenderUseEligibility(
                    currentUserGender,
                    option.value
                  );

                const isAllowedAfterAcceptance =
                  !hasAcceptedParticipants ||
                  isCurrent ||
                  option.value === "everyone";

                return (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={
                      !isAllowedByGender ||
                      !isAllowedAfterAcceptance
                    }
                  >
                    {option.label}
                  </option>
                );
              }
            )}
          </select>

          <p className="mt-2 text-xs leading-5 text-gray-500">
            {hasAcceptedParticipants
              ? "A participant has already been accepted. The rule can now only be widened to Everyone."
              : currentUserGender === "female"
                ? "Women-only and Everyone are available for this profile."
                : currentUserGender === "male"
                  ? "Men-only and Everyone are available for this profile."
                  : "Restricted Intents require Woman or Man in Profile Settings."}
          </p>
        </div>

        <JoinRequestMessageSettings
          mode={joinMessageMode}
          prompt={joinMessagePrompt}
          onModeChange={setJoinMessageMode}
          onPromptChange={setJoinMessagePrompt}
          disabled={isSaving}
          className="md:col-span-2"
        />

        <div>
          <label
            htmlFor="edit-start-date"
            className="text-sm font-semibold text-gray-700"
          >
            Start date
          </label>

          <input
            id="edit-start-date"
            type="date"
            value={startDate}
            onChange={(event) =>
              handleStartDateChange(
                event.target.value
              )
            }
            required
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          />
        </div>

        <div>
          <label
            htmlFor="edit-end-date"
            className="text-sm font-semibold text-gray-700"
          >
            End date
          </label>

          <input
            id="edit-end-date"
            type="date"
            min={startDate}
            value={endDate}
            onChange={(event) =>
              setEndDate(
                event.target.value
              )
            }
            required
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          />
        </div>

        <div>
          <label
            htmlFor="edit-recurrence"
            className="text-sm font-semibold text-gray-700"
          >
            Recurrence
          </label>

          <select
            id="edit-recurrence"
            value={recurrence}
            onChange={(event) =>
              setRecurrence(
                event.target.value
              )
            }
            required
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          >
            {recurrenceOptions.map(
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
        </div>

        <div>
          <label
            htmlFor="edit-visibility"
            className="text-sm font-semibold text-gray-700"
          >
            Visibility
          </label>

          <select
            id="edit-visibility"
            value={visibility}
            onChange={(event) =>
              setVisibility(
                event.target.value
              )
            }
            required
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          >
            {visibilityOptions.map(
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
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 md:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="text-sm font-semibold text-gray-700">
                Estimated cost per person
              </span>

              <select
                value={
                  estimatedCostMode
                }
                onChange={(event) => {
                  const nextMode =
                    event.target
                      .value as EstimatedCostMode;

                  setEstimatedCostMode(
                    nextMode
                  );

                  if (
                    nextMode !==
                    "amount"
                  ) {
                    setBudget("");
                  }
                }}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="unknown">
                  Not sure yet
                </option>

                <option value="free">
                  Free
                </option>

                <option value="amount">
                  Enter an amount
                </option>
              </select>
            </label>

            {estimatedCostMode ===
              "amount" && (
              <label>
                <span className="text-sm font-semibold text-gray-700">
                  Amount per person (TL)
                </span>

                <input
                  id="edit-budget"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={budget}
                  onChange={(event) =>
                    setBudget(
                      event.target.value
                    )
                  }
                  placeholder="e.g. 1500"
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </label>
            )}
          </div>

          <p className="mt-3 text-xs leading-5 text-gray-500">
            This is the expected cost for each participant, not the total Activity budget. Each participant covers their own cost. UIN does not collect payment.
          </p>

          <p className="mt-2 text-sm font-semibold text-gray-800">
            {formatEstimatedCost(
              estimatedCostMode ===
                "unknown"
                ? null
                : estimatedCostMode ===
                    "free"
                  ? 0
                  : Number(
                      budget
                    )
            )}
          </p>
        </div>

        <div>
          <label
            htmlFor="edit-capacity"
            className="text-sm font-semibold text-gray-700"
          >
            Participant capacity
          </label>

          <input
            id="edit-capacity"
            type="number"
            min="1"
            step="1"
            value={
              maxParticipants
            }
            onChange={(event) =>
              setMaxParticipants(
                event.target.value
              )
            }
            placeholder="Unlimited"
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
          />

          <p className="mt-1 text-xs text-gray-400">
            The host is not included in this number.
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="edit-notes"
          className="text-sm font-semibold text-gray-700"
        >
          Notes
        </label>

        <textarea
          id="edit-notes"
          value={notes}
          onChange={(event) =>
            setNotes(
              event.target.value
            )
          }
          rows={5}
          maxLength={1000}
          placeholder="Add useful details about your Intent."
          className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
        />

        <p className="mt-1 text-right text-xs text-gray-400">
          {notes.length}/1000
        </p>
      </div>

      <IntentLinksEditor
        value={
          relatedLinks
        }
        onChange={
          setRelatedLinks
        }
        disabled={
          isSaving ||
          linksLoading
        }
      />

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={
            isSaving ||
            linksLoading ||
            (
              requiresSport &&
              !sportId
            )
          }
          className="flex-1 rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving
            ? "Saving changes..."
            : linksLoading
              ? "Loading links..."
              : "Save Changes"}
        </button>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/timeline"
            )
          }
          disabled={isSaving}
          className="rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}