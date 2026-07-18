"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ActivitySelect from "@/components/onboarding/ActivitySelect";
import CategorySelect from "@/components/onboarding/CategorySelect";
import IntentPreview from "@/components/onboarding/IntentPreview";
import LocationSelect from "@/components/onboarding/LocationSelect";

import {
  getActivitiesByCategory,
  getActivityCategories,
} from "@/services/activityService";
import { createIntent } from "@/services/intentService";
import { getLocations } from "@/services/locationService";

import { supabase } from "@/utils/supabase/client";

import type {
  Activity,
  ActivityCategory,
} from "@/types/activity";
import type { Location } from "@/types/location";

function getDayDifference(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  const days = Math.ceil(
    (end.getTime() - start.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return days < 0 ? null : days;
}

function getIntentType(startDate: string, endDate: string) {
  const days = getDayDifference(startDate, endDate);

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

export default function IntentForm() {
  const router = useRouter();

  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] =
    useState<ActivityCategory[]>([]);
  const [activities, setActivities] =
    useState<Activity[]>([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [people, setPeople] = useState("anyone");
  const [locationId, setLocationId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [budget, setBudget] = useState("");
  const [recurrence, setRecurrence] =
    useState("one-time");
  const [maxParticipants, setMaxParticipants] =
    useState("2");
  const [visibility, setVisibility] =
    useState("public");
  const [notes, setNotes] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const intentType = getIntentType(
    startDate,
    endDate
  );

  const dayDifference = getDayDifference(
    startDate,
    endDate
  );

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [
          locationsData,
          categoriesData,
        ] = await Promise.all([
          getLocations(),
          getActivityCategories(),
        ]);

        setLocations(locationsData);
        setCategories(categoriesData);
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
    async function loadActivities() {
      if (!categoryId) {
        setActivities([]);
        setActivityId("");
        return;
      }

      try {
        const activitiesData =
          await getActivitiesByCategory(
            categoryId
          );

        setActivities(activitiesData);
        setActivityId("");
      } catch (error) {
        console.error(error);
        setErrorMessage(
          "Could not load activities."
        );
      }
    }

    loadActivities();
  }, [categoryId]);

  const selectedLocation = locations.find(
    (item) => item.id === locationId
  );

  const selectedCategory = categories.find(
    (item) => item.id === categoryId
  );

  const selectedActivity = activities.find(
    (item) => item.id === activityId
  );

  const canCreate =
    Boolean(startDate) &&
    Boolean(endDate) &&
    Boolean(people) &&
    Boolean(locationId) &&
    Boolean(categoryId) &&
    Boolean(activityId) &&
    Boolean(recurrence) &&
    Boolean(maxParticipants) &&
    Boolean(visibility) &&
    dayDifference !== null &&
    !isSaving;

  const preview = useMemo(() => {
    const capacityText =
      maxParticipants === "unlimited"
        ? "with unlimited participant capacity"
        : `with room for ${maxParticipants} participant${
            maxParticipants === "1" ? "" : "s"
          }`;

    const recurrenceText =
      recurrence === "one-time"
        ? "as a one-time Activity"
        : `repeating ${recurrence}`;

    return `My Intent is to join a ${
      selectedActivity?.name || "[activity]"
    } as a ${
      selectedCategory?.name ||
      "[activity type]"
    }, between ${
      startDate || "[start date]"
    } and ${
      endDate || "[end date]"
    }, in ${
      selectedLocation?.district ||
      "[location]"
    }, with ${people}, ${
      budget
        ? `with a budget of ${budget} TL`
        : "with no defined budget"
    }, ${capacityText}, as a ${intentType}, ${recurrenceText}.`;
  }, [
    selectedActivity,
    selectedCategory,
    selectedLocation,
    startDate,
    endDate,
    people,
    budget,
    maxParticipants,
    recurrence,
    intentType,
  ]);

  const handleCreateIntent = async () => {
    setErrorMessage("");

    if (!canCreate) {
      return;
    }

    setIsSaving(true);

    try {
      const { data } =
        await supabase.auth.getUser();

      const user = data.user;

      if (!user) {
        setErrorMessage(
          "You must be signed in to create an Intent."
        );
        setIsSaving(false);
        return;
      }

      await createIntent({
        userId: user.id,
        startDate,
        endDate,
        people,
        locationId,
        activityId,
        budget,
        recurrence,
        visibility,
        notes,
        intentType,
        maxParticipants,
      });

      router.push("/timeline");
      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Could not create Intent."
      );
      setIsSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white py-10">
      <div className="w-full max-w-3xl px-8">
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
        </div>

        <div className="mt-10 rounded-3xl border border-gray-200 p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Start date
              </span>

              <input
                type="date"
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
              </span>

              <input
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(event) =>
                  setEndDate(event.target.value)
                }
                className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                With whom?
              </span>

              <select
                value={people}
                onChange={(event) =>
                  setPeople(event.target.value)
                }
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

                <option value="professionals">
                  Professionals
                </option>

                <option value="solo">
                  Solo
                </option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Location
              </span>

              <LocationSelect
                locations={locations}
                value={locationId}
                onChange={setLocationId}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Activity category
              </span>

              <CategorySelect
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Activity
              </span>

              <ActivitySelect
                activities={activities}
                value={activityId}
                disabled={!categoryId}
                onChange={setActivityId}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Budget
              </span>

              <input
                type="number"
                min="0"
                value={budget}
                onChange={(event) =>
                  setBudget(event.target.value)
                }
                placeholder="Budget, e.g. 250"
                className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Recurrence
              </span>

              <select
                value={recurrence}
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
              </span>

              <select
                value={maxParticipants}
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
                You are not included in this
                number.
              </span>
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Intent type
              </span>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-gray-900">
                  {intentType}
                </p>
              </div>
            </div>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-600">
                Visibility
              </span>

              <select
                value={visibility}
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
                {visibility === "public"
                  ? "Everyone can see this Intent. Signed-in users can request to join."
                  : visibility === "friends"
                    ? "Only accepted friends can see this Intent and request to join."
                    : visibility === "except_friends"
                      ? "People outside your accepted friend network can see and request to join."
                      : visibility === "invite_only"
                        ? "Only directly invited people and active members can see it. Join requests are disabled."
                        : "Only you can see it. Requests and direct invitations are disabled."}
              </span>
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-gray-600">
                Notes
              </span>

              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Optional notes"
                className="h-24 resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />
            </label>
          </div>

          <IntentPreview preview={preview} />

          {errorMessage && (
            <p className="mt-4 text-center text-sm text-red-600">
              {errorMessage}
            </p>
          )}

          <button
            type="button"
            disabled={!canCreate}
            onClick={handleCreateIntent}
            className="mt-6 w-full rounded-xl bg-green-600 py-4 text-lg font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSaving
              ? "Creating Intent..."
              : "Create Intent"}
          </button>
        </div>
      </div>
    </main>
  );
}