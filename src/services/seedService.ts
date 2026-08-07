import { supabase } from "@/utils/supabase/client";
import {
  parseSeedReactionContext,
  type SeedCompletionPrecision,
  type SeedJournalAttachment,
  type SeedLink,
  type SeedReactionContext,
  type SeedStatus,
  type SeedVisibility,
} from "@/utils/seeds";

type SaveSeedInput = {
  seedId?: string | null;
  seedTypeId: string;
  title: string;
  subtitle: string;
  notes: string;
  coverUrl: string;
  links: SeedLink[];
  visibility: SeedVisibility;
  targetDate: string;
};

type SaveSeedJournalEntryInput = {
  seedId: string;
  entryId?: string | null;
  entryKind?: "update" | "reflection";
  body: string;
  keyTakeaway?: string;
  visibility: SeedVisibility;
  occurredOn: string;
  attachments: SeedJournalAttachment[];
};

type CompleteSeedInput = {
  seedId: string;
  completedOn: string;
  completedDatePrecision: SeedCompletionPrecision;
  completedYear: string;
  reflection: string;
  keyTakeaway: string;
  visibility: SeedVisibility;
  attachments: SeedJournalAttachment[];
};

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function serializeLinks(links: SeedLink[]) {
  return links
    .filter((link) => link.url.trim())
    .map((link, index) => ({
      url: link.url.trim(),
      label: nullable(link.label ?? ""),
      description: nullable(link.description ?? ""),
      kind: link.kind,
      sort_order: index,
    }));
}

function serializeAttachments(attachments: SeedJournalAttachment[]) {
  return attachments
    .filter((item) => item.url.trim())
    .map((item, index) => ({
      url: item.url.trim(),
      kind: item.kind,
      label: nullable(item.label ?? ""),
      caption: nullable(item.caption ?? ""),
      sort_order: index,
    }));
}

export async function saveSeed({
  seedId = null,
  seedTypeId,
  title,
  subtitle,
  notes,
  coverUrl,
  links,
  visibility,
  targetDate,
}: SaveSeedInput) {
  const functionName = seedId
    ? "update_my_seed_v2"
    : "create_my_seed_v2";

  const commonPayload = {
    p_seed_type_id: seedTypeId,
    p_title: title.trim(),
    p_subtitle: nullable(subtitle),
    p_notes: nullable(notes),
    p_cover_url: nullable(coverUrl),
    p_visibility: visibility,
    p_target_date: nullable(targetDate),
    p_links: serializeLinks(links),
  };

  const { data, error } = await supabase.rpc(
    functionName,
    seedId
      ? {
          p_seed_id: seedId,
          ...commonPayload,
        }
      : commonPayload
  );

  if (error) {
    throw new Error(error.message || "The Seed could not be saved.");
  }

  if (typeof data !== "string") {
    throw new Error("The Seed could not be saved.");
  }

  return data;
}

export async function setSeedStatus(
  seedId: string,
  status: SeedStatus
) {
  const { error } = await supabase.rpc(
    "set_my_seed_status",
    {
      p_seed_id: seedId,
      p_status: status,
    }
  );

  if (error) {
    throw new Error(
      error.message || "The Seed status could not be updated."
    );
  }
}

export async function completeSeed({
  seedId,
  completedOn,
  completedDatePrecision,
  completedYear,
  reflection,
  keyTakeaway,
  visibility,
  attachments,
}: CompleteSeedInput) {
  const { data, error } = await supabase.rpc(
    "complete_my_seed_with_reflection_v2",
    {
      p_seed_id: seedId,
      p_completed_on: nullable(completedOn),
      p_completed_date_precision: completedDatePrecision,
      p_completed_year: completedYear.trim()
        ? Number.parseInt(completedYear, 10)
        : null,
      p_reflection: nullable(reflection),
      p_key_takeaway: nullable(keyTakeaway),
      p_visibility: visibility,
      p_attachments: serializeAttachments(attachments),
    }
  );

  if (error) {
    throw new Error(error.message || "The Seed could not be completed.");
  }

  if (typeof data !== "string") {
    throw new Error("The Seed could not be completed.");
  }

  return data;
}

export async function saveSeedJournalEntry({
  seedId,
  entryId = null,
  entryKind = "update",
  body,
  keyTakeaway = "",
  visibility,
  occurredOn,
  attachments,
}: SaveSeedJournalEntryInput) {
  const { data, error } = await supabase.rpc(
    "save_my_seed_journal_entry",
    {
      p_seed_id: seedId,
      p_entry_id: entryId,
      p_entry_kind: entryKind,
      p_body: nullable(body),
      p_key_takeaway: nullable(keyTakeaway),
      p_visibility: visibility,
      p_occurred_on: nullable(occurredOn),
      p_attachments: serializeAttachments(attachments),
    }
  );

  if (error) {
    throw new Error(
      error.message || "The Seed journal entry could not be saved."
    );
  }

  if (typeof data !== "string") {
    throw new Error("The Seed journal entry could not be saved.");
  }

  return data;
}

export async function deleteSeedJournalEntry(entryId: string) {
  const { data, error } = await supabase.rpc(
    "delete_my_seed_journal_entry",
    {
      p_entry_id: entryId,
    }
  );

  if (error) {
    throw new Error(
      error.message || "The Seed journal entry could not be deleted."
    );
  }

  return data === true;
}

export async function setMySeedReaction({
  seedId,
  reactionType,
  active,
}: {
  seedId: string;
  reactionType: "save" | "water";
  active: boolean;
}): Promise<SeedReactionContext> {
  const { data, error } = await supabase.rpc(
    "set_my_seed_reaction",
    {
      p_seed_id: seedId,
      p_reaction_type: reactionType,
      p_active: active,
    }
  );

  if (error) {
    throw new Error(error.message || "The Seed reaction could not be saved.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  const parsed = parseSeedReactionContext(row);

  if (!parsed) {
    throw new Error("The Seed reaction could not be refreshed.");
  }

  return parsed;
}

export async function deleteSeed(seedId: string) {
  const { data, error } = await supabase.rpc(
    "delete_my_seed",
    {
      p_seed_id: seedId,
    }
  );

  if (error) {
    throw new Error(error.message || "The Seed could not be deleted.");
  }

  return data === true;
}

export async function linkSeedToIntent(
  seedId: string,
  intentId: string
) {
  const { error } = await supabase.rpc(
    "link_my_seed_to_intent",
    {
      p_seed_id: seedId,
      p_intent_id: intentId,
      p_relationship: "spawned_from",
    }
  );

  if (error) {
    throw new Error(
      error.message || "The Seed could not be linked to the Intent."
    );
  }
}
