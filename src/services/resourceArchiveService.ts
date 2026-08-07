import { supabase } from "@/utils/supabase/client";

export type ArchiveResourceType =
  | "intent"
  | "plan";

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

export async function archiveResource(
  resourceType: ArchiveResourceType,
  resourceId: string
) {
  const { error } = await supabase.rpc(
    "archive_my_resource",
    {
      p_resource_type: resourceType,
      p_resource_id: resourceId,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "The record could not be archived."
      )
    );
  }
}

export async function restoreArchivedResource(
  resourceType: ArchiveResourceType,
  resourceId: string
) {
  const { error } = await supabase.rpc(
    "restore_my_archived_resource",
    {
      p_resource_type: resourceType,
      p_resource_id: resourceId,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "The record could not be restored."
      )
    );
  }
}

export async function deleteArchivedIntent(
  intentId: string
) {
  const { error } = await supabase.rpc(
    "delete_my_archived_intent",
    {
      p_intent_id: intentId,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "The Intent could not be deleted."
      )
    );
  }
}
