"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import IntentLinksEditor from "@/components/intents/IntentLinksEditor";
import {
  updateIntent,
} from "@/services/intentEditService";
import { getVisibleIntentLinks } from "@/services/intentLinksService";
import type { IntentLinkInput } from "@/utils/intentLinks";

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
  city: string;
  district: string;
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
  notes: string | null;
};

type EditIntentFormProps = {
  intent: EditableIntent;
  categories: CategoryOption[];
  activities: ActivityOption[];
  locations: LocationOption[];
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

  const [budget, setBudget] =
    useState(
      intent.budget === null
        ? ""
        : String(intent.budget)
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

    const parsedBudget =
      budget.trim() === ""
        ? null
        : Number(budget);

    const parsedMaxParticipants =
      maxParticipants.trim() === ""
        ? null
        : Number(
            maxParticipants
          );

    if (
      parsedBudget !== null &&
      (
        !Number.isFinite(
          parsedBudget
        ) ||
        parsedBudget < 0
      )
    ) {
      setErrorMessage(
        "Enter a valid budget."
      );

      return;
    }

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
        locationId,
        startDate,
        endDate,
        people,
        recurrence,
        visibility,
        budget: parsedBudget,
        maxParticipants:
          parsedMaxParticipants,
        notes,
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

        <div>
          <label
            htmlFor="edit-location"
            className="text-sm font-semibold text-gray-700"
          >
            Location
          </label>

          <select
            id="edit-location"
            value={locationId}
            onChange={(event) =>
              setLocationId(
                event.target.value
              )
            }
            required
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          >
            {locations.map(
              (location) => (
                <option
                  key={location.id}
                  value={location.id}
                >
                  {location.district},{" "}
                  {location.city}
                </option>
              )
            )}
          </select>
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

        <div>
          <label
            htmlFor="edit-budget"
            className="text-sm font-semibold text-gray-700"
          >
            Budget
          </label>

          <input
            id="edit-budget"
            type="number"
            min="0"
            step="1"
            value={budget}
            onChange={(event) =>
              setBudget(
                event.target.value
              )
            }
            placeholder="Optional"
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
          />
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
          disabled={isSaving || linksLoading}
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