"use client";

import { useState } from "react";

import { addPastSeedExperience } from "@/app/seeds/explore/actions";
import {
  SEED_VISIBILITY_OPTIONS,
  type SeedCompletionPrecision,
} from "@/utils/seeds";

type PastSeedExperienceFormProps = {
  catalogItemId: string;
  returnTo: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function PastSeedExperienceForm({
  catalogItemId,
  returnTo,
}: PastSeedExperienceFormProps) {
  const [precision, setPrecision] =
    useState<SeedCompletionPrecision>("unknown");

  return (
    <form action={addPastSeedExperience} className="space-y-7">
      <input type="hidden" name="catalog_item_id" value={catalogItemId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="completion_precision" value={precision} />

      <div>
        <p className="text-sm font-black text-gray-950">
          When did you complete it?
        </p>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          Use the level of accuracy you genuinely remember.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["exact", "Exact date", "I remember the date."],
            ["year", "Year only", "I remember only the year."],
            ["unknown", "I don’t remember", "Save it without a public date."],
          ].map(([value, label, description]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPrecision(value as SeedCompletionPrecision)}
              className={`rounded-2xl border p-4 text-left transition ${
                precision === value
                  ? "border-purple-500 bg-purple-50 ring-4 ring-purple-100"
                  : "border-gray-200 bg-white hover:border-gray-400"
              }`}
            >
              <span className="block text-sm font-black text-gray-950">
                {label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-gray-500">
                {description}
              </span>
            </button>
          ))}
        </div>

        {precision === "exact" && (
          <label className="mt-4 block">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">
              Completion date
            </span>
            <input
              type="date"
              name="completed_on"
              required
              max={today()}
              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
            />
          </label>
        )}

        {precision === "year" && (
          <label className="mt-4 block">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">
              Completion year
            </span>
            <input
              type="number"
              name="completed_year"
              required
              min={1}
              max={new Date().getFullYear()}
              placeholder="2018"
              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
            />
          </label>
        )}
      </div>

      <label className="block">
        <span className="text-sm font-black text-gray-950">
          My Experience
        </span>
        <span className="mt-1 block text-sm leading-6 text-gray-500">
          Optional. You can simply record that you did it and write the Experience
          later from the completed Seed page.
        </span>
        <textarea
          name="reflection"
          rows={7}
          maxLength={6000}
          placeholder="What stayed with you, what surprised you, or what would you tell someone considering the same Seed?"
          className="mt-3 w-full resize-y rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
        />
      </label>

      <label className="block">
        <span className="text-sm font-black text-gray-950">
          A concise takeaway
        </span>
        <span className="mt-1 block text-sm leading-6 text-gray-500">
          Optional. This can appear on your completed Seed card.
        </span>
        <textarea
          name="key_takeaway"
          rows={3}
          maxLength={1000}
          placeholder="One thought that remained after the experience."
          className="mt-3 w-full resize-y rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
        />
      </label>

      <div>
        <p className="text-sm font-black text-gray-950">
          Who can see this completed Seed?
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {SEED_VISIBILITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50 has-[:checked]:ring-4 has-[:checked]:ring-purple-100"
            >
              <input
                type="radio"
                name="visibility"
                value={option.value}
                defaultChecked={option.value === "only_me"}
                className="sr-only"
              />
              <span className="block text-sm font-black text-gray-950">
                {option.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-gray-500">
                {option.description}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-6">
        <a
          href={returnTo.replace("/past", "")}
          className="rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:border-gray-950"
        >
          Cancel
        </a>
        <button
          type="submit"
          className="rounded-2xl bg-purple-600 px-6 py-3 text-sm font-black text-white hover:bg-purple-700"
        >
          Add past experience
        </button>
      </div>
    </form>
  );
}
