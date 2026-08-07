"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  claimPlanToolkitTask,
  createPlanToolkitLink,
  createPlanToolkitTask,
  deletePlanToolkitFile,
  deletePlanToolkitTask,
  getPlanToolkitFiles,
  getPlanToolkitTasks,
  reviewPlanToolkitTask,
  setPlanToolkitTaskStatus,
  unclaimPlanToolkitTask,
  updatePlanToolkitTask,
  uploadPlanToolkitFile,
  type PlanToolkitFile,
  type PlanToolkitFileCategory,
  type PlanToolkitFileVisibility,
  type PlanToolkitTask,
  type PlanToolkitTaskImportance,
} from "@/services/planToolkitService";

type PlanStatus = "forming" | "planned" | "completed" | "cancelled";

type ToolkitMember = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: "host" | "co_host" | "participant";
};

type PlanToolkitPanelProps = {
  planId: string;
  planStatus: PlanStatus;
  currentUserId: string;
  members: ToolkitMember[];
  canManage: boolean;
  readOnly: boolean;
};

type ToolkitTab = "checklist" | "files" | "links";

type TaskDraft = {
  title: string;
  description: string;
  importance: PlanToolkitTaskImportance;
  dueAt: string;
  requiresHostApproval: boolean;
  allowVolunteers: boolean;
  assigneeIds: string[];
};

type FileDraft = {
  name: string;
  url: string;
  description: string;
  category: PlanToolkitFileCategory;
  visibility: PlanToolkitFileVisibility;
  sensitive: boolean;
  taskId: string;
  recipientIds: string[];
};

const EMPTY_TASK_DRAFT: TaskDraft = {
  title: "",
  description: "",
  importance: "required",
  dueAt: "",
  requiresHostApproval: false,
  allowVolunteers: false,
  assigneeIds: [],
};

const EMPTY_FILE_DRAFT: FileDraft = {
  name: "",
  url: "",
  description: "",
  category: "other",
  visibility: "plan_members",
  sensitive: false,
  taskId: "",
  recipientIds: [],
};

const CATEGORY_OPTIONS: Array<{
  value: PlanToolkitFileCategory;
  label: string;
  icon: string;
}> = [
  { value: "tickets", label: "Tickets & QR", icon: "🎟" },
  { value: "reservations", label: "Reservations", icon: "📅" },
  { value: "routes", label: "Routes & Maps", icon: "🗺" },
  { value: "documents", label: "Documents", icon: "📄" },
  { value: "receipts", label: "Receipts", icon: "🧾" },
  { value: "other", label: "Other", icon: "📎" },
];

const VISIBILITY_OPTIONS: Array<{
  value: PlanToolkitFileVisibility;
  label: string;
  help: string;
}> = [
  {
    value: "plan_members",
    label: "All Plan members",
    help: "Every active member of this Plan can open it.",
  },
  {
    value: "hosts_only",
    label: "Hosts only",
    help: "Only the Primary Host and Co-hosts can open it.",
  },
  {
    value: "selected",
    label: "Selected members",
    help: "Only the people you choose and Plan hosts can open it.",
  },
  {
    value: "only_me",
    label: "Only me",
    help: "A private record visible only to the uploader.",
  },
];

function getPersonName(person: {
  fullName: string | null;
  username: string | null;
}) {
  return person.fullName || person.username || "UIN member";
}

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function getTaskStatusLabel(status: PlanToolkitTask["status"]) {
  if (status === "in_progress") return "In progress";
  if (status === "awaiting_approval") return "Awaiting approval";
  if (status === "done") return "Done";
  return "To do";
}

function getTaskStatusClasses(status: PlanToolkitTask["status"]) {
  if (status === "done") return "border-green-200 bg-green-50 text-green-700";
  if (status === "awaiting_approval") {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }
  if (status === "in_progress") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-gray-200 bg-gray-100 text-gray-700";
}

function getCategoryPresentation(category: PlanToolkitFileCategory) {
  return (
    CATEGORY_OPTIONS.find((option) => option.value === category) ??
    CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1]
  );
}

function getVisibilityLabel(visibility: PlanToolkitFileVisibility) {
  return (
    VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ??
    "Plan members"
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFileSize(value: number | null) {
  if (value === null) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isImageFile(file: PlanToolkitFile) {
  return Boolean(file.mimeType?.startsWith("image/"));
}

function isPdfFile(file: PlanToolkitFile) {
  return file.mimeType === "application/pdf" || file.fileName.toLowerCase().endsWith(".pdf");
}

function MemberAvatar({ member }: { member: ToolkitMember }) {
  const name = getPersonName(member);

  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt=""
        className="h-8 w-8 rounded-full border border-white object-cover shadow-sm"
      />
    );
  }

  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white bg-gray-900 text-xs font-bold text-white shadow-sm">
      {getInitial(name)}
    </span>
  );
}

function TaskEditor({
  draft,
  setDraft,
  members,
  submitLabel,
  isBusy,
  onSubmit,
  onCancel,
}: {
  draft: TaskDraft;
  setDraft: (next: TaskDraft) => void;
  members: ToolkitMember[];
  submitLabel: string;
  isBusy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  function toggleAssignee(userId: string) {
    setDraft({
      ...draft,
      assigneeIds: draft.assigneeIds.includes(userId)
        ? draft.assigneeIds.filter((id) => id !== userId)
        : [...draft.assigneeIds, userId],
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Task
          </span>
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            maxLength={180}
            required
            placeholder="Buy the coach tickets"
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
          />
        </label>

        <label className="md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Description, optional
          </span>
          <textarea
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            maxLength={2000}
            rows={3}
            placeholder="Add the details people need to complete this task."
            className="mt-2 w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
          />
        </label>

        <label>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Importance
          </span>
          <select
            value={draft.importance}
            onChange={(event) =>
              setDraft({
                ...draft,
                importance: event.target.value === "optional" ? "optional" : "required",
              })
            }
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="required">Required</option>
            <option value="optional">Optional</option>
          </select>
        </label>

        <label>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Due date
          </span>
          <input
            type="datetime-local"
            value={draft.dueAt}
            onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          />
        </label>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Assign to
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {members.map((member) => {
            const active = draft.assigneeIds.includes(member.userId);
            return (
              <button
                key={member.userId}
                type="button"
                onClick={() => toggleAssignee(member.userId)}
                className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                }`}
              >
                <MemberAvatar member={member} />
                {getPersonName(member)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <input
            type="checkbox"
            checked={draft.allowVolunteers}
            onChange={(event) =>
              setDraft({ ...draft, allowVolunteers: event.target.checked })
            }
            className="mt-1 h-4 w-4 accent-blue-600"
          />
          <span>
            <span className="block text-sm font-semibold text-gray-900">
              Members may volunteer
            </span>
            <span className="mt-1 block text-xs text-gray-500">
              An unassigned member can choose “I’ll handle this”.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <input
            type="checkbox"
            checked={draft.requiresHostApproval}
            onChange={(event) =>
              setDraft({ ...draft, requiresHostApproval: event.target.checked })
            }
            className="mt-1 h-4 w-4 accent-purple-600"
          />
          <span>
            <span className="block text-sm font-semibold text-gray-900">
              Host approval required
            </span>
            <span className="mt-1 block text-xs text-gray-500">
              Completion waits for a Host or Co-host to approve it.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isBusy}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isBusy || !draft.title.trim()}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function FilePreviewModal({
  file,
  onClose,
}: {
  file: PlanToolkitFile;
  onClose: () => void;
}) {
  const url = file.kind === "link" ? file.externalUrl : file.signedUrl;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={file.fileName}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-gray-950">{file.fileName}</p>
            <p className="mt-1 text-xs text-gray-500">
              {getCategoryPresentation(file.category).label} · {getVisibilityLabel(file.visibility)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Open separately ↗
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-gray-950 px-3 py-2 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-4">
          {!url ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-sm text-gray-500">
              Preview is unavailable. The file may have been removed or its signed link expired.
            </div>
          ) : isImageFile(file) ? (
            <img src={url} alt={file.fileName} className="mx-auto max-h-[75vh] max-w-full rounded-2xl object-contain" />
          ) : isPdfFile(file) ? (
            <iframe
              src={url}
              title={file.fileName}
              className="h-[75vh] w-full rounded-2xl border border-gray-200 bg-white"
            />
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-8 text-center">
              <span className="text-5xl">📎</span>
              <p className="mt-4 text-lg font-bold text-gray-950">Preview is not available for this format.</p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Open or download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function PlanToolkitPanel({
  planId,
  planStatus,
  currentUserId,
  members,
  canManage,
  readOnly,
}: PlanToolkitPanelProps) {
  const [activeTab, setActiveTab] = useState<ToolkitTab>("checklist");
  const [tasks, setTasks] = useState<PlanToolkitTask[]>([]);
  const [files, setFiles] = useState<PlanToolkitFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTaskEditorOpen, setIsTaskEditorOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(EMPTY_TASK_DRAFT);
  const [isFileEditorOpen, setIsFileEditorOpen] = useState(false);
  const [fileDraft, setFileDraft] = useState<FileDraft>(EMPTY_FILE_DRAFT);
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | PlanToolkitFileCategory>("all");
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  const loadToolkit = useCallback(async () => {
    setErrorMessage(null);

    try {
      const [loadedTasks, loadedFiles] = await Promise.all([
        getPlanToolkitTasks(planId),
        getPlanToolkitFiles(planId),
      ]);
      setTasks(loadedTasks);
      setFiles(loadedFiles);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Plan Toolkit could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadToolkit();
  }, [loadToolkit]);

  const taskSummary = useMemo(() => {
    const done = tasks.filter((task) => task.status === "done").length;
    const overdue = tasks.filter((task) => {
      if (!task.dueAt || task.status === "done") return false;
      return new Date(task.dueAt).getTime() < Date.now();
    }).length;
    return { done, total: tasks.length, overdue };
  }, [tasks]);

  const filteredFiles = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const kind = activeTab === "links" ? "link" : "file";

    return files.filter((file) => {
      if (file.kind !== kind) return false;
      if (categoryFilter !== "all" && file.category !== categoryFilter) return false;
      if (!normalizedSearch) return true;

      return [file.fileName, file.description, file.taskTitle, file.uploaderFullName, file.uploaderUsername]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [activeTab, categoryFilter, files, search]);

  const previewFile = files.find((file) => file.id === previewFileId) ?? null;
  const isEditable = !readOnly && (planStatus === "forming" || planStatus === "planned");

  function clearFeedback() {
    setMessage(null);
    setErrorMessage(null);
  }

  function openNewTask() {
    clearFeedback();
    setEditingTaskId(null);
    setTaskDraft(EMPTY_TASK_DRAFT);
    setIsTaskEditorOpen(true);
  }

  function openEditTask(task: PlanToolkitTask) {
    clearFeedback();
    setEditingTaskId(task.id);
    setTaskDraft({
      title: task.title,
      description: task.description ?? "",
      importance: task.importance,
      dueAt: toDateTimeLocal(task.dueAt),
      requiresHostApproval: task.requiresHostApproval,
      allowVolunteers: task.allowVolunteers,
      assigneeIds: task.assignees.map((person) => person.userId),
    });
    setIsTaskEditorOpen(true);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setWorkingKey(editingTaskId ? `task-edit-${editingTaskId}` : "task-create");

    try {
      const input = {
        title: taskDraft.title.trim(),
        description: taskDraft.description.trim() || null,
        importance: taskDraft.importance,
        dueAt: toIsoDate(taskDraft.dueAt),
        requiresHostApproval: taskDraft.requiresHostApproval,
        allowVolunteers: taskDraft.allowVolunteers,
        assigneeIds: taskDraft.assigneeIds,
      };

      if (editingTaskId) {
        await updatePlanToolkitTask({ taskId: editingTaskId, ...input });
        setMessage("Checklist task updated.");
      } else {
        await createPlanToolkitTask({ planId, ...input });
        setMessage("Checklist task created.");
      }

      setIsTaskEditorOpen(false);
      setEditingTaskId(null);
      setTaskDraft(EMPTY_TASK_DRAFT);
      await loadToolkit();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The task could not be saved.");
    } finally {
      setWorkingKey(null);
    }
  }

  async function runTaskAction(key: string, action: () => Promise<unknown>, success: string) {
    clearFeedback();
    setWorkingKey(key);
    try {
      await action();
      setMessage(success);
      await loadToolkit();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The task could not be updated.");
    } finally {
      setWorkingKey(null);
    }
  }

  function openFileEditor(tab: "files" | "links", taskId = "") {
    clearFeedback();
    setActiveTab(tab);
    setFileDraft({ ...EMPTY_FILE_DRAFT, taskId });
    setSelectedUploadFiles([]);
    setUploadInputKey((value) => value + 1);
    setIsFileEditorOpen(true);
  }

  function toggleRecipient(userId: string) {
    setFileDraft((current) => ({
      ...current,
      recipientIds: current.recipientIds.includes(userId)
        ? current.recipientIds.filter((id) => id !== userId)
        : [...current.recipientIds, userId],
    }));
  }

  async function saveFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setWorkingKey("file-create");

    try {
      if (fileDraft.visibility === "selected" && fileDraft.recipientIds.length === 0) {
        throw new Error("Choose at least one member for selected visibility.");
      }

      if (activeTab === "links") {
        await createPlanToolkitLink({
          planId,
          externalUrl: fileDraft.url.trim(),
          name: fileDraft.name.trim(),
          category: fileDraft.category,
          description: fileDraft.description.trim() || null,
          visibility: fileDraft.visibility,
          sensitive: fileDraft.sensitive,
          taskId: fileDraft.taskId || null,
          recipientIds: fileDraft.recipientIds,
        });
        setMessage("Link added to the Plan archive.");
      } else {
        if (selectedUploadFiles.length === 0) {
          throw new Error("Choose at least one file.");
        }

        for (const file of selectedUploadFiles) {
          await uploadPlanToolkitFile({
            planId,
            file,
            category: fileDraft.category,
            description: fileDraft.description.trim() || null,
            visibility: fileDraft.visibility,
            sensitive: fileDraft.sensitive,
            taskId: fileDraft.taskId || null,
            recipientIds: fileDraft.recipientIds,
          });
        }
        setMessage(`${selectedUploadFiles.length} file${selectedUploadFiles.length === 1 ? "" : "s"} added to the Plan archive.`);
      }

      setIsFileEditorOpen(false);
      setFileDraft(EMPTY_FILE_DRAFT);
      setSelectedUploadFiles([]);
      setUploadInputKey((value) => value + 1);
      await loadToolkit();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The archive item could not be added.");
    } finally {
      setWorkingKey(null);
    }
  }

  async function removeFile(file: PlanToolkitFile) {
    if (!window.confirm(`Remove “${file.fileName}” from this Plan?`)) return;
    clearFeedback();
    setWorkingKey(`file-delete-${file.id}`);

    try {
      await deletePlanToolkitFile(file);
      setMessage("Archive item removed.");
      await loadToolkit();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The archive item could not be removed.");
    } finally {
      setWorkingKey(null);
    }
  }

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
            Plan Toolkit
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-950">Checklist, files and links</h2>
          <p className="mt-2 text-sm text-gray-500">Tasks and private planning documents in one place.</p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-green-50 px-4 py-3">
            <p className="text-lg font-bold text-green-800">{taskSummary.done}/{taskSummary.total}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-green-700">Completed</p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3">
            <p className="text-lg font-bold text-amber-800">{taskSummary.overdue}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Overdue</p>
          </div>
          <div className="rounded-2xl bg-blue-50 px-4 py-3">
            <p className="text-lg font-bold text-blue-800">{files.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Archive</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div className="flex rounded-2xl bg-gray-100 p-1">
          {([
            ["checklist", `Checklist ${tasks.length}`],
            ["files", `Files ${files.filter((file) => file.kind === "file").length}`],
            ["links", `Links ${files.filter((file) => file.kind === "link").length}`],
          ] as Array<[ToolkitTab, string]>).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setIsFileEditorOpen(false);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab ? "bg-gray-950 text-white shadow-sm" : "text-gray-600 hover:text-gray-950"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isEditable && (
          activeTab === "checklist" ? (
            canManage && (
              <button
                type="button"
                onClick={openNewTask}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                + Add task
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => openFileEditor(activeTab)}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {activeTab === "links" ? "+ Add link" : "+ Add files"}
            </button>
          )
        )}
      </div>

      {readOnly && (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          This completed or archived Plan keeps its Toolkit as a read-only record.
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="mt-5 rounded-2xl border border-dashed border-gray-300 px-5 py-7 text-center text-sm text-gray-500">
          Loading Plan Toolkit...
        </div>
      ) : activeTab === "checklist" ? (
        <div className="mt-5 space-y-4">
          {isTaskEditorOpen && canManage && (
            <TaskEditor
              draft={taskDraft}
              setDraft={setTaskDraft}
              members={members}
              submitLabel={editingTaskId ? "Save task" : "Create task"}
              isBusy={workingKey === "task-create" || workingKey === `task-edit-${editingTaskId}`}
              onSubmit={saveTask}
              onCancel={() => {
                setIsTaskEditorOpen(false);
                setEditingTaskId(null);
                setTaskDraft(EMPTY_TASK_DRAFT);
              }}
            />
          )}

          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-7 text-center">
              <p className="text-lg font-bold text-gray-900">No checklist tasks yet</p>
              <p className="mt-2 text-sm text-gray-500">
                Add the work that must happen before the Activity: tickets, confirmations, reservations or route checks.
              </p>
            </div>
          ) : (
            tasks.map((task) => {
              const isOverdue = Boolean(
                task.dueAt && task.status !== "done" && new Date(task.dueAt).getTime() < Date.now()
              );
              const canRelease =
                task.viewerIsAssigned &&
                task.allowVolunteers &&
                task.assignees.length === 1 &&
                task.assignees[0]?.userId === currentUserId &&
                (task.status === "todo" || task.status === "in_progress");

              return (
                <article
                  key={task.id}
                  className={`rounded-2xl border p-4 transition ${
                    task.status === "done"
                      ? "border-green-200 bg-green-50/50"
                      : task.status === "awaiting_approval"
                        ? "border-purple-200 bg-purple-50/50"
                        : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${getTaskStatusClasses(task.status)}`}>
                          {getTaskStatusLabel(task.status)}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          task.importance === "required" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
                        }`}>
                          {task.importance === "required" ? "Required" : "Optional"}
                        </span>
                        {task.requiresHostApproval && (
                          <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-bold text-purple-700">
                            Host approval
                          </span>
                        )}
                        {task.attachmentCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("files");
                              setSearch(task.title);
                            }}
                            className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700"
                          >
                            📎 {task.attachmentCount}
                          </button>
                        )}
                      </div>

                      <h3 className={`mt-3 text-base font-bold ${task.status === "done" ? "text-gray-500 line-through" : "text-gray-950"}`}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">{task.description}</p>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className={isOverdue ? "font-bold text-red-700" : ""}>
                          {isOverdue ? "Overdue · " : "Due · "}{formatDateTime(task.dueAt)}
                        </span>
                        {task.allowVolunteers && <span>Open to volunteers</span>}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {task.assignees.length > 0 ? (
                          task.assignees.map((person) => {
                            const member = members.find((item) => item.userId === person.userId);
                            return (
                              <span
                                key={person.userId}
                                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 text-xs font-semibold text-gray-700"
                              >
                                {member ? <MemberAvatar member={member} /> : (
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                                    {getInitial(getPersonName(person))}
                                  </span>
                                )}
                                {getPersonName(person)}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs italic text-gray-500">No one assigned yet.</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {isEditable && canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditTask(task)}
                            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openFileEditor("files", task.id)}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
                          >
                            Attach file
                          </button>
                          <button
                            type="button"
                            disabled={workingKey === `task-delete-${task.id}`}
                            onClick={() => {
                              if (!window.confirm(`Delete “${task.title}”? Attached files will remain in the archive.`)) return;
                              runTaskAction(
                                `task-delete-${task.id}`,
                                () => deletePlanToolkitTask(task.id),
                                "Checklist task deleted."
                              );
                            }}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </>
                      )}

                      {isEditable && task.canClaim && (
                        <button
                          type="button"
                          onClick={() =>
                            runTaskAction(
                              `task-claim-${task.id}`,
                              () => claimPlanToolkitTask(task.id),
                              "You are now responsible for this task."
                            )
                          }
                          className="rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white"
                        >
                          I’ll handle this
                        </button>
                      )}

                      {isEditable && canRelease && (
                        <button
                          type="button"
                          onClick={() =>
                            runTaskAction(
                              `task-release-${task.id}`,
                              () => unclaimPlanToolkitTask(task.id),
                              "Task released for another volunteer."
                            )
                          }
                          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                        >
                          Release
                        </button>
                      )}

                      {isEditable && (task.viewerIsAssigned || canManage) && task.status === "todo" && (
                        <button
                          type="button"
                          onClick={() =>
                            runTaskAction(
                              `task-start-${task.id}`,
                              () => setPlanToolkitTaskStatus(task.id, "in_progress"),
                              "Task moved to In progress."
                            )
                          }
                          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                        >
                          Start
                        </button>
                      )}

                      {isEditable && (task.viewerIsAssigned || canManage) && task.status === "in_progress" && (
                        <button
                          type="button"
                          onClick={() =>
                            runTaskAction(
                              `task-complete-${task.id}`,
                              () => setPlanToolkitTaskStatus(task.id, "done"),
                              task.requiresHostApproval && !canManage
                                ? "Task submitted for Host approval."
                                : "Task completed."
                            )
                          }
                          className="rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white"
                        >
                          {task.requiresHostApproval && !canManage ? "Submit" : "Complete"}
                        </button>
                      )}

                      {isEditable && canManage && task.status === "awaiting_approval" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              runTaskAction(
                                `task-return-${task.id}`,
                                () => reviewPlanToolkitTask(task.id, false),
                                "Task returned to In progress."
                              )
                            }
                            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
                          >
                            Return
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              runTaskAction(
                                `task-approve-${task.id}`,
                                () => reviewPlanToolkitTask(task.id, true),
                                "Task approved and completed."
                              )
                            }
                            className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Approve
                          </button>
                        </>
                      )}

                      {isEditable && canManage && task.status === "done" && (
                        <button
                          type="button"
                          onClick={() =>
                            runTaskAction(
                              `task-reopen-${task.id}`,
                              () => setPlanToolkitTaskStatus(task.id, "in_progress"),
                              "Task reopened."
                            )
                          }
                          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      ) : (
        <div className="mt-5">
          {isFileEditorOpen && isEditable && (
            <form onSubmit={saveFile} className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {activeTab === "links" ? "Add link" : "Add files"}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-gray-950">
                    {activeTab === "links" ? "Save a useful Plan link" : "Upload private Plan documents"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFileEditorOpen(false)}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeTab === "links" ? (
                  <>
                    <label>
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Name</span>
                      <input
                        value={fileDraft.name}
                        onChange={(event) => setFileDraft({ ...fileDraft, name: event.target.value })}
                        required
                        maxLength={240}
                        placeholder="Match ticket portal"
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">HTTPS URL</span>
                      <input
                        type="url"
                        value={fileDraft.url}
                        onChange={(event) => setFileDraft({ ...fileDraft, url: event.target.value })}
                        required
                        placeholder="https://..."
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                      />
                    </label>
                  </>
                ) : (
                  <label className="md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Files</span>
                    <input
                      key={uploadInputKey}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                      onChange={(event) => setSelectedUploadFiles(Array.from(event.target.files ?? []))}
                      required
                      className="mt-2 block w-full rounded-xl border border-dashed border-blue-300 bg-white px-3 py-5 text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white"
                    />
                    <span className="mt-2 block text-xs text-gray-500">
                      PDF, images, Word, Excel, text, CSV or ZIP · maximum 50 MB per file.
                    </span>
                  </label>
                )}

                <label>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Category</span>
                  <select
                    value={fileDraft.category}
                    onChange={(event) => setFileDraft({ ...fileDraft, category: event.target.value as PlanToolkitFileCategory })}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Linked checklist task</span>
                  <select
                    value={fileDraft.taskId}
                    onChange={(event) => setFileDraft({ ...fileDraft, taskId: event.target.value })}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">No linked task</option>
                    {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                  </select>
                </label>

                <label>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Visibility</span>
                  <select
                    value={fileDraft.visibility}
                    onChange={(event) =>
                      setFileDraft({
                        ...fileDraft,
                        visibility: event.target.value as PlanToolkitFileVisibility,
                        recipientIds: event.target.value === "selected" ? fileDraft.recipientIds : [],
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    {VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-gray-500">
                    {VISIBILITY_OPTIONS.find((option) => option.value === fileDraft.visibility)?.help}
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3">
                  <input
                    type="checkbox"
                    checked={fileDraft.sensitive}
                    onChange={(event) => setFileDraft({ ...fileDraft, sensitive: event.target.checked })}
                    className="mt-1 h-4 w-4 accent-red-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">Sensitive document</span>
                    <span className="mt-1 block text-xs text-gray-500">Use for personal tickets, QR codes, receipts or identity-related records.</span>
                  </span>
                </label>

                <label className="md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Description, optional</span>
                  <textarea
                    value={fileDraft.description}
                    onChange={(event) => setFileDraft({ ...fileDraft, description: event.target.value })}
                    maxLength={1200}
                    rows={2}
                    placeholder="Which member or booking does this belong to?"
                    className="mt-2 w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </label>
              </div>

              {fileDraft.visibility === "selected" && (
                <div className="mt-4 rounded-xl border border-purple-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">Selected members</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {members.map((member) => {
                      const active = fileDraft.recipientIds.includes(member.userId);
                      return (
                        <button
                          key={member.userId}
                          type="button"
                          onClick={() => toggleRecipient(member.userId)}
                          className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold ${
                            active ? "border-purple-500 bg-purple-600 text-white" : "border-gray-200 bg-white text-gray-700"
                          }`}
                        >
                          <MemberAvatar member={member} />
                          {getPersonName(member)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={workingKey === "file-create"}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {workingKey === "file-create" ? "Saving..." : activeTab === "links" ? "Add link" : "Upload files"}
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[220px] flex-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Search archive</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ticket, QR, reservation, task or uploader"
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              />
            </label>
            <label className="min-w-[200px]">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as "all" | PlanToolkitFileCategory)}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="all">All categories</option>
                {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          {filteredFiles.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-7 text-center">
              <p className="text-lg font-bold text-gray-900">No {activeTab === "links" ? "links" : "files"} found</p>
              <p className="mt-2 text-sm text-gray-500">
                {activeTab === "links"
                  ? "Keep booking portals, route pages and event links with this Plan."
                  : "Keep tickets, QR codes, PDFs and working documents in the private Plan archive."}
              </p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredFiles.map((file) => {
                const category = getCategoryPresentation(file.category);
                const openUrl = file.kind === "link" ? file.externalUrl : file.signedUrl;

                return (
                  <article key={file.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    {file.kind === "file" && isImageFile(file) && file.signedUrl ? (
                      <button type="button" onClick={() => setPreviewFileId(file.id)} className="block h-40 w-full overflow-hidden bg-gray-100">
                        <img src={file.signedUrl} alt="" className="h-full w-full object-cover transition hover:scale-[1.02]" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => file.kind === "file" && setPreviewFileId(file.id)}
                        className={`flex h-32 w-full items-center justify-center text-5xl ${file.kind === "link" ? "bg-purple-50" : "bg-gray-100"}`}
                      >
                        {file.kind === "link" ? "🔗" : isPdfFile(file) ? "📕" : category.icon}
                      </button>
                    )}

                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700">
                          {category.icon} {category.label}
                        </span>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                          {getVisibilityLabel(file.visibility)}
                        </span>
                        {file.sensitive && (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">Sensitive</span>
                        )}
                      </div>

                      <h3 className="mt-3 break-words text-sm font-bold text-gray-950">{file.fileName}</h3>
                      {file.description && <p className="mt-2 line-clamp-3 text-xs leading-5 text-gray-600">{file.description}</p>}

                      {file.taskTitle && (
                        <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                          Checklist · {file.taskTitle}
                        </p>
                      )}

                      <div className="mt-3 space-y-1 text-[11px] text-gray-500">
                        <p>Added by {file.uploaderFullName || file.uploaderUsername || "UIN member"}</p>
                        <p>{new Date(file.createdAt).toLocaleString()} {formatFileSize(file.fileSize) ? `· ${formatFileSize(file.fileSize)}` : ""}</p>
                        {file.visibility === "selected" && file.recipients.length > 0 && (
                          <p>For {file.recipients.map(getPersonName).join(", ")}</p>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {file.kind === "file" ? (
                          <button
                            type="button"
                            onClick={() => setPreviewFileId(file.id)}
                            className="flex-1 rounded-xl bg-gray-950 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Preview
                          </button>
                        ) : openUrl ? (
                          <a
                            href={openUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 rounded-xl bg-purple-600 px-3 py-2 text-center text-xs font-semibold text-white"
                          >
                            Open link ↗
                          </a>
                        ) : null}

                        {file.canDelete && (
                          <button
                            type="button"
                            disabled={workingKey === `file-delete-${file.id}`}
                            onClick={() => removeFile(file)}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFileId(null)} />}
    </section>
  );
}
