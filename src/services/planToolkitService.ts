import { supabase } from "@/utils/supabase/client";

export type PlanToolkitTaskImportance = "required" | "optional";
export type PlanToolkitTaskStatus =
  | "todo"
  | "in_progress"
  | "awaiting_approval"
  | "done";

export type PlanToolkitFileKind = "file" | "link";
export type PlanToolkitFileCategory =
  | "tickets"
  | "reservations"
  | "routes"
  | "documents"
  | "receipts"
  | "other";
export type PlanToolkitFileVisibility =
  | "plan_members"
  | "hosts_only"
  | "selected"
  | "only_me";

export type PlanToolkitPerson = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: string | null;
};

export type PlanToolkitTask = {
  id: string;
  planId: string;
  title: string;
  description: string | null;
  importance: PlanToolkitTaskImportance;
  status: PlanToolkitTaskStatus;
  dueAt: string | null;
  requiresHostApproval: boolean;
  allowVolunteers: boolean;
  createdBy: string | null;
  completedBy: string | null;
  completedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canManage: boolean;
  viewerIsAssigned: boolean;
  canClaim: boolean;
  assignees: PlanToolkitPerson[];
  attachmentCount: number;
};

export type PlanToolkitFile = {
  id: string;
  planId: string;
  taskId: string | null;
  taskTitle: string | null;
  uploadedBy: string | null;
  uploaderFullName: string | null;
  uploaderUsername: string | null;
  uploaderAvatarUrl: string | null;
  kind: PlanToolkitFileKind;
  storagePath: string | null;
  signedUrl: string | null;
  externalUrl: string | null;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  category: PlanToolkitFileCategory;
  description: string | null;
  visibility: PlanToolkitFileVisibility;
  sensitive: boolean;
  recipients: PlanToolkitPerson[];
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
};

type UnknownRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecord(value: unknown): UnknownRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRow)
    : {};
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

function parsePerson(value: unknown): PlanToolkitPerson | null {
  const row = asRecord(value);
  const userId = asString(row.user_id);

  if (!userId) {
    return null;
  }

  return {
    userId,
    fullName: asString(row.full_name),
    username: asString(row.username),
    avatarUrl: asString(row.avatar_url),
    role: asString(row.role),
  };
}

function parsePeople(value: unknown): PlanToolkitPerson[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(parsePerson)
    .filter((person): person is PlanToolkitPerson => person !== null);
}

function parseTask(value: unknown): PlanToolkitTask | null {
  const row = asRecord(value);
  const id = asString(row.task_id);
  const planId = asString(row.plan_id);
  const title = asString(row.title);

  if (!id || !planId || !title) {
    return null;
  }

  const rawStatus = asString(row.status);
  const status: PlanToolkitTaskStatus =
    rawStatus === "in_progress" ||
    rawStatus === "awaiting_approval" ||
    rawStatus === "done"
      ? rawStatus
      : "todo";

  return {
    id,
    planId,
    title,
    description: asString(row.description),
    importance: row.importance === "optional" ? "optional" : "required",
    status,
    dueAt: asString(row.due_at),
    requiresHostApproval: asBoolean(row.requires_host_approval),
    allowVolunteers: asBoolean(row.allow_volunteers),
    createdBy: asString(row.created_by),
    completedBy: asString(row.completed_by),
    completedAt: asString(row.completed_at),
    approvedBy: asString(row.approved_by),
    approvedAt: asString(row.approved_at),
    createdAt: asString(row.created_at) ?? "",
    updatedAt: asString(row.updated_at) ?? "",
    canManage: asBoolean(row.can_manage),
    viewerIsAssigned: asBoolean(row.viewer_is_assigned),
    canClaim: asBoolean(row.can_claim),
    assignees: parsePeople(row.assignees),
    attachmentCount: Math.max(0, Math.trunc(asNumber(row.attachment_count))),
  };
}

function parseFile(value: unknown): PlanToolkitFile | null {
  const row = asRecord(value);
  const id = asString(row.file_id);
  const planId = asString(row.plan_id);
  const fileName = asString(row.file_name);

  if (!id || !planId || !fileName) {
    return null;
  }

  const rawCategory = asString(row.category);
  const category: PlanToolkitFileCategory =
    rawCategory === "tickets" ||
    rawCategory === "reservations" ||
    rawCategory === "routes" ||
    rawCategory === "documents" ||
    rawCategory === "receipts"
      ? rawCategory
      : "other";

  const rawVisibility = asString(row.visibility);
  const visibility: PlanToolkitFileVisibility =
    rawVisibility === "hosts_only" ||
    rawVisibility === "selected" ||
    rawVisibility === "only_me"
      ? rawVisibility
      : "plan_members";

  return {
    id,
    planId,
    taskId: asString(row.task_id),
    taskTitle: asString(row.task_title),
    uploadedBy: asString(row.uploaded_by),
    uploaderFullName: asString(row.uploader_full_name),
    uploaderUsername: asString(row.uploader_username),
    uploaderAvatarUrl: asString(row.uploader_avatar_url),
    kind: row.kind === "link" ? "link" : "file",
    storagePath: asString(row.storage_path),
    signedUrl: null,
    externalUrl: asString(row.external_url),
    fileName,
    mimeType: asString(row.mime_type),
    fileSize: row.file_size === null ? null : Math.max(0, asNumber(row.file_size)),
    category,
    description: asString(row.description),
    visibility,
    sensitive: asBoolean(row.sensitive),
    recipients: parsePeople(row.recipients),
    canDelete: asBoolean(row.can_delete),
    createdAt: asString(row.created_at) ?? "",
    updatedAt: asString(row.updated_at) ?? "",
  };
}

export async function getPlanToolkitTasks(planId: string) {
  const { data, error } = await supabase.rpc("get_plan_toolkit_tasks_v1", {
    p_plan_id: planId,
  });

  if (error) {
    throw new Error(getErrorMessage(error, "Checklist could not be loaded."));
  }

  return (Array.isArray(data) ? data : [])
    .map(parseTask)
    .filter((task): task is PlanToolkitTask => task !== null);
}

export async function getPlanToolkitFiles(planId: string) {
  const { data, error } = await supabase.rpc("get_plan_toolkit_files_v1", {
    p_plan_id: planId,
  });

  if (error) {
    throw new Error(getErrorMessage(error, "Plan files could not be loaded."));
  }

  const files = (Array.isArray(data) ? data : [])
    .map(parseFile)
    .filter((file): file is PlanToolkitFile => file !== null);

  return Promise.all(
    files.map(async (file) => {
      if (file.kind !== "file" || !file.storagePath) {
        return file;
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from("plan-files")
        .createSignedUrl(file.storagePath, 60 * 60);

      if (signedError) {
        console.error("Plan file signed URL failed:", signedError);
        return file;
      }

      return {
        ...file,
        signedUrl: signedData?.signedUrl ?? null,
      };
    })
  );
}

export async function createPlanToolkitTask(input: {
  planId: string;
  title: string;
  description: string | null;
  importance: PlanToolkitTaskImportance;
  dueAt: string | null;
  requiresHostApproval: boolean;
  allowVolunteers: boolean;
  assigneeIds: string[];
}) {
  const { data, error } = await supabase.rpc("create_plan_toolkit_task_v1", {
    p_plan_id: input.planId,
    p_title: input.title,
    p_description: input.description,
    p_importance: input.importance,
    p_due_at: input.dueAt,
    p_requires_host_approval: input.requiresHostApproval,
    p_allow_volunteers: input.allowVolunteers,
    p_assignee_ids: input.assigneeIds,
  });

  if (error) {
    throw new Error(getErrorMessage(error, "Checklist task could not be created."));
  }

  return typeof data === "string" ? data : null;
}

export async function updatePlanToolkitTask(input: {
  taskId: string;
  title: string;
  description: string | null;
  importance: PlanToolkitTaskImportance;
  dueAt: string | null;
  requiresHostApproval: boolean;
  allowVolunteers: boolean;
  assigneeIds: string[];
}) {
  const { error } = await supabase.rpc("update_plan_toolkit_task_v1", {
    p_task_id: input.taskId,
    p_title: input.title,
    p_description: input.description,
    p_importance: input.importance,
    p_due_at: input.dueAt,
    p_requires_host_approval: input.requiresHostApproval,
    p_allow_volunteers: input.allowVolunteers,
    p_assignee_ids: input.assigneeIds,
  });

  if (error) {
    throw new Error(getErrorMessage(error, "Checklist task could not be updated."));
  }
}

export async function deletePlanToolkitTask(taskId: string) {
  const { error } = await supabase.rpc("delete_plan_toolkit_task_v1", {
    p_task_id: taskId,
  });

  if (error) {
    throw new Error(getErrorMessage(error, "Checklist task could not be deleted."));
  }
}

export async function claimPlanToolkitTask(taskId: string) {
  const { error } = await supabase.rpc("claim_plan_toolkit_task_v1", {
    p_task_id: taskId,
  });

  if (error) {
    throw new Error(getErrorMessage(error, "The task could not be claimed."));
  }
}

export async function unclaimPlanToolkitTask(taskId: string) {
  const { error } = await supabase.rpc("unclaim_plan_toolkit_task_v1", {
    p_task_id: taskId,
  });

  if (error) {
    throw new Error(getErrorMessage(error, "The task could not be released."));
  }
}

export async function setPlanToolkitTaskStatus(
  taskId: string,
  status: "todo" | "in_progress" | "done"
) {
  const { data, error } = await supabase.rpc("set_plan_toolkit_task_status_v1", {
    p_task_id: taskId,
    p_status: status,
  });

  if (error) {
    throw new Error(getErrorMessage(error, "Task status could not be updated."));
  }

  return typeof data === "string" ? data : status;
}

export async function reviewPlanToolkitTask(taskId: string, approve: boolean) {
  const { data, error } = await supabase.rpc("review_plan_toolkit_task_v1", {
    p_task_id: taskId,
    p_approve: approve,
  });

  if (error) {
    throw new Error(getErrorMessage(error, "Task approval could not be saved."));
  }

  return typeof data === "string" ? data : approve ? "done" : "in_progress";
}

function getFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension ? `.${extension}` : "";
}

export async function uploadPlanToolkitFile(input: {
  planId: string;
  file: File;
  category: PlanToolkitFileCategory;
  description: string | null;
  visibility: PlanToolkitFileVisibility;
  sensitive: boolean;
  taskId: string | null;
  recipientIds: string[];
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Sign in again before uploading a file.");
  }

  if (input.file.size > 50 * 1024 * 1024) {
    throw new Error("Files must be 50 MB or smaller.");
  }

  const safeBaseName = input.file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "plan-file";

  const storagePath = `${input.planId}/${authData.user.id}/${crypto.randomUUID()}-${safeBaseName}${getFileExtension(input.file)}`;

  const { error: uploadError } = await supabase.storage
    .from("plan-files")
    .upload(storagePath, input.file, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(getErrorMessage(uploadError, "The file could not be uploaded."));
  }

  const { data, error } = await supabase.rpc("register_plan_toolkit_file_v1", {
    p_plan_id: input.planId,
    p_storage_path: storagePath,
    p_file_name: input.file.name,
    p_mime_type: input.file.type || null,
    p_file_size: input.file.size,
    p_category: input.category,
    p_description: input.description,
    p_visibility: input.visibility,
    p_sensitive: input.sensitive,
    p_task_id: input.taskId,
    p_recipient_ids: input.recipientIds,
  });

  if (error) {
    await supabase.storage.from("plan-files").remove([storagePath]);
    throw new Error(getErrorMessage(error, "The file record could not be saved."));
  }

  return typeof data === "string" ? data : null;
}

export async function createPlanToolkitLink(input: {
  planId: string;
  externalUrl: string;
  name: string;
  category: PlanToolkitFileCategory;
  description: string | null;
  visibility: PlanToolkitFileVisibility;
  sensitive: boolean;
  taskId: string | null;
  recipientIds: string[];
}) {
  const { data, error } = await supabase.rpc("create_plan_toolkit_link_v1", {
    p_plan_id: input.planId,
    p_external_url: input.externalUrl,
    p_file_name: input.name,
    p_category: input.category,
    p_description: input.description,
    p_visibility: input.visibility,
    p_sensitive: input.sensitive,
    p_task_id: input.taskId,
    p_recipient_ids: input.recipientIds,
  });

  if (error) {
    throw new Error(getErrorMessage(error, "The link could not be added."));
  }

  return typeof data === "string" ? data : null;
}

export async function deletePlanToolkitFile(file: PlanToolkitFile) {
  if (file.kind === "file" && file.storagePath) {
    const { error: storageError } = await supabase.storage
      .from("plan-files")
      .remove([file.storagePath]);

    if (storageError) {
      throw new Error(getErrorMessage(storageError, "The stored file could not be removed."));
    }
  }

  const { error } = await supabase.rpc("delete_plan_toolkit_file_v1", {
    p_file_id: file.id,
  });

  if (error) {
    throw new Error(getErrorMessage(error, "The file record could not be removed."));
  }
}
