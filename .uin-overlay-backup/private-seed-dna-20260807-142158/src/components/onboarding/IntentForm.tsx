"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  useRouter,
} from "next/navigation";

import CommunityPicker from "@/components/communities/CommunityPicker";
import ActivityPicker, {
  type ActivityRequestDetails,
} from "@/components/onboarding/ActivityPicker";
import IntentPreview from "@/components/onboarding/IntentPreview";
import SportPicker from "@/components/onboarding/SportPicker";
import LocationHierarchySelect from "@/components/locations/LocationHierarchySelect";
import JoinRequestMessageSettings from "@/components/intents/JoinRequestMessageSettings";

import {
  getActivityCatalogue,
  submitActivityRequestDraft,
  type ActivityCatalogueItem,
  type ActivityCategory,
} from "@/services/activityService";
import { createIntent } from "@/services/intentService";
import { linkSeedToIntent } from "@/services/seedService";
import { getLocations } from "@/services/locationService";

import { supabase } from "@/utils/supabase/client";
import {
  parseCommunityOptions,
  type CommunityOption,
} from "@/utils/communities";

import type {
  ProfessionalRequirement,
  ProfessionalRoleOption,
} from "@/utils/professionals";
import type { Location } from "@/types/location";
import type { SeedGrowthContext } from "@/utils/seeds";
import { formatLocationLabel } from "@/utils/location";
import {
  PARTICIPANT_ELIGIBILITY_OPTIONS,
  canGenderUseEligibility,
  normalizeProfileGender,
  type ParticipantEligibility,
  type ProfileGender,
} from "@/utils/participationEligibility";
import {
  formatEstimatedCost,
  getEstimatedCostPreviewText,
  serializeEstimatedCost,
  type EstimatedCostMode,
} from "@/utils/estimatedCost";
import {
  isJoinMessageSettingsValid,
  type JoinMessageMode,
} from "@/utils/joinRequestMessage";

function getDayDifference(
  startDate: string,
  endDate: string
) {
  if (
    !startDate ||
    !endDate
  ) {
    return null;
  }

  const start =
    new Date(startDate);

  const end =
    new Date(endDate);

  const days =
    Math.ceil(
      (
        end.getTime() -
        start.getTime()
      ) /
        (
          1000 *
          60 *
          60 *
          24
        )
    );

  return days < 0
    ? null
    : days;
}

function getIntentType(
  startDate: string,
  endDate: string
) {
  const days =
    getDayDifference(
      startDate,
      endDate
    );

  if (days === null) {
    return "Not calculated yet";
  }

  if (days <= 30) {
    return "Short-term Intent";
  }

  if (days <= 365) {
    return "Strategic Intent";
  }

  return "Telos Intent";
}

type IntentFormProps = {
  initialCategoryId?: string;
  initialActivityId?: string;
  initialCommunityId?: string;
  initialNotes?: string;
  sourceSeed?: SeedGrowthContext | null;
};

export default function IntentForm({
  initialCategoryId = "",
  initialActivityId = "",
  initialCommunityId = "",
  initialNotes = "",
  sourceSeed = null,
}: IntentFormProps) {
  const router =
    useRouter();

  const requestedCategoryId =
    initialCategoryId;

  const requestedCommunityId =
    initialCommunityId;

  const hasAppliedCommunityPrefill =
    useRef(false);

  const [
    locations,
    setLocations,
  ] = useState<Location[]>([]);

  const [
    categories,
    setCategories,
  ] = useState<
    ActivityCategory[]
  >([]);

  const [
    catalogueActivities,
    setCatalogueActivities,
  ] = useState<
    ActivityCatalogueItem[]
  >([]);

  const [
    startDate,
    setStartDate,
  ] = useState("");

  const [
    endDate,
    setEndDate,
  ] = useState("");

  const [
    people,
    setPeople,
  ] = useState("anyone");

  const [
    locationId,
    setLocationId,
  ] = useState("");

  const [
    categoryId,
    setCategoryId,
  ] = useState(
    requestedCategoryId
  );

  const [
    activityId,
    setActivityId,
  ] = useState(initialActivityId);

  const [
    sportId,
    setSportId,
  ] = useState("");

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
    professionalRoles,
    setProfessionalRoles,
  ] = useState<
    ProfessionalRoleOption[]
  >([]);

  const [
    professionalRequirement,
    setProfessionalRequirement,
  ] = useState<
    ProfessionalRequirement
  >("none");

  const [
    professionalRoleId,
    setProfessionalRoleId,
  ] = useState("");

  const [
    isLoadingProfessionalRoles,
    setIsLoadingProfessionalRoles,
  ] = useState(false);

  const [
    budget,
    setBudget,
  ] = useState("");

  const [
    estimatedCostMode,
    setEstimatedCostMode,
  ] = useState<EstimatedCostMode>(
    "unknown"
  );

  const [
    recurrence,
    setRecurrence,
  ] = useState("one-time");

  const [
    maxParticipants,
    setMaxParticipants,
  ] = useState("2");

  const [
    visibility,
    setVisibility,
  ] = useState("public");

  const [
    participantEligibility,
    setParticipantEligibility,
  ] = useState<ParticipantEligibility>(
    "everyone"
  );

  const [
    joinMessageMode,
    setJoinMessageMode,
  ] = useState<JoinMessageMode>(
    "none"
  );

  const [
    joinMessagePrompt,
    setJoinMessagePrompt,
  ] = useState("");

  const [profileGender, setProfileGender] =
    useState<ProfileGender | null>(null);

  const [isLoadingProfileGender, setIsLoadingProfileGender] =
    useState(true);

  const [
    notes,
    setNotes,
  ] = useState(initialNotes);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isRequestingActivity,
    setIsRequestingActivity,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadProfileGender() {
      try {
        const { data: authData } =
          await supabase.auth.getUser();

        if (!authData.user) {
          return;
        }

        const { data, error } =
          await supabase
            .from("profiles")
            .select("gender")
            .eq("id", authData.user.id)
            .maybeSingle();

        if (error) {
          throw error;
        }

        if (isCurrent) {
          const nextGender =
            normalizeProfileGender(
              data?.gender
            );

          setProfileGender(nextGender);
          setParticipantEligibility(
            (current) =>
              canGenderUseEligibility(
                nextGender,
                current
              )
                ? current
                : "everyone"
          );
        }
      } catch (error) {
        console.error(
          "Profile gender could not be loaded:",
          error
        );
      } finally {
        if (isCurrent) {
          setIsLoadingProfileGender(false);
        }
      }
    }

    void loadProfileGender();

    return () => {
      isCurrent = false;
    };
  }, []);

  const intentType =
    getIntentType(
      startDate,
      endDate
    );

  const dayDifference =
    getDayDifference(
      startDate,
      endDate
    );

  const selectedLocation =
    locations.find(
      (item) =>
        item.id ===
        locationId
    );

  const selectedCategory =
    categories.find(
      (item) =>
        item.id ===
        categoryId
    );

  const selectedActivity =
    catalogueActivities.find(
      (item) =>
        item.id ===
        activityId &&
        item.category_id ===
        categoryId
    );

  const requiresSport =
    selectedActivity?.requires_sport ??
    false;

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [
          locationsData,
          catalogueData,
        ] =
          await Promise.all([
            getLocations(),
            getActivityCatalogue(),
          ]);

        setLocations(
          locationsData
        );

        setCategories(
          catalogueData.categories
        );

        setCatalogueActivities(
          catalogueData.activities
        );
      } catch (error) {
        console.error(error);

        setErrorMessage(
          "Could not load onboarding data."
        );
      }
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    setSportId("");
    setCommunityIds([]);
  }, [activityId]);

  useEffect(() => {
    setCommunityIds([]);
  }, [sportId]);

  useEffect(() => {
    let isCurrent = true;

    async function loadCommunities() {
      setCommunities([]);

      if (
        !activityId ||
        (
          requiresSport &&
          !sportId
        )
      ) {
        setCommunityIds([]);
        return;
      }

      setIsLoadingCommunities(true);

      try {
        const [
          communityResult,
          sportCommunityResult,
        ] = await Promise.all([
          supabase.rpc(
            "get_active_communities",
            {
              p_category_id:
                categoryId,
              p_activity_id:
                activityId ||
                null,
            }
          ),

          requiresSport
            ? supabase.rpc(
                "get_active_community_sport_links",
                {
                  p_sport_id:
                    sportId,
                }
              )
            : Promise.resolve({
                data: null,
                error: null,
              }),
        ]);

        if (
          communityResult.error
        ) {
          throw communityResult.error;
        }

        if (
          sportCommunityResult.error
        ) {
          throw sportCommunityResult.error;
        }

        if (!isCurrent) {
          return;
        }

        const sportCommunityIds =
          new Set(
            (
              (
                sportCommunityResult.data ??
                []
              ) as {
                community_id: string;
              }[]
            ).map(
              (row) =>
                row.community_id
            )
          );

        const parsedCommunities =
          parseCommunityOptions(
            communityResult.data
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
              ) &&
              (
                !requiresSport ||
                sportCommunityIds.has(
                  community.id
                )
              )
          );

        setCommunities(
          parsedCommunities
        );

        setCommunityIds(
          (currentCommunityIds) => {
            const compatibleIds =
              currentCommunityIds.filter(
                (communityId) =>
                  parsedCommunities.some(
                    (community) =>
                      community.id ===
                      communityId
                  )
              );

            if (compatibleIds.length > 0) {
              return compatibleIds.slice(
                0,
                requiresSport
                  ? 1
                  : 3
              );
            }

            if (
              !hasAppliedCommunityPrefill.current &&
              requestedCommunityId &&
              parsedCommunities.some(
                (community) =>
                  community.id ===
                  requestedCommunityId
              )
            ) {
              hasAppliedCommunityPrefill.current = true;
              return [requestedCommunityId];
            }

            return [];
          }
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
    requestedCommunityId,
    requiresSport,
    sportId,
  ]);

  useEffect(() => {
    let isCurrent = true;

    async function loadProfessionalRoles() {
      setProfessionalRoleId("");
      setProfessionalRoles([]);

      if (!activityId) {
        setProfessionalRequirement("none");

        if (people === "professionals") {
          setPeople("anyone");
        }

        return;
      }

      setIsLoadingProfessionalRoles(true);

      try {
        const {
          data,
          error,
        } = await supabase.rpc(
          "get_professional_roles_for_activity",
          {
            p_activity_id:
              activityId,
          }
        );

        if (error) {
          throw error;
        }

        if (!isCurrent) {
          return;
        }

        const roles = (
          data ?? []
        ).map(
          (row: {
            role_id: string;
            role_name: string;
            role_description: string | null;
            scope_type: "category" | "activity";
            category_id: string;
            activity_id: string | null;
            requires_identity_verification: boolean;
          }) => ({
            id: row.role_id,
            name: row.role_name,
            description:
              row.role_description,
            scope_type:
              row.scope_type,
            category_id:
              row.category_id,
            activity_id:
              row.activity_id,
            requires_identity_verification:
              row.requires_identity_verification,
          })
        ) as ProfessionalRoleOption[];

        setProfessionalRoles(
          roles
        );

        if (
          roles.length === 0 &&
          people === "professionals"
        ) {
          setPeople("anyone");
          setProfessionalRequirement("none");
        }
      } catch (error) {
        console.error(
          "Professional roles could not be loaded:",
          error
        );

        if (isCurrent) {
          setProfessionalRoles([]);

          if (people === "professionals") {
            setPeople("anyone");
            setProfessionalRequirement("none");
          }
        }
      } finally {
        if (isCurrent) {
          setIsLoadingProfessionalRoles(false);
        }
      }
    }

    loadProfessionalRoles();

    return () => {
      isCurrent = false;
    };
  }, [activityId]);

  const selectedCommunities =
    communityIds.flatMap(
      (communityId) => {
        const community =
          communities.find(
            (candidate) =>
              candidate.id ===
              communityId
          );

        return community
          ? [community]
          : [];
      }
    );

  const selectedProfessionalRole =
    professionalRoles.find(
      (role) =>
        role.id ===
        professionalRoleId
    ) ?? null;

  const professionalPreferenceIsValid =
    people !== "professionals" ||
    (
      professionalRequirement !==
        "none" &&
      Boolean(professionalRoleId)
    );

  const estimatedCostIsValid =
    estimatedCostMode !==
      "amount" ||
    (
      budget.trim() !== "" &&
      Number.isFinite(
        Number(budget)
      ) &&
      Number(budget) > 0
    );

  const serializedEstimatedCost =
    estimatedCostIsValid
      ? serializeEstimatedCost(
          estimatedCostMode,
          budget
        )
      : "";

  const joinMessageSettingsAreValid =
    isJoinMessageSettingsValid(
      joinMessageMode,
      joinMessagePrompt
    );

  const hasCoreIntentDetails =
    Boolean(startDate) &&
    Boolean(endDate) &&
    Boolean(people) &&
    Boolean(locationId) &&
    Boolean(recurrence) &&
    Boolean(maxParticipants) &&
    Boolean(visibility) &&
    dayDifference !== null;

  const canCreate =
    hasCoreIntentDetails &&
    Boolean(categoryId) &&
    Boolean(activityId) &&
    (!requiresSport ||
      Boolean(sportId)) &&
    professionalPreferenceIsValid &&
    canGenderUseEligibility(
      profileGender,
      participantEligibility
    ) &&
    estimatedCostIsValid &&
    joinMessageSettingsAreValid &&
    !isSaving &&
    !isRequestingActivity;

  const requestDisabled =
    !hasCoreIntentDetails ||
    isSaving ||
    isRequestingActivity;

  const requestDisabledMessage =
    dayDifference === null &&
    startDate &&
    endDate
      ? "End date cannot be earlier than start date."
      : "Complete the dates, location, participation, capacity and visibility fields before saving the Intent draft.";

  const preview =
    useMemo(() => {
      const capacityText =
        maxParticipants ===
        "unlimited"
          ? "with unlimited participant capacity"
          : `with room for ${maxParticipants} participant${
              maxParticipants ===
              "1"
                ? ""
                : "s"
            }`;

      const recurrenceText =
        recurrence ===
        "one-time"
          ? "as a one-time Activity"
          : `repeating ${recurrence}`;

      const peopleText =
        people === "professionals"
          ? `${
              professionalRequirement ===
              "required"
                ? "requiring"
                : "preferably with"
            } a verified ${
              selectedProfessionalRole?.name ??
              "professional"
            }`
          : `with ${people}`;

      const eligibilityText =
        participantEligibility === "women_only"
          ? "for women only"
          : participantEligibility === "men_only"
            ? "for men only"
            : "open to everyone";

      const communityText =
        selectedCommunities.length > 0
          ? `, in the ${selectedCommunities
              .map((community) => community.name)
              .join(" · ")} Community context${
              selectedCommunities.length === 1 ? "" : "s"
            }`
          : "";

      return `My Intent is to join ${
        selectedActivity
          ? selectedActivity.name
          : "[canonical Activity]"
      } under ${
        selectedCategory?.name ??
        selectedActivity?.category_name ??
        "[Activity category]"
      }${communityText}, between ${
        startDate ||
        "[start date]"
      } and ${
        endDate ||
        "[end date]"
      }, in ${
        formatLocationLabel(
          selectedLocation,
          {
            includeCountry: false,
          }
        ) ||
        "[location]"
      }, ${peopleText}, ${eligibilityText}, ${getEstimatedCostPreviewText(
        serializedEstimatedCost === ""
          ? null
          : Number(
              serializedEstimatedCost
            )
      )}, ${capacityText}, as a ${intentType}, ${recurrenceText}.`;
    }, [
      selectedActivity,
      selectedCategory,
      selectedLocation,
      startDate,
      endDate,
      people,
      participantEligibility,
      professionalRequirement,
      selectedCommunities,
      selectedProfessionalRole,
      budget,
      estimatedCostMode,
      serializedEstimatedCost,
      maxParticipants,
      recurrence,
      intentType,
    ]);

  async function getAuthenticatedUser() {
    const { data } =
      await supabase.auth.getUser();

    if (!data.user) {
      throw new Error(
        "You must be signed in to continue."
      );
    }

    return data.user;
  }

  async function handleCreateIntent() {
    setErrorMessage("");

    if (!canCreate) {
      return;
    }

    setIsSaving(true);

    try {
      const user =
        await getAuthenticatedUser();

      const createdIntentId = await createIntent({
        userId:
          user.id,
        startDate,
        endDate,
        people,
        locationId,
        activityId,
        sportId:
          sportId || null,
        budget:
          serializedEstimatedCost,
        recurrence,
        visibility,
        notes,
        intentType,
        maxParticipants,
        participantEligibility,
        joinMessageMode,
        joinMessagePrompt,
        communityIds,
        professionalRequirement:
          people ===
          "professionals"
            ? professionalRequirement
            : "none",
        professionalRoleId:
          people ===
          "professionals"
            ? professionalRoleId
            : null,
      });

      if (sourceSeed) {
        try {
          await linkSeedToIntent(
            sourceSeed.seed_id,
            createdIntentId
          );
        } catch (linkError) {
          console.warn(
            "Intent created, but Seed lineage could not be linked:",
            linkError
          );
        }
      }

      router.push(
        "/timeline"
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not create Intent."
      );

      setIsSaving(false);
    }
  }

  async function handleRequestActivity(
    details: ActivityRequestDetails
  ) {
    setErrorMessage("");

    if (
      requestDisabled
    ) {
      return;
    }

    setIsRequestingActivity(
      true
    );

    try {
      await getAuthenticatedUser();

      const draftId =
        await submitActivityRequestDraft({
          selectedCategoryId:
            details.selectedCategoryId,
          proposedActivityName:
            details.proposedActivityName,
          description:
            details.description,
          startDate,
          endDate,
          people,
          locationId,
          budget,
          recurrence,
          visibility,
          notes,
          intentType,
          maxParticipants,
          communityId:
            communityIds[0] ||
            null,
          timingMode:
            "flexible",
        });

      router.push(
        `/intent-drafts/${encodeURIComponent(
          draftId
        )}`
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save the Activity request."
      );

      setIsRequestingActivity(
        false
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white py-10">
      <div className="w-full max-w-3xl px-8">
        <div className="mb-6">
          <Link
            href={sourceSeed ? "/seeds" : "/timeline"}
            className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
          >
            ← {sourceSeed ? "Back to Seeds" : "Back to Timeline"}
          </Link>
        </div>

        {sourceSeed && (
          <section className="mb-7 rounded-3xl border border-green-200 bg-gradient-to-br from-green-50 to-lime-50 p-5 text-left shadow-sm">
            <div className="flex items-start gap-4">
              <span className="text-3xl" aria-hidden="true">
                {sourceSeed.seed_type_icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">
                  Growing from a Seed
                </p>
                <h2 className="mt-2 text-xl font-black text-gray-950">
                  {sourceSeed.seed_title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  The Seed stays in your history. This form creates a social Intent and links the two records.
                </p>
                {sourceSeed.suggested_activity_name && (
                  <p className="mt-3 text-xs font-semibold text-violet-700">
                    Suggested Activity · {sourceSeed.suggested_activity_name}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        <div className="text-center">
          <img
            src="/uin-logo.png"
            alt="uin? logo"
            className="mx-auto h-20 w-auto"
          />

          <h1 className="mt-8 text-3xl font-bold text-gray-900">
            What is your Intent?
          </h1>

          <p className="mt-4 leading-7 text-gray-500">
            Shape it clearly. UIN will help
            you turn it into real-world
            Activity.
          </p>

          <p className="mt-3 text-sm font-semibold text-red-600">
            * Required fields
          </p>
        </div>

        <div className="mt-10 rounded-3xl border border-gray-200 p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Start date
                <span aria-hidden="true" className="ml-1 text-red-600">*</span>
              </span>

              <input
                type="date"
                required
                value={startDate}
                onChange={(event) =>
                  setStartDate(
                    event.target.value
                  )
                }
                className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                End date
                <span aria-hidden="true" className="ml-1 text-red-600">*</span>
              </span>

              <input
                type="date"
                required
                min={
                  startDate ||
                  undefined
                }
                value={endDate}
                onChange={(event) =>
                  setEndDate(
                    event.target.value
                  )
                }
                className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />
            </label>

            <div className="md:col-span-2">
              <ActivityPicker
                categories={
                  categories
                }
                activities={
                  catalogueActivities
                }
                categoryId={
                  categoryId
                }
                activityId={
                  activityId
                }
                onCategoryChange={
                  setCategoryId
                }
                onActivityChange={
                  setActivityId
                }
                onRequestActivity={
                  handleRequestActivity
                }
                requestDisabled={
                  requestDisabled
                }
                requestDisabledMessage={
                  requestDisabledMessage
                }
                isRequesting={
                  isRequestingActivity
                }
              />
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

            {requiresSport &&
              Boolean(sportId) && (
              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="text-sm font-semibold text-gray-600">
                  Community
                  <span className="ml-1 font-normal text-gray-400">
                    (optional, choose one)
                  </span>
                </span>

                <span className="text-xs leading-5 text-gray-400">
                  Choose the team or Community whose
                  sport branch this Intent is about.
                </span>

                <select
                  value={
                    communityIds[0] ??
                    ""
                  }
                  disabled={
                    isLoadingCommunities
                  }
                  onChange={(event) =>
                    setCommunityIds(
                      event.target.value
                        ? [
                            event.target.value,
                          ]
                        : []
                    )
                  }
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {isLoadingCommunities
                      ? "Loading Communities..."
                      : "No Community selected"}
                  </option>

                  {communities.map(
                    (community) => (
                      <option
                        key={
                          community.id
                        }
                        value={
                          community.id
                        }
                      >
                        {
                          community.name
                        }
                      </option>
                    )
                  )}
                </select>

                {!isLoadingCommunities &&
                  communities.length ===
                    0 && (
                    <span className="text-xs leading-5 text-amber-700">
                      No Community is configured for
                      the selected sport.
                    </span>
                  )}
              </label>
            )}

            {!requiresSport && (
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
            )}

            {requiresSport &&
              !sportId && (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm leading-6 text-gray-500">
                Select a sport first. Only Communities
                configured for that sport will appear.
              </div>
            )}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                With whom?
                <span aria-hidden="true" className="ml-1 text-red-600">*</span>
              </span>

              <select
                value={people}
                required
                onChange={(event) => {
                  const nextPeople =
                    event.target.value;

                  setPeople(
                    nextPeople
                  );

                  if (
                    nextPeople ===
                    "professionals"
                  ) {
                    setProfessionalRequirement(
                      "required"
                    );
                  } else {
                    setProfessionalRequirement(
                      "none"
                    );
                    setProfessionalRoleId("");
                  }
                }}
                className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              >
                <option value="anyone">
                  Anyone
                </option>

                <option value="friends">
                  Friends
                </option>

                <option value="new people">
                  New people
                </option>

                {professionalRoles.length >
                  0 && (
                  <option value="professionals">
                    Verified professionals
                  </option>
                )}

                <option value="solo">
                  Solo
                </option>
              </select>

              {isLoadingProfessionalRoles && (
                <span className="text-xs text-gray-400">
                  Checking professional roles for this Activity...
                </span>
              )}

              {activityId &&
                !isLoadingProfessionalRoles &&
                professionalRoles.length ===
                  0 && (
                  <span className="text-xs leading-5 text-gray-400">
                    No verified professional roles are configured for this Activity.
                  </span>
                )}
            </label>

            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-semibold text-gray-600">
                Location
                <span aria-hidden="true" className="ml-1 text-red-600">*</span>
              </p>

              <LocationHierarchySelect
                locations={locations}
                value={locationId}
                onChange={setLocationId}
                required
              />

              <p className="mt-2 text-xs leading-5 text-gray-400">
                Choose all of Türkiye, an entire city, or a specific district. The exact meeting point is set later in the Planning Room.
              </p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Who can participate?
                <span aria-hidden="true" className="ml-1 text-red-600">*</span>
              </span>

              <select
                required
                value={participantEligibility}
                disabled={isLoadingProfileGender}
                onChange={(event) =>
                  setParticipantEligibility(
                    event.target.value as ParticipantEligibility
                  )
                }
                className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                {PARTICIPANT_ELIGIBILITY_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={
                        !canGenderUseEligibility(
                          profileGender,
                          option.value
                        )
                      }
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>

              <span className="text-xs leading-5 text-gray-400">
                {isLoadingProfileGender
                  ? "Checking your profile eligibility..."
                  : profileGender === "female"
                    ? "You can create women-only or everyone Intents."
                    : profileGender === "male"
                      ? "You can create men-only or everyone Intents."
                      : "Select Woman or Man in Profile Settings to create a restricted Intent. Non-binary and Prefer not to say currently participate in everyone Intents only."}
              </span>

              {!isLoadingProfileGender &&
                profileGender !== "female" &&
                profileGender !== "male" && (
                  <Link
                    href="/settings/profile"
                    className="text-xs font-semibold text-green-700 hover:underline"
                  >
                    Open Profile Settings
                  </Link>
                )}
            </label>

            <JoinRequestMessageSettings
              mode={joinMessageMode}
              prompt={joinMessagePrompt}
              onModeChange={setJoinMessageMode}
              onPromptChange={setJoinMessagePrompt}
              disabled={isSaving}
              className="md:col-span-2"
            />

            {people ===
              "professionals" && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 md:col-span-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                    Verified professional preference
                  </p>

                  <p className="mt-2 text-sm leading-6 text-blue-900">
                    Choose the exact verified role. Professional credentials are category- or Activity-specific and are checked before matching or joining.
                  </p>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-blue-950">
                      Professional role
                      <span aria-hidden="true" className="ml-1 text-red-600">*</span>
                    </span>

                    <select
                      value={professionalRoleId}
                      required
                      onChange={(event) =>
                        setProfessionalRoleId(
                          event.target.value
                        )
                      }
                      className="rounded-xl border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
                    >
                      <option value="">
                        Select a verified role
                      </option>

                      {professionalRoles.map(
                        (role) => (
                          <option
                            key={role.id}
                            value={role.id}
                          >
                            {role.name}{role.scope_type === "category" ? " · category-wide" : ""}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-blue-950">
                      Requirement
                      <span aria-hidden="true" className="ml-1 text-red-600">*</span>
                    </span>

                    <select
                      value={professionalRequirement}
                      required
                      onChange={(event) =>
                        setProfessionalRequirement(
                          event.target.value as ProfessionalRequirement
                        )
                      }
                      className="rounded-xl border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
                    >
                      <option value="required">
                        Required
                      </option>
                      <option value="preferred">
                        Preferred
                      </option>
                    </select>
                  </label>
                </div>

                <p className="mt-4 text-xs leading-5 text-blue-800">
                  {professionalRequirement ===
                  "required"
                    ? "Only people with this approved and unexpired credential can match or request to join."
                    : "The Intent remains open to others, but matching ranks verified people with this role first."}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 md:col-span-2">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-600">
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
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500"
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
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-600">
                      Amount per person (TL)
                      <span aria-hidden="true" className="ml-1 text-red-600">*</span>
                    </span>

                    <input
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
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500"
                    />
                  </label>
                )}
              </div>

              <p className="mt-3 text-xs leading-5 text-gray-500">
                This is the expected cost for each participant, not the total Activity budget. Each participant covers their own cost. UIN does not collect payment.
              </p>

              <p className="mt-2 text-sm font-semibold text-gray-800">
                {formatEstimatedCost(
                  serializedEstimatedCost === ""
                    ? null
                    : Number(
                        serializedEstimatedCost
                      )
                )}
              </p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Recurrence
                <span aria-hidden="true" className="ml-1 text-red-600">*</span>
              </span>

              <select
                required
                value={
                  recurrence
                }
                onChange={(event) =>
                  setRecurrence(
                    event.target.value
                  )
                }
                className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              >
                <option value="one-time">
                  One-time
                </option>

                <option value="daily">
                  Daily
                </option>

                <option value="weekly">
                  Weekly
                </option>

                <option value="monthly">
                  Monthly
                </option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Participant capacity
                <span aria-hidden="true" className="ml-1 text-red-600">*</span>
              </span>

              <select
                required
                value={
                  maxParticipants
                }
                onChange={(event) =>
                  setMaxParticipants(
                    event.target.value
                  )
                }
                className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              >
                <option value="1">
                  +1 person
                </option>

                <option value="2">
                  +2 people
                </option>

                <option value="3">
                  +3 people
                </option>

                <option value="5">
                  +5 people
                </option>

                <option value="10">
                  +10 people
                </option>

                <option value="unlimited">
                  Unlimited
                </option>
              </select>

              <span className="text-xs text-gray-400">
                You are not included in
                this number.
              </span>
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Intent type
              </span>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-gray-900">
                  {
                    intentType
                  }
                </p>
              </div>
            </div>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-600">
                Visibility
                <span aria-hidden="true" className="ml-1 text-red-600">*</span>
              </span>

              <select
                required
                value={
                  visibility
                }
                onChange={(event) =>
                  setVisibility(
                    event.target.value
                  )
                }
                className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              >
                <option value="public">
                  Anyone
                </option>

                <option value="friends">
                  Friends only
                </option>

                <option value="except_friends">
                  Anyone except friends
                </option>

                <option value="invite_only">
                  Invite only
                </option>

                <option value="private">
                  Only me
                </option>
              </select>

              <span className="text-xs leading-5 text-gray-400">
                {visibility ===
                "public"
                  ? "Everyone can see this Intent. Signed-in users can request to join."
                  : visibility ===
                      "friends"
                    ? "Only accepted friends can see this Intent and request to join."
                    : visibility ===
                        "except_friends"
                      ? "People outside your accepted friend network can see and request to join."
                      : visibility ===
                          "invite_only"
                        ? "Only directly invited people and active members can see it. Join requests are disabled."
                        : "Only you can see it. Requests and direct invitations are disabled."}
              </span>
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-600">
                Notes
                <span className="ml-1 font-normal text-gray-400">
                  (optional)
                </span>
              </span>

              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value
                  )
                }
                placeholder="Explain your personal version of the Activity. The canonical Activity remains the main title."
                className="h-28 resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />

              <span className="text-xs leading-5 text-gray-400">
                Notes describe what you
                personally want to do. They
                do not replace the
                canonical Activity name.
              </span>
            </label>
          </div>

          <IntentPreview
            preview={preview}
          />

          {errorMessage && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
              {
                errorMessage
              }
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
            <Link
              href="/timeline"
              className="flex min-h-14 items-center justify-center rounded-xl border border-gray-200 bg-white px-6 text-base font-semibold text-gray-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 sm:w-40"
            >
              Cancel
            </Link>

            <button
              type="button"
              disabled={
                !canCreate
              }
              onClick={
                handleCreateIntent
              }
              className="min-h-14 flex-1 rounded-xl bg-green-600 px-6 text-lg font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSaving
                ? "Creating Intent..."
                : "Create Intent"}
            </button>
          </div>

          <a
            href="/intent-drafts"
            className="mt-4 block text-center text-sm font-semibold text-purple-700 transition hover:text-purple-900 hover:underline"
          >
            View my Activity requests and
            Intent drafts
          </a>
        </div>
      </div>
    </main>
  );
}
