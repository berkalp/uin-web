"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";

import { supabase } from "@/utils/supabase/client";

export type AdminSeedType = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  seed_count: number | string;
  suggested_activity_ids: string[] | null;
};

export type SeedActivityOption = {
  id: string;
  name: string;
  category_name: string;
  is_active: boolean;
};

type EditorValue = {
  name: string;
  slug: string;
  icon: string;
  description: string;
  isActive: boolean;
  sortOrder: string;
  suggestedActivityIds: string[];
};

function toCount(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function SeedTypeEditor({
  seedType,
  activities,
}: {
  seedType: AdminSeedType;
  activities: SeedActivityOption[];
}) {
  const router = useRouter();
  const [value, setValue] = useState<EditorValue>({
    name: seedType.name,
    slug: seedType.slug,
    icon: seedType.icon,
    description: seedType.description ?? "",
    isActive: seedType.is_active,
    sortOrder: String(seedType.sort_order),
    suggestedActivityIds: seedType.suggested_activity_ids ?? [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const seedCount = toCount(seedType.seed_count);

  async function save() {
    const sortOrder = Number(value.sortOrder);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setMessage("Sort order must be zero or greater.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.rpc("admin_upsert_seed_type", {
      p_seed_type_id: seedType.id,
      p_name: value.name,
      p_slug: value.slug,
      p_icon: value.icon,
      p_description: value.description || null,
      p_is_active: value.isActive,
      p_sort_order: sortOrder,
      p_suggested_activity_ids: value.suggestedActivityIds,
    });

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Saved.");
    router.refresh();
  }

  async function remove() {
    if (seedCount > 0) {
      setMessage("This Seed Type is in use. Deactivate it instead.");
      return;
    }

    if (!window.confirm(`Delete ${seedType.name}?`)) {
      return;
    }

    setIsDeleting(true);
    setMessage(null);

    const { error } = await supabase.rpc("admin_delete_seed_type", {
      p_seed_type_id: seedType.id,
    });

    setIsDeleting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[90px_minmax(0,1fr)_160px]">
        <label>
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Icon
          </span>
          <input
            value={value.icon}
            onChange={(event) =>
              setValue((current) => ({ ...current, icon: event.target.value }))
            }
            maxLength={16}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-center text-2xl outline-none focus:border-green-500"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Name
            </span>
            <input
              value={value.name}
              onChange={(event) =>
                setValue((current) => ({ ...current, name: event.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold outline-none focus:border-green-500"
            />
          </label>

          <label>
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Slug
            </span>
            <input
              value={value.slug}
              onChange={(event) =>
                setValue((current) => ({ ...current, slug: slugify(event.target.value) }))
              }
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
            />
          </label>

          <label className="md:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Description
            </span>
            <input
              value={value.description}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
            />
          </label>
        </div>

        <div className="space-y-3">
          <label>
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Sort order
            </span>
            <input
              type="number"
              min="0"
              value={value.sortOrder}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  sortOrder: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
            />
          </label>

          <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={value.isActive}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
            />
            Active
          </label>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-bold uppercase tracking-wide text-violet-700">
          Suggested Activities
        </span>
        <span className="ml-2 text-xs text-gray-400">
          First selected Activity becomes the default when a Seed grows.
        </span>
        <select
          multiple
          value={value.suggestedActivityIds}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            setValue((current) => ({
              ...current,
              suggestedActivityIds: Array.from(
                event.currentTarget.selectedOptions
              ).map((option) => option.value),
            }))
          }
          className="mt-2 h-36 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-500"
        >
          {activities.map((activity) => (
            <option key={activity.id} value={activity.id}>
              {activity.category_name} · {activity.name}
              {activity.is_active ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-500">
          {seedCount} Seed{seedCount === 1 ? "" : "s"} use this type
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={isSaving || value.name.trim().length < 2 || !value.slug}
            className="rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={isDeleting || seedCount > 0}
            className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>

      {message && (
        <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
          {message}
        </p>
      )}
    </article>
  );
}

export default function SeedTypesManager({
  seedTypes,
  activities,
}: {
  seedTypes: AdminSeedType[];
  activities: SeedActivityOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🌱");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function create() {
    setIsCreating(true);
    setMessage(null);

    const { error } = await supabase.rpc("admin_upsert_seed_type", {
      p_seed_type_id: null,
      p_name: name,
      p_slug: slugify(name),
      p_icon: icon,
      p_description: description || null,
      p_is_active: true,
      p_sort_order: seedTypes.length * 10 + 10,
      p_suggested_activity_ids: [],
    });

    setIsCreating(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setName("");
    setIcon("🌱");
    setDescription("");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-green-200 bg-green-50 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-green-700">
          Add Seed Type
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[90px_minmax(0,0.6fr)_minmax(0,1fr)_auto]">
          <input
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
            maxLength={16}
            className="rounded-xl border border-green-200 bg-white px-3 py-3 text-center text-2xl outline-none focus:border-green-500"
          />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Reflect"
            className="rounded-xl border border-green-200 bg-white px-4 py-3 font-semibold outline-none focus:border-green-500"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this Seed Type is for"
            className="rounded-xl border border-green-200 bg-white px-4 py-3 outline-none focus:border-green-500"
          />
          <button
            type="button"
            onClick={create}
            disabled={isCreating || name.trim().length < 2}
            className="rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            Add Type
          </button>
        </div>
        {message && (
          <p className="mt-3 text-sm font-semibold text-red-700">{message}</p>
        )}
      </section>

      {seedTypes.map((seedType) => (
        <SeedTypeEditor
          key={seedType.id}
          seedType={seedType}
          activities={activities}
        />
      ))}
    </div>
  );
}
