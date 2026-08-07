"use client";

import {
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import { supabase } from "@/utils/supabase/client";

export type AdminSport = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
  intent_count:
    | number
    | string
    | null;
  community_count:
    | number
    | string
    | null;
};

type SportsManagerProps = {
  sports: AdminSport[];
};

function toNumber(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsedValue =
    Number(value ?? 0);

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : 0;
}

function SportEditor({
  sport,
}: {
  sport: AdminSport;
}) {
  const router =
    useRouter();

  const [
    name,
    setName,
  ] = useState(
    sport.name
  );

  const [
    isActive,
    setIsActive,
  ] = useState(
    sport.is_active
  );

  const [
    sortOrder,
    setSortOrder,
  ] = useState(
    String(
      sport.sort_order
    )
  );

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState<
    string | null
  >(null);

  const intentCount =
    toNumber(
      sport.intent_count
    );

  const communityCount =
    toNumber(
      sport.community_count
    );

  const canDelete =
    intentCount === 0 &&
    communityCount === 0;

  async function save() {
    setIsSaving(true);
    setMessage(null);

    const parsedSortOrder =
      Number(sortOrder);

    if (
      !Number.isInteger(
        parsedSortOrder
      ) ||
      parsedSortOrder < 0
    ) {
      setIsSaving(false);
      setMessage(
        "Sort order must be zero or greater."
      );
      return;
    }

    const { error } =
      await supabase.rpc(
        "admin_update_sport",
        {
          p_sport_id:
            sport.id,
          p_name:
            name,
          p_is_active:
            isActive,
          p_sort_order:
            parsedSortOrder,
        }
      );

    setIsSaving(false);

    if (error) {
      setMessage(
        error.message
      );
      return;
    }

    setMessage("Saved.");
    router.refresh();
  }

  async function remove() {
    if (!canDelete) {
      setMessage(
        "This sport is in use. Deactivate it instead."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${sport.name}?`
      );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setMessage(null);

    const { error } =
      await supabase.rpc(
        "admin_delete_sport",
        {
          p_sport_id:
            sport.id,
        }
      );

    setIsDeleting(false);

    if (error) {
      setMessage(
        error.message
      );
      return;
    }

    router.refresh();
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_auto_auto_auto] lg:items-center">
        <div>
          <input
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
            className="w-full min-w-0 rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-950 outline-none focus:border-green-500"
          />

          <p className="mt-2 text-xs text-gray-400">
            Slug: {sport.slug}
          </p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Sort order
          </span>

          <input
            type="number"
            min="0"
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(
                event.target.value
              )
            }
            className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
          />
        </label>

        <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) =>
              setIsActive(
                event.target.checked
              )
            }
            className="h-4 w-4"
          />
          Active
        </label>

        <button
          type="button"
          disabled={
            isSaving ||
            name.trim().length < 2
          }
          onClick={save}
          className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {isSaving
            ? "Saving..."
            : "Save"}
        </button>

        <button
          type="button"
          disabled={
            isDeleting ||
            !canDelete
          }
          onClick={remove}
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isDeleting
            ? "Deleting..."
            : "Delete"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <p>
          {intentCount} Intents ·{" "}
          {communityCount} Community links
        </p>

        {message && (
          <p
            className={
              message ===
              "Saved."
                ? "font-semibold text-green-700"
                : "font-semibold text-red-700"
            }
          >
            {message}
          </p>
        )}
      </div>
    </article>
  );
}

export default function SportsManager({
  sports,
}: SportsManagerProps) {
  const router =
    useRouter();

  const [
    newSportName,
    setNewSportName,
  ] = useState("");

  const [
    newSortOrder,
    setNewSortOrder,
  ] = useState("100");

  const [
    isCreating,
    setIsCreating,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState<
    string | null
  >(null);

  async function createSport() {
    setIsCreating(true);
    setMessage(null);

    const parsedSortOrder =
      Number(
        newSortOrder
      );

    if (
      !Number.isInteger(
        parsedSortOrder
      ) ||
      parsedSortOrder < 0
    ) {
      setIsCreating(false);
      setMessage(
        "Sort order must be zero or greater."
      );
      return;
    }

    const { error } =
      await supabase.rpc(
        "admin_create_sport",
        {
          p_name:
            newSportName,
          p_sort_order:
            parsedSortOrder,
        }
      );

    setIsCreating(false);

    if (error) {
      setMessage(
        error.message
      );
      return;
    }

    setNewSportName("");
    setNewSortOrder("100");
    setMessage(
      "Sport created."
    );
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
          Sport Catalogue
        </p>

        <h2 className="mt-2 text-2xl font-bold text-gray-950">
          Add a sport
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
          Sports are used when an Activity
          requires a specific sport, such
          as attending or watching a live
          sports event.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <input
            value={newSportName}
            onChange={(event) =>
              setNewSportName(
                event.target.value
              )
            }
            placeholder="For example, Padel"
            className="rounded-xl border border-green-200 bg-white px-4 py-3 outline-none focus:border-green-500"
          />

          <input
            type="number"
            min="0"
            value={newSortOrder}
            onChange={(event) =>
              setNewSortOrder(
                event.target.value
              )
            }
            placeholder="Sort order"
            className="rounded-xl border border-green-200 bg-white px-4 py-3 outline-none focus:border-green-500"
          />

          <button
            type="button"
            disabled={
              isCreating ||
              newSportName.trim()
                .length < 2
            }
            onClick={createSport}
            className="rounded-xl bg-green-700 px-5 py-3 font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
          >
            {isCreating
              ? "Creating..."
              : "Add Sport"}
          </button>
        </div>

        {message && (
          <p
            className={
              message ===
              "Sport created."
                ? "mt-4 text-sm font-semibold text-green-700"
                : "mt-4 text-sm font-semibold text-red-700"
            }
          >
            {message}
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-bold text-gray-950">
          Sports
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          Rename, reorder, deactivate or
          delete unused sports.
        </p>

        <div className="mt-5 space-y-3">
          {sports.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              No sports have been added.
            </p>
          ) : (
            sports.map(
              (sport) => (
                <SportEditor
                  key={sport.id}
                  sport={sport}
                />
              )
            )
          )}
        </div>
      </section>
    </div>
  );
}
