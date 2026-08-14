"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import CommunityIcon from "@/components/communities/CommunityIcon";
import CommunityMembershipAdminPanel from "@/components/admin/CommunityMembershipAdminPanel";

import {
  COMMUNITY_ACCENT_PRESETS,
  COMMUNITY_ICON_OPTIONS,
  DEFAULT_COMMUNITY_ACCENT,
  communityAccentWithAlpha,
  expandCommunityHexColor,
  formatCommunityHexInput,
  getCommunityAccentForeground,
  getCommunityVisibleBorder,
  normalizeCommunityAccent,
  normalizeCommunitySecondary,
  slugifyCommunityName,
  type CommunityIconKey,
  type CommunityIntentAccessMode,
  type CommunityScopeType,
} from "@/utils/communities";
import {
  supabase,
} from "@/utils/supabase/client";

type AdminCategory = {
  id: string;
  name: string;
  is_active: boolean;
};

type AdminActivity = {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  activity_id: string | null;
  activity_name: string | null;
  is_active: boolean;
};

type AdminCommunity = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_key: CommunityIconKey;
  icon_url: string | null;
  cover_image_url: string | null;
  accent_color: string;
  secondary_color: string | null;
  scope_type: CommunityScopeType;
  intent_access_mode: CommunityIntentAccessMode;
  active_member_count: number | string;
  category_id: string | null;
  category_ids: string[];
  category_names: string[];
  activity_ids: string[];
  activity_names: string[];
  scope_label: string;
  status:
    | "active"
    | "inactive"
    | "archived";
  intent_count:
    | number
    | string;
  created_at: string;
  updated_at: string;
};

type AdminSuggestion = {
  id: string;
  suggested_name: string;
  description: string | null;
  category_id: string;
  category_name: string;
  activity_name: string | null;
  status:
    | "pending"
    | "approved_new"
    | "merged_existing"
    | "rejected";
  suggested_by_user_id: string;
  suggested_by_name: string;
  suggested_by_username: string | null;
  suggested_by_email: string | null;
  linked_community_id: string | null;
  linked_community_name: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type CommunityAdminCatalogue = {
  categories: AdminCategory[];
  activities: AdminActivity[];
  communities: AdminCommunity[];
  suggestions: AdminSuggestion[];
};

type CommunityFormState = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  iconKey: CommunityIconKey;
  iconUrl: string;
  coverImageUrl: string;
  accentColor: string;
  secondaryColor: string;
  scopeType: CommunityScopeType;
  intentAccessMode: CommunityIntentAccessMode;
  categoryIds: string[];
  activityIds: string[];
};

const EMPTY_FORM: CommunityFormState = {
  id: null,
  name: "",
  slug: "",
  description: "",
  iconKey: "people",
  iconUrl: "",
  coverImageUrl: "",
  accentColor:
    DEFAULT_COMMUNITY_ACCENT,
  secondaryColor: "",
  scopeType: "restricted",
  intentAccessMode: "open",
  categoryIds: [],
  activityIds: [],
};

function communityToFormState(
  community: AdminCommunity
): CommunityFormState {
  return {
    id: community.id,
    name: community.name,
    slug: community.slug,
    description:
      community.description ?? "",
    iconKey:
      community.icon_key,
    iconUrl:
      community.icon_url ?? "",
    coverImageUrl:
      community.cover_image_url ?? "",
    accentColor:
      normalizeCommunityAccent(
        community.accent_color
      ),
    secondaryColor:
      normalizeCommunitySecondary(
        community.secondary_color
      ) ?? "",
    scopeType:
      community.scope_type,
    intentAccessMode:
      community.intent_access_mode ?? "open",
    categoryIds:
      community.category_ids ?? [],
    activityIds:
      community.activity_ids ?? [],
  };
}

function CommunityAdminBrandHero({
  name,
  categoryLabel,
  iconKey,
  iconUrl,
  coverImageUrl,
  accentColor: rawAccentColor,
  secondaryColor: rawSecondaryColor,
  badge,
}: {
  name: string;
  categoryLabel: string;
  iconKey: CommunityIconKey;
  iconUrl: string | null;
  coverImageUrl: string | null;
  accentColor: string;
  secondaryColor: string | null;
  badge?: string | null;
}) {
  const accentColor = normalizeCommunityAccent(rawAccentColor);
  const secondaryColor = normalizeCommunitySecondary(rawSecondaryColor);
  const brandSecondaryColor = secondaryColor ?? accentColor;
  const visibleBorder = getCommunityVisibleBorder(
    accentColor,
    secondaryColor
  );
  const accentForeground = getCommunityAccentForeground(accentColor);
  const hasCover = Boolean(coverImageUrl?.trim());

  const fallbackHeroBackground = `linear-gradient(135deg, ${communityAccentWithAlpha(
    accentColor,
    1
  )} 0%, ${communityAccentWithAlpha(
    accentColor,
    1
  )} 72%, ${communityAccentWithAlpha(
    brandSecondaryColor,
    1
  )} 72%, ${communityAccentWithAlpha(
    brandSecondaryColor,
    1
  )} 100%)`;

  const imageReadabilityOverlay =
    "linear-gradient(90deg, rgba(3, 9, 24, 0.72) 0%, rgba(3, 9, 24, 0.44) 54%, rgba(3, 9, 24, 0.16) 100%)";

  const imageBrandWash = `linear-gradient(135deg, ${communityAccentWithAlpha(
    accentColor,
    0.22
  )} 0%, ${communityAccentWithAlpha(
    accentColor,
    0.08
  )} 62%, transparent 100%)`;

  return (
    <div
      className="group/hero pointer-events-none relative isolate min-h-48 overflow-hidden px-5 py-5"
      style={{
        color: hasCover ? "#FFFFFF" : accentForeground,
        backgroundColor: accentColor,
      }}
    >
      {hasCover ? (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-30 bg-cover bg-center transition-transform duration-500 group-hover/hero:scale-[1.045]"
            style={{
              backgroundImage: `url(${JSON.stringify(coverImageUrl)})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
              filter: "brightness(0.82) contrast(1.08) saturate(1.12)",
            }}
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 -z-20"
            style={{ backgroundImage: imageReadabilityOverlay }}
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{ backgroundImage: imageBrandWash }}
          />

          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 -z-[5] w-[34%]"
            style={{
              backgroundColor: communityAccentWithAlpha(
                brandSecondaryColor,
                0.82
              ),
              clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            }}
          />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{ backgroundImage: fallbackHeroBackground }}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-sm backdrop-blur-sm"
          style={{
            backgroundColor: communityAccentWithAlpha(
              "#FFFFFF",
              hasCover ? 0.78 : 0.34
            ),
            borderColor: communityAccentWithAlpha("#FFFFFF", 0.68),
            boxShadow: hasCover
              ? "0 8px 24px rgba(0, 0, 0, 0.22)"
              : `inset 0 0 0 2px ${visibleBorder}`,
            color: hasCover ? accentColor : undefined,
          }}
        >
          <CommunityIcon
            iconKey={iconKey || "people"}
            iconUrl={iconUrl}
            className="h-7 w-7"
          />
        </div>

        {badge && (
          <span
            className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm"
            style={{
              borderColor: communityAccentWithAlpha("#FFFFFF", 0.5),
              backgroundColor: hasCover
                ? "rgba(3, 9, 24, 0.5)"
                : communityAccentWithAlpha(accentForeground, 0.12),
              color: hasCover ? "#FFFFFF" : accentForeground,
            }}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="mt-8 max-w-[78%]">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-90"
          style={{
            textShadow: hasCover
              ? "0 2px 8px rgba(0, 0, 0, 0.7)"
              : undefined,
          }}
        >
          {categoryLabel}
        </p>
        <h3
          className="mt-1 text-2xl font-black leading-tight"
          style={{
            textShadow: hasCover
              ? "0 3px 12px rgba(0, 0, 0, 0.72)"
              : undefined,
          }}
        >
          {name || "Community preview"}
        </h3>
      </div>
    </div>
  );
}

function toNumber(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed = Number(
    value ?? 0
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatDateTime(
  value: string
) {
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
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function toggleId(
  values: string[],
  id: string
) {
  return values.includes(id)
    ? values.filter(
        (value) =>
          value !== id
      )
    : [...values, id];
}

function BrandColorPicker({
  value,
  onChange,
  label,
  optional = false,
}: {
  value: string;
  onChange: (
    value: string
  ) => void;
  label: string;
  optional?: boolean;
}) {
  const expandedColor =
    expandCommunityHexColor(
      value
    );

  const normalized = optional
    ? expandedColor ?? "#FFFFFF"
    : expandedColor ??
      DEFAULT_COMMUNITY_ACCENT;

  const hasInput =
    value.trim().length > 0;

  const isValid =
    Boolean(expandedColor);

  return (
    <div>
      <span className="text-sm font-semibold text-gray-700">
        {label}
      </span>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {optional && (
          <button
            type="button"
            onClick={() =>
              onChange("")
            }
            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
              value
                ? "border-gray-200 bg-white text-gray-600"
                : "border-indigo-400 bg-indigo-50 text-indigo-700"
            }`}
          >
            None
          </button>
        )}

        <input
          type="color"
          value={normalized}
          onChange={(event) =>
            onChange(
              event.target.value.toUpperCase()
            )
          }
          className="h-12 w-16 cursor-pointer rounded-xl border border-gray-200 bg-white p-1"
        />

        <div className="min-w-[11rem]">
          <input
            value={value}
            onChange={(event) =>
              onChange(
                formatCommunityHexInput(
                  event.target.value
                )
              )
            }
            onBlur={() => {
              if (!hasInput) {
                return;
              }

              const expanded =
                expandCommunityHexColor(
                  value
                );

              if (expanded) {
                onChange(expanded);
              }
            }}
            placeholder={
              optional
                ? "Optional, e.g. #FFFFFF"
                : "#4F46E5"
            }
            spellCheck={false}
            inputMode="text"
            className={`w-full rounded-xl border px-4 py-3 font-mono text-sm outline-none ${
              hasInput && !isValid
                ? "border-red-300 bg-red-50 focus:border-red-500"
                : "border-gray-200 focus:border-indigo-500"
            }`}
          />

          <p
            className={`mt-1 text-[11px] ${
              hasInput && !isValid
                ? "font-semibold text-red-600"
                : "text-gray-500"
            }`}
          >
            {hasInput && !isValid
              ? "Enter 3 or 6 HEX digits, with or without #."
              : isValid
                ? `Live color: ${normalized}`
                : "Type any HEX color."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {COMMUNITY_ACCENT_PRESETS.map(
            (preset) => (
              <button
                key={preset.value}
                type="button"
                title={preset.label}
                aria-label={`Use ${preset.label}`}
                onClick={() =>
                  onChange(
                    preset.value
                  )
                }
                className={`h-8 w-8 rounded-full border-2 transition ${
                  Boolean(value) &&
                  normalized ===
                  preset.value
                    ? "scale-110 border-gray-950"
                    : "border-white shadow ring-1 ring-gray-200"
                }`}
                style={{
                  backgroundColor:
                    preset.value,
                  boxShadow:
                    preset.value === "#FFFFFF"
                      ? "inset 0 0 0 1px #CBD5E1"
                      : undefined,
                }}
              />
            )
          )}
        </div>
      </div>

      <p className="mt-2 text-xs leading-5 text-gray-500">
        {optional
          ? "Optional second brand color. Presets are shortcuts only; any valid HEX color is accepted."
          : "Primary brand color. Presets are shortcuts only; type any 3- or 6-digit HEX value. White receives an automatic visible border."}
      </p>
    </div>
  );
}

function SuggestionReviewCard({
  suggestion,
  communities,
  onResolved,
}: {
  suggestion: AdminSuggestion;
  communities: AdminCommunity[];
  onResolved: () => Promise<void>;
}) {
  const [
    action,
    setAction,
  ] = useState<
    | "approve_new"
    | "merge_existing"
    | "reject"
  >("approve_new");

  const [
    existingCommunityId,
    setExistingCommunityId,
  ] = useState("");

  const [
    approvedName,
    setApprovedName,
  ] = useState(
    suggestion.suggested_name
  );

  const [
    approvedSlug,
    setApprovedSlug,
  ] = useState(
    slugifyCommunityName(
      suggestion.suggested_name
    )
  );

  const [
    description,
    setDescription,
  ] = useState(
    suggestion.description ?? ""
  );

  const [
    iconKey,
    setIconKey,
  ] = useState<CommunityIconKey>(
    "people"
  );

  const [
    iconUrl,
    setIconUrl,
  ] = useState("");

  const [
    accentColor,
    setAccentColor,
  ] = useState(
    DEFAULT_COMMUNITY_ACCENT
  );

  const [
    secondaryColor,
    setSecondaryColor,
  ] = useState("");

  const [
    reviewNote,
    setReviewNote,
  ] = useState("");

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const mergeOptions =
    communities.filter(
      (community) =>
        community.status !==
        "archived"
    );

  async function handleResolve() {
    setErrorMessage("");

    if (
      action ===
        "merge_existing" &&
      !existingCommunityId
    ) {
      setErrorMessage(
        "Select the existing Community this suggestion should be merged into."
      );
      return;
    }

    if (
      action === "approve_new" &&
      (
        !approvedName.trim() ||
        !approvedSlug.trim()
      )
    ) {
      setErrorMessage(
        "Approved name and slug are required."
      );
      return;
    }

    if (
      action === "approve_new" &&
      !/^#[0-9A-Fa-f]{6}$/.test(
        accentColor
      )
    ) {
      setErrorMessage(
        "Primary color must use a six-digit hex value."
      );
      return;
    }

    if (
      action === "approve_new" &&
      secondaryColor &&
      !/^#[0-9A-Fa-f]{6}$/.test(
        secondaryColor
      )
    ) {
      setErrorMessage(
        "Secondary color must be empty or use a six-digit hex value."
      );
      return;
    }

    setIsSaving(true);

    try {
      const {
        error,
      } = await supabase.rpc(
        "admin_resolve_community_suggestion",
        {
          p_suggestion_id:
            suggestion.id,
          p_action: action,
          p_existing_community_id:
            action ===
            "merge_existing"
              ? existingCommunityId
              : null,
          p_new_name:
            action ===
            "approve_new"
              ? approvedName
              : null,
          p_new_slug:
            action ===
            "approve_new"
              ? approvedSlug
              : null,
          p_description:
            action ===
            "approve_new"
              ? description || null
              : null,
          p_icon_key:
            iconKey,
          p_icon_url:
            iconUrl || null,
          p_accent_color:
            accentColor,
          p_review_note:
            reviewNote || null,
          p_secondary_color:
            secondaryColor || null,
        }
      );

      if (error) {
        throw error;
      }


      await onResolved();
    } catch (error) {
      console.error(
        "Community suggestion review failed:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Community suggestion could not be reviewed."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            {suggestion.activity_name
              ? `${suggestion.activity_name} · Exact Activity`
              : suggestion.category_name}
          </p>

          <h3 className="mt-1 text-xl font-bold text-gray-950">
            {suggestion.suggested_name}
          </h3>

          <p className="mt-2 text-sm text-gray-500">
            Suggested by{" "}
            <span className="font-semibold text-gray-800">
              {suggestion.suggested_by_name}
            </span>
            {suggestion.suggested_by_username
              ? ` · @${suggestion.suggested_by_username}`
              : ""}
          </p>

          {suggestion.description && (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
              {suggestion.description}
            </p>
          )}

          <p className="mt-3 text-xs text-gray-400">
            {formatDateTime(
              suggestion.created_at
            )}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          Pending
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <label className="lg:col-span-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Decision
          </span>

          <select
            value={action}
            onChange={(event) =>
              setAction(
                event.target.value as
                  | "approve_new"
                  | "merge_existing"
                  | "reject"
              )
            }
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500"
          >
            <option value="approve_new">
              Approve as new
            </option>
            <option value="merge_existing">
              Merge into existing
            </option>
            <option value="reject">
              Reject
            </option>
          </select>
        </label>

        {action ===
          "merge_existing" && (
          <label className="lg:col-span-9">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Existing Community
            </span>

            <select
              value={
                existingCommunityId
              }
              onChange={(event) =>
                setExistingCommunityId(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500"
            >
              <option value="">
                Select a Community
              </option>

              {mergeOptions.map(
                (community) => (
                  <option
                    key={community.id}
                    value={community.id}
                  >
                    {community.name} · {community.scope_label}
                  </option>
                )
              )}
            </select>
          </label>
        )}

        {action ===
          "approve_new" && (
          <>
            <label className="lg:col-span-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Approved name
              </span>

              <input
                value={approvedName}
                onChange={(event) => {
                  const nextName =
                    event.target.value;

                  setApprovedName(
                    nextName
                  );

                  setApprovedSlug(
                    slugifyCommunityName(
                      nextName
                    )
                  );
                }}
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500"
              />
            </label>

            <label className="lg:col-span-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Slug
              </span>

              <input
                value={approvedSlug}
                onChange={(event) =>
                  setApprovedSlug(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500"
              />
            </label>

            <label className="lg:col-span-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Icon
              </span>

              <select
                value={iconKey}
                onChange={(event) =>
                  setIconKey(
                    event.target.value as CommunityIconKey
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500"
              >
                {COMMUNITY_ICON_OPTIONS.map(
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

            <label className="lg:col-span-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Accent color
              </span>

              <div className="mt-2 flex gap-2">
                <input
                  type="color"
                  value={normalizeCommunityAccent(
                    accentColor
                  )}
                  onChange={(event) =>
                    setAccentColor(
                      formatCommunityHexInput(
                        event.target.value
                      )
                    )
                  }
                  className="h-11 w-14 rounded-xl border border-gray-200 p-1"
                />

                <input
                  value={accentColor}
                  onChange={(event) =>
                    setAccentColor(
                      formatCommunityHexInput(
                        event.target.value
                      )
                    )
                  }
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-3 font-mono text-sm outline-none focus:border-indigo-500"
                />
              </div>
            </label>

            <label className="lg:col-span-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Secondary color, optional
              </span>

              <div className="mt-2 flex gap-2">
                <input
                  type="color"
                  value={normalizeCommunitySecondary(
                    secondaryColor
                  ) ?? "#FFFFFF"}
                  onChange={(event) =>
                    setSecondaryColor(
                      formatCommunityHexInput(
                        event.target.value
                      )
                    )
                  }
                  className="h-11 w-14 rounded-xl border border-gray-200 p-1"
                />

                <input
                  value={secondaryColor}
                  onChange={(event) =>
                    setSecondaryColor(
                      formatCommunityHexInput(
                        event.target.value
                      )
                    )
                  }
                  placeholder="Optional, e.g. #FFFFFF"
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-3 font-mono text-sm outline-none focus:border-indigo-500"
                />
              </div>
            </label>

            <label className="lg:col-span-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Custom icon URL
              </span>

              <input
                value={iconUrl}
                onChange={(event) =>
                  setIconUrl(
                    event.target.value
                  )
                }
                placeholder="https://..."
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500"
              />
            </label>

            <label className="lg:col-span-8">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Description
              </span>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                className="mt-2 h-24 w-full resize-none rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500"
              />
            </label>
          </>
        )}

        <label className="lg:col-span-9">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Review note
          </span>

          <input
            value={reviewNote}
            onChange={(event) =>
              setReviewNote(
                event.target.value
              )
            }
            placeholder="Optional private review note"
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500"
          />
        </label>

        <div className="flex items-end lg:col-span-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleResolve}
            className={`w-full rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-60 ${
              action === "reject"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {isSaving
              ? "Saving..."
              : action ===
                  "approve_new"
                ? "Approve Community"
                : action ===
                    "merge_existing"
                  ? "Merge suggestion"
                  : "Reject suggestion"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {errorMessage}
        </p>
      )}
    </article>
  );
}

export default function CommunityAdminManager({
  initialCatalogue,
  initialEditCommunityId = null,
}: {
  initialCatalogue: CommunityAdminCatalogue;
  initialEditCommunityId?: string | null;
}) {
  const [
    catalogue,
    setCatalogue,
  ] = useState({
    categories:
      initialCatalogue.categories ?? [],
    activities:
      initialCatalogue.activities ?? [],
    communities:
      initialCatalogue.communities ?? [],
    suggestions:
      initialCatalogue.suggestions ?? [],
  });

  const initialCommunityToEdit =
    initialEditCommunityId
      ? initialCatalogue.communities.find(
          (community) =>
            community.id ===
              initialEditCommunityId ||
            community.slug ===
              initialEditCommunityId
        ) ?? null
      : null;

  const [
    form,
    setForm,
  ] = useState<CommunityFormState>(
    () =>
      initialCommunityToEdit
        ? communityToFormState(
            initialCommunityToEdit
          )
        : EMPTY_FORM
  );

  const [
    activitySearch,
    setActivitySearch,
  ] = useState("");

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const activeCategories =
    useMemo(
      () =>
        catalogue.categories.filter(
          (category) =>
            category.is_active
        ),
      [catalogue.categories]
    );

  const activeActivities =
    useMemo(
      () =>
        catalogue.activities.filter(
          (activity) =>
            activity.is_active
        ),
      [catalogue.activities]
    );

  const visibleActivities =
    useMemo(() => {
      const query =
        activitySearch
          .trim()
          .toLocaleLowerCase(
            "en-US"
          );

      if (!query) {
        return activeActivities;
      }

      return activeActivities.filter(
        (activity) =>
          activity.name
            .toLocaleLowerCase(
              "en-US"
            )
            .includes(query) ||
          activity.category_name
            .toLocaleLowerCase(
              "en-US"
            )
            .includes(query)
      );
    }, [
      activeActivities,
      activitySearch,
    ]);

  const pendingSuggestions =
    useMemo(
      () =>
        catalogue.suggestions.filter(
          (suggestion) =>
            suggestion.status ===
            "pending"
        ),
      [catalogue.suggestions]
    );

  async function refreshCatalogue() {
    const [
      catalogueResponse,
      coverResponse,
      accessResponse,
    ] = await Promise.all([
      supabase.rpc(
        "get_admin_community_catalogue"
      ),
      supabase.rpc(
        "get_admin_community_cover_images"
      ),
      supabase.rpc(
        "get_admin_community_access_catalogue"
      ),
    ]);

    if (catalogueResponse.error) {
      throw catalogueResponse.error;
    }

    if (coverResponse.error) {
      throw coverResponse.error;
    }

    if (accessResponse.error) {
      throw accessResponse.error;
    }

    const nextCatalogue =
      (
        catalogueResponse.data ?? {
          categories: [],
          activities: [],
          communities: [],
          suggestions: [],
        }
      ) as CommunityAdminCatalogue;

    const coverByCommunityId =
      new Map(
        (
          (coverResponse.data ?? []) as Array<{
            community_id: string;
            cover_image_url: string | null;
          }>
        ).map((row) => [
          row.community_id,
          row.cover_image_url,
        ])
      );

    const accessByCommunityId =
      new Map(
        (
          (accessResponse.data ?? []) as Array<{
            community_id: string;
            intent_access_mode: CommunityIntentAccessMode;
            active_member_count: number | string;
          }>
        ).map((row) => [
          row.community_id,
          row,
        ])
      );

    setCatalogue({
      categories:
        nextCatalogue.categories ?? [],
      activities:
        nextCatalogue.activities ?? [],
      communities:
        (nextCatalogue.communities ?? []).map(
          (community) => ({
            ...community,
            cover_image_url:
              coverByCommunityId.get(
                community.id
              ) ?? null,
            intent_access_mode:
              accessByCommunityId.get(
                community.id
              )?.intent_access_mode ?? "open",
            active_member_count:
              accessByCommunityId.get(
                community.id
              )?.active_member_count ?? 0,
          })
        ),
      suggestions:
        nextCatalogue.suggestions ?? [],
    });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setActivitySearch("");

    window.history.replaceState(
      null,
      "",
      "/admin/communities"
    );
  }

  function startEditing(
    community: AdminCommunity
  ) {
    setForm(
      communityToFormState(
        community
      )
    );

    window.history.replaceState(
      null,
      "",
      `/admin/communities?edit=${encodeURIComponent(
        community.id
      )}#community-editor`
    );

    window.requestAnimationFrame(
      () => {
        document
          .getElementById(
            "community-editor"
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }
    );
  }

  async function saveCommunity() {
    setMessage(null);

    if (
      !form.name.trim() ||
      !form.slug.trim()
    ) {
      setMessage({
        tone: "error",
        text:
          "Name and slug are required.",
      });
      return;
    }

    if (
      !/^#[0-9A-Fa-f]{6}$/.test(
        form.accentColor
      )
    ) {
      setMessage({
        tone: "error",
        text:
          "Accent color must use a six-digit hex value, such as #111111.",
      });
      return;
    }

    if (
      form.secondaryColor &&
      !/^#[0-9A-Fa-f]{6}$/.test(
        form.secondaryColor
      )
    ) {
      setMessage({
        tone: "error",
        text:
          "Secondary color must be empty or use a six-digit hex value, such as #FFFFFF.",
      });
      return;
    }

    if (
      form.coverImageUrl &&
      !/^https:\/\//i.test(
        form.coverImageUrl
      )
    ) {
      setMessage({
        tone: "error",
        text:
          "Cover image URL must use HTTPS.",
      });
      return;
    }

    if (
      form.scopeType ===
        "restricted" &&
      form.categoryIds.length ===
        0 &&
      form.activityIds.length ===
        0
    ) {
      setMessage({
        tone: "error",
        text:
          "Select at least one category or exact Activity, or choose All Activities.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const args = {
        p_name: form.name,
        p_slug: form.slug,
        p_description:
          form.description || null,
        p_icon_key:
          form.iconKey,
        p_icon_url:
          form.iconUrl || null,
        p_accent_color:
          form.accentColor,
        p_secondary_color:
          form.secondaryColor || null,
        p_scope_type:
          form.scopeType,
        p_category_ids:
          form.scopeType ===
          "global"
            ? []
            : form.categoryIds,
        p_activity_ids:
          form.scopeType ===
          "global"
            ? []
            : form.activityIds,
      };

      const saveResponse = form.id
        ? await supabase.rpc(
            "admin_update_community",
            {
              p_community_id:
                form.id,
              ...args,
            }
          )
        : await supabase.rpc(
            "admin_create_community",
            args
          );

      if (saveResponse.error) {
        throw saveResponse.error;
      }

      const savedCommunityId =
        form.id ??
        (typeof saveResponse.data ===
        "string"
          ? saveResponse.data
          : null);

      if (!savedCommunityId) {
        throw new Error(
          "Community was saved, but its identifier could not be resolved."
        );
      }

      const coverResponse =
        await supabase.rpc(
          "admin_set_community_cover_image",
          {
            p_community_id:
              savedCommunityId,
            p_cover_image_url:
              form.coverImageUrl ||
              null,
          }
        );

      if (coverResponse.error) {
        throw coverResponse.error;
      }

      const accessResponse =
        await supabase.rpc(
          "admin_set_community_intent_access",
          {
            p_community_id:
              savedCommunityId,
            p_intent_access_mode:
              form.intentAccessMode,
          }
        );

      if (accessResponse.error) {
        throw accessResponse.error;
      }

      await refreshCatalogue();

      setMessage({
        tone: "success",
        text: form.id
          ? "Community updated."
          : "Community created.",
      });

      resetForm();
    } catch (error) {
      console.error(
        "Community save failed:",
        error
      );

      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Community could not be saved.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function setCommunityStatus(
    communityId: string,
    status:
      | "active"
      | "inactive"
      | "archived"
  ) {
    setMessage(null);

    try {
      const {
        error,
      } = await supabase.rpc(
        "admin_set_community_status",
        {
          p_community_id:
            communityId,
          p_status: status,
        }
      );

      if (error) {
        throw error;
      }

      await refreshCatalogue();

      setMessage({
        tone: "success",
        text:
          `Community marked ${status}.`,
      });
    } catch (error) {
      console.error(
        "Community status update failed:",
        error
      );

      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Community status could not be changed.",
      });
    }
  }

  const accentColor =
    normalizeCommunityAccent(
      form.accentColor
    );

  const secondaryColor =
    normalizeCommunitySecondary(
      form.secondaryColor
    );

  const visibleBorder =
    getCommunityVisibleBorder(
      accentColor,
      secondaryColor
    );

  return (
    <div className="space-y-7">
      <section
        id="community-editor"
        className="scroll-mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
          Community catalogue
        </p>

        <h2 className="mt-2 text-2xl font-bold text-gray-950">
          {form.id
            ? "Edit Community"
            : "Create Community"}
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
          A Community may be global, apply to
          several categories, or be limited to
          exact Activities. Exact Activity is
          the precise layer; no artificial
          subcategory table is being smuggled
          into the product.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Name
            </span>

            <input
              value={form.name}
              onChange={(event) => {
                const nextName =
                  event.target.value;

                setForm(
                  (current) => ({
                    ...current,
                    name: nextName,
                    slug: current.id
                      ? current.slug
                      : slugifyCommunityName(
                          nextName
                        ),
                  })
                );
              }}
              placeholder="Beşiktaş JK"
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-indigo-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Slug
            </span>

            <input
              value={form.slug}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    slug:
                      event.target.value,
                  })
                )
              }
              placeholder="besiktas-jk"
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-indigo-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Icon
            </span>

            <select
              value={form.iconKey}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    iconKey:
                      event.target.value as CommunityIconKey,
                  })
                )
              }
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-indigo-500"
            >
              {COMMUNITY_ICON_OPTIONS.map(
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

          <BrandColorPicker
            label="Primary color"
            value={form.accentColor}
            onChange={(nextColor) =>
              setForm(
                (current) => ({
                  ...current,
                  accentColor:
                    nextColor,
                })
              )
            }
          />

          <BrandColorPicker
            label="Secondary color, optional"
            optional
            value={form.secondaryColor}
            onChange={(nextColor) =>
              setForm(
                (current) => ({
                  ...current,
                  secondaryColor:
                    nextColor,
                })
              )
            }
          />

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-gray-700">
              Custom icon URL, optional
            </span>

            <input
              value={form.iconUrl}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    iconUrl:
                      event.target.value,
                  })
                )
              }
              placeholder="https://..."
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-indigo-500"
            />
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-gray-700">
              Community cover image URL, optional
            </span>

            <input
              value={form.coverImageUrl}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    coverImageUrl:
                      event.target.value,
                  })
                )
              }
              placeholder="https://images.unsplash.com/..."
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-indigo-500"
            />

            <span className="text-xs leading-5 text-gray-500">
              The image appears here and in the catalogue with the same Community cover treatment used on /communities.
            </span>
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-gray-700">
              Description
            </span>

            <textarea
              value={form.description}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    description:
                      event.target.value,
                  })
                )
              }
              placeholder="Describe the broad context this Community adds to an Intent."
              className="h-28 resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-indigo-500"
            />
          </label>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <p className="text-sm font-bold text-gray-950">
            Community reach
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className={`cursor-pointer rounded-2xl border p-4 transition ${
              form.scopeType ===
              "global"
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200 bg-white"
            }`}>
              <input
                type="radio"
                name="community-scope"
                value="global"
                checked={
                  form.scopeType ===
                  "global"
                }
                onChange={() =>
                  setForm(
                    (current) => ({
                      ...current,
                      scopeType:
                        "global",
                    })
                  )
                }
                className="mr-2"
              />
              <span className="font-bold text-gray-950">
                All Activities
              </span>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Use rarely. This Community is
                selectable across the entire
                Activity catalogue.
              </p>
            </label>

            <label className={`cursor-pointer rounded-2xl border p-4 transition ${
              form.scopeType ===
              "restricted"
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200 bg-white"
            }`}>
              <input
                type="radio"
                name="community-scope"
                value="restricted"
                checked={
                  form.scopeType ===
                  "restricted"
                }
                onChange={() =>
                  setForm(
                    (current) => ({
                      ...current,
                      scopeType:
                        "restricted",
                    })
                  )
                }
                className="mr-2"
              />
              <span className="font-bold text-gray-950">
                Selected categories and Activities
              </span>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Combine broad category coverage
                with additional exact Activities.
              </p>
            </label>
          </div>

          {form.scopeType ===
            "restricted" && (
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div>
                  <p className="font-bold text-gray-950">
                    Categories
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Selecting a category makes the
                    Community available to every
                    Activity in that category.
                  </p>
                </div>

                <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {activeCategories.map(
                    (category) => (
                      <label
                        key={category.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                          form.categoryIds.includes(
                            category.id
                          )
                            ? "border-indigo-400 bg-indigo-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={
                            form.categoryIds.includes(
                              category.id
                            )
                          }
                          onChange={() =>
                            setForm(
                              (current) => ({
                                ...current,
                                categoryIds:
                                  toggleId(
                                    current.categoryIds,
                                    category.id
                                  ),
                              })
                            )
                          }
                          className="mt-1"
                        />
                        <span className="text-sm font-semibold text-gray-800">
                          {category.name}
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div>
                  <p className="font-bold text-gray-950">
                    Additional exact Activities
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    This is the precise layer that
                    replaces the need for a new
                    subcategory model.
                  </p>
                </div>

                <input
                  value={activitySearch}
                  onChange={(event) =>
                    setActivitySearch(
                      event.target.value
                    )
                  }
                  placeholder="Search Activities or categories"
                  className="mt-4 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                />

                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {visibleActivities.map(
                    (activity) => (
                      <label
                        key={activity.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                          form.activityIds.includes(
                            activity.id
                          )
                            ? "border-indigo-400 bg-indigo-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={
                            form.activityIds.includes(
                              activity.id
                            )
                          }
                          onChange={() =>
                            setForm(
                              (current) => ({
                                ...current,
                                activityIds:
                                  toggleId(
                                    current.activityIds,
                                    activity.id
                                  ),
                              })
                            )
                          }
                          className="mt-1"
                        />

                        <span>
                          <span className="block text-sm font-semibold text-gray-800">
                            {activity.name}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">
                            {activity.category_name}
                          </span>
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <p className="text-sm font-bold text-gray-950">
            Intent access
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Following and verified membership are separate. Choose whether anyone may attach this Community to an Intent or only people whose affiliation has been verified.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label
              className={`cursor-pointer rounded-2xl border p-4 transition ${
                form.intentAccessMode === "open"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <input
                type="radio"
                name="community-intent-access"
                value="open"
                checked={form.intentAccessMode === "open"}
                onChange={() =>
                  setForm((current) => ({
                    ...current,
                    intentAccessMode: "open",
                  }))
                }
                className="mr-2"
              />
              <span className="font-bold text-gray-950">
                Open Community context
              </span>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Any eligible UIN user may attach this Community to a compatible Intent. Useful for teams, fandoms and broad interest contexts.
              </p>
            </label>

            <label
              className={`cursor-pointer rounded-2xl border p-4 transition ${
                form.intentAccessMode === "verified_members"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <input
                type="radio"
                name="community-intent-access"
                value="verified_members"
                checked={form.intentAccessMode === "verified_members"}
                onChange={() =>
                  setForm((current) => ({
                    ...current,
                    intentAccessMode: "verified_members",
                  }))
                }
                className="mr-2"
              />
              <span className="font-bold text-gray-950">
                Verified members only
              </span>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Only users with an active verified membership may attach this Community to an Intent. Use for universities, workplaces, associations and other real affiliations.
              </p>
            </label>
          </div>
        </div>

        <div
          className="mt-5 overflow-hidden rounded-3xl border bg-white shadow-sm"
          style={{ borderColor: visibleBorder }}
        >
          <CommunityAdminBrandHero
            name={form.name || "Community preview"}
            categoryLabel={
              form.scopeType === "global"
                ? "All Activities"
                : activeCategories
                    .filter((category) =>
                      form.categoryIds.includes(category.id)
                    )
                    .map((category) => category.name)
                    .join(" · ") || "Curated Community"
            }
            iconKey={form.iconKey}
            iconUrl={form.iconUrl || null}
            coverImageUrl={form.coverImageUrl || null}
            accentColor={accentColor}
            secondaryColor={secondaryColor}
            badge={
              form.intentAccessMode === "verified_members"
                ? "Verified members only"
                : form.coverImageUrl
                  ? "Open · cover image set"
                  : "Open Community"
            }
          />

          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-gray-950">Community preview</p>
              <p className="mt-1 text-sm text-gray-600">
                {form.description ||
                  "Broad curated context for related Intents."}
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
              {form.scopeType === "global"
                ? "All Activities"
                : `${form.categoryIds.length} categories · ${form.activityIds.length} exact Activities`}
            </span>
          </div>
        </div>

        {form.id &&
          form.intentAccessMode === "verified_members" && (
            <CommunityMembershipAdminPanel
              communityId={form.id}
              communityName={form.name || "Community"}
            />
          )}

        {message && (
          <p className={`mt-5 rounded-xl border p-4 text-sm font-semibold ${
            message.tone ===
            "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}>
            {message.text}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={saveCommunity}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving
              ? "Saving..."
              : form.id
                ? "Save changes"
                : "Create Community"}
          </button>

          {form.id && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
            >
              Cancel edit
            </button>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
              Defined Communities
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Curated catalogue
            </h2>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
            {catalogue.communities.length} definitions
          </span>
        </div>

        {catalogue.communities.length >
        0 ? (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {catalogue.communities.map(
              (community) => {
                const communityAccent =
                  normalizeCommunityAccent(
                    community.accent_color
                  );

                const communitySecondary =
                  normalizeCommunitySecondary(
                    community.secondary_color
                  );

                const communityBorder =
                  getCommunityVisibleBorder(
                    communityAccent,
                    communitySecondary
                  );

                const categoryLabel =
                  community.category_names.length > 0
                    ? community.category_names.join(" · ")
                    : community.scope_type === "global"
                      ? "All Activities"
                      : "Curated Community";

                const visibleActivities = community.activity_names.slice(0, 3);
                const extraActivities = Math.max(
                  0,
                  community.activity_names.length - visibleActivities.length
                );

                return (
                  <article
                    key={community.id}
                    className="group flex min-h-[520px] flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                    style={{ borderColor: communityBorder }}
                  >
                    <CommunityAdminBrandHero
                      name={community.name}
                      categoryLabel={categoryLabel}
                      iconKey={community.icon_key}
                      iconUrl={community.icon_url}
                      coverImageUrl={community.cover_image_url}
                      accentColor={communityAccent}
                      secondaryColor={communitySecondary}
                      badge={community.status}
                    />

                    <div className="flex flex-1 flex-col p-5">
                      <p className="line-clamp-2 min-h-12 text-sm leading-6 text-gray-600">
                        {community.description ||
                          "A curated UIN Community context."}
                      </p>

                      <div className="mt-4 flex min-h-14 flex-wrap content-start gap-2">
                        {visibleActivities.length > 0 ? (
                          <>
                            {visibleActivities.map((activityName) => (
                              <span
                                key={activityName}
                                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-700"
                              >
                                {activityName}
                              </span>
                            ))}
                            {extraActivities > 0 && (
                              <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-500">
                                +{extraActivities} more
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-600">
                            {community.scope_type === "global"
                              ? "All Activities"
                              : categoryLabel}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-gray-50 p-3">
                        <div className="rounded-xl bg-white p-3 shadow-sm">
                          <p className="text-lg font-black text-gray-950">
                            {toNumber(community.intent_count)}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Intents
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-3 shadow-sm">
                          <p className="truncate text-sm font-bold text-gray-950">
                            /{community.slug}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Slug
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-3 shadow-sm">
                          <p className={`text-sm font-black ${
                            community.intent_access_mode === "verified_members"
                              ? "text-emerald-700"
                              : "text-gray-950"
                          }`}>
                            {community.intent_access_mode === "verified_members"
                              ? "Members only"
                              : "Open"}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Intent access
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-3 shadow-sm">
                          <p className="text-lg font-black text-gray-950">
                            {toNumber(community.active_member_count)}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Verified members
                          </p>
                        </div>

                        <div className="col-span-2 rounded-xl bg-white p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Cover image
                              </p>
                              <p className={`mt-1 text-sm font-bold ${
                                community.cover_image_url
                                  ? "text-green-700"
                                  : "text-amber-700"
                              }`}>
                                {community.cover_image_url
                                  ? "Configured and visible"
                                  : "No custom cover"}
                              </p>
                            </div>

                            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                              <span
                                className="h-3 w-3 rounded-full ring-1 ring-gray-300"
                                style={{ backgroundColor: communityAccent }}
                              />
                              {communitySecondary && (
                                <span
                                  className="h-3 w-3 rounded-full ring-1 ring-gray-300"
                                  style={{ backgroundColor: communitySecondary }}
                                />
                              )}
                              Brand
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          Applies to
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-gray-800">
                          {community.scope_label}
                        </p>
                      </div>

                      <div className="relative z-10 mt-auto flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                        <button
                          type="button"
                          onClick={() => startEditing(community)}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                        >
                          Edit
                        </button>

                        <Link
                          href={`/communities/${community.slug}`}
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700"
                        >
                          Open Community
                        </Link>

                        {community.status === "active" ? (
                          <button
                            type="button"
                            onClick={() =>
                              setCommunityStatus(community.id, "inactive")
                            }
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setCommunityStatus(community.id, "active")
                            }
                            className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800"
                          >
                            Activate
                          </button>
                        )}

                        {community.status !== "archived" && (
                          <button
                            type="button"
                            onClick={() =>
                              setCommunityStatus(community.id, "archived")
                            }
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800"
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            No Communities have been defined.
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              Community suggestions
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Review, merge or reject
            </h2>
          </div>

          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            {pendingSuggestions.length} pending
          </span>
        </div>

        {pendingSuggestions.length >
        0 ? (
          <div className="mt-5 space-y-4">
            {pendingSuggestions.map(
              (suggestion) => (
                <SuggestionReviewCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  communities={
                    catalogue.communities
                  }
                  onResolved={
                    refreshCatalogue
                  }
                />
              )
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            No Community suggestions are waiting for review.
          </div>
        )}
      </section>
    </div>
  );
}
