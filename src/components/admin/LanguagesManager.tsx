"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import LanguagePackageManager from "@/components/admin/LanguagePackageManager";
import { supabase } from "@/utils/supabase/client";

export type AdminLanguage = {
  code: string;
  display_name: string;
  native_name: string;
  is_active: boolean;
  is_default: boolean;
  is_source: boolean;
  sort_order: number | string;
  total_keys: number | string;
  translated_keys: number | string;
  outdated_keys: number | string;
};

type TranslationStatus =
  | "missing"
  | "outdated"
  | "complete";

type TranslationEntry = {
  id: string;
  key: string;
  namespace: string;
  default_text: string;
  description: string | null;
  source_revision: number | string;
  value: string;
  translation_revision: number | string;
  status: TranslationStatus;
};

type TranslationEditorData = {
  locale: {
    code: string;
    display_name: string;
    native_name: string;
    is_active: boolean;
    is_default: boolean;
    is_source: boolean;
  };
  namespaces: string[];
  summary: {
    complete: number | string;
    missing: number | string;
    outdated: number | string;
    total: number | string;
  };
  pagination: {
    page: number | string;
    page_size: number | string;
    total: number | string;
    page_count: number | string;
  };
  entries: TranslationEntry[];
};

type LanguagesManagerProps = {
  languages: AdminLanguage[];
};

function toNumber(
  value: number | string | null | undefined
) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function titleCaseNamespace(value: string) {
  return value
    .split(/[.-]/g)
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" / ");
}

function statusClasses(status: TranslationStatus) {
  if (status === "complete") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (status === "outdated") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

export default function LanguagesManager({
  languages,
}: LanguagesManagerProps) {
  const router = useRouter();

  const initialCode =
    languages.find(
      (language) => language.code === "tr"
    )?.code ??
    languages.find(
      (language) => !language.is_source
    )?.code ??
    languages[0]?.code ??
    "";

  const [selectedCode, setSelectedCode] =
    useState(initialCode);
  const [editor, setEditor] =
    useState<TranslationEditorData | null>(null);
  const [namespace, setNamespace] = useState("");
  const [status, setStatus] = useState<
    "" | TranslationStatus
  >("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drafts, setDrafts] = useState<
    Record<string, string>
  >({});
  const [dirtyKeys, setDirtyKeys] = useState<
    Set<string>
  >(new Set());
  const [isLoading, setIsLoading] =
    useState(false);
  const [isSaving, setIsSaving] =
    useState(false);
  const [message, setMessage] = useState<
    string | null
  >(null);

  const selectedLanguage =
    languages.find(
      (language) =>
        language.code === selectedCode
    ) ?? null;

  const sourceLanguage =
    languages.find((language) => language.is_source) ?? null;

  const [displayName, setDisplayName] =
    useState("");
  const [nativeName, setNativeName] =
    useState("");
  const [sortOrder, setSortOrder] =
    useState("100");
  const [isActive, setIsActive] =
    useState(true);
  const [isDefault, setIsDefault] =
    useState(false);
  const [isSavingLanguage, setIsSavingLanguage] =
    useState(false);

  const [newCode, setNewCode] = useState("");
  const [newDisplayName, setNewDisplayName] =
    useState("");
  const [newNativeName, setNewNativeName] =
    useState("");
  const [isCreatingLanguage, setIsCreatingLanguage] =
    useState(false);

  useEffect(() => {
    if (!selectedLanguage) {
      return;
    }

    setDisplayName(selectedLanguage.display_name);
    setNativeName(selectedLanguage.native_name);
    setSortOrder(
      String(toNumber(selectedLanguage.sort_order))
    );
    setIsActive(selectedLanguage.is_active);
    setIsDefault(selectedLanguage.is_default);
  }, [selectedLanguage]);

  async function loadEditor() {
    if (!selectedCode) {
      setEditor(null);
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const { data, error } = await supabase.rpc(
      "get_admin_translation_editor",
      {
        p_locale_code: selectedCode,
        p_namespace: namespace || null,
        p_search: search.trim() || null,
        p_status: status || null,
        p_page: page,
        p_page_size: pageSize,
      }
    );

    setIsLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const parsed = data as TranslationEditorData;
    setEditor(parsed);
    setDrafts(
      Object.fromEntries(
        (parsed.entries ?? []).map((entry) => [
          entry.key,
          entry.value,
        ])
      )
    );
    setDirtyKeys(new Set());
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadEditor();
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [
    selectedCode,
    namespace,
    status,
    search,
    page,
    pageSize,
  ]);

  const changedEntries = useMemo(
    () =>
      (editor?.entries ?? [])
        .filter((entry) => dirtyKeys.has(entry.key))
        .map((entry) => ({
          key: entry.key,
          value: drafts[entry.key] ?? "",
        })),
    [drafts, dirtyKeys, editor]
  );

  const pageCount = Math.max(
    toNumber(editor?.pagination.page_count),
    1
  );
  const currentPage = Math.min(
    Math.max(
      toNumber(editor?.pagination.page) || page,
      1
    ),
    pageCount
  );

  function confirmDiscard() {
    return (
      dirtyKeys.size === 0 ||
      window.confirm(
        "Discard unsaved translations on this page?"
      )
    );
  }

  function selectLanguage(code: string) {
    if (!confirmDiscard()) {
      return;
    }

    setSelectedCode(code);
    setNamespace("");
    setStatus("");
    setSearch("");
    setPage(1);
  }

  function changeFilter(callback: () => void) {
    if (!confirmDiscard()) {
      return;
    }

    callback();
    setPage(1);
  }

  async function savePage() {
    if (!selectedLanguage || selectedLanguage.is_source) {
      return;
    }

    if (changedEntries.length === 0) {
      setMessage("Nothing changed on this page.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const { data, error } = await supabase.rpc(
      "admin_set_translations",
      {
        p_locale_code: selectedCode,
        p_entries: changedEntries,
      }
    );

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      `${toNumber(data)} translation(s) saved.`
    );
    await loadEditor();
    router.refresh();
  }

  async function saveLanguage() {
    if (!selectedLanguage) {
      return;
    }

    const parsedSortOrder = Number(sortOrder);

    if (
      !Number.isInteger(parsedSortOrder) ||
      parsedSortOrder < 0
    ) {
      setMessage(
        "Sort order must be zero or greater."
      );
      return;
    }

    setIsSavingLanguage(true);
    setMessage(null);

    const { error } = await supabase.rpc(
      "admin_update_language",
      {
        p_code: selectedLanguage.code,
        p_display_name: displayName.trim(),
        p_native_name: nativeName.trim(),
        p_is_active: isActive,
        p_is_default: isDefault,
        p_sort_order: parsedSortOrder,
      }
    );

    setIsSavingLanguage(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Language settings saved.");
    router.refresh();
  }

  async function createLanguage() {
    setIsCreatingLanguage(true);
    setMessage(null);

    const { error } = await supabase.rpc(
      "admin_create_language",
      {
        p_code: newCode.trim(),
        p_display_name: newDisplayName.trim(),
        p_native_name: newNativeName.trim(),
        p_is_active: true,
        p_sort_order:
          languages.length * 10 + 20,
      }
    );

    setIsCreatingLanguage(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const createdCode = newCode.trim();
    setNewCode("");
    setNewDisplayName("");
    setNewNativeName("");
    setSelectedCode(createdCode);
    setMessage("Language added.");
    router.refresh();
  }

  return (
    <div
      className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]"
      data-i18n-ignore="true"
    >
      <aside className="space-y-5">
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
            Installed Languages
          </p>
          <h2 className="mt-2 text-xl font-bold text-gray-950">
            Language packs
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Completion is calculated from the real UIN source catalogue, not the old demonstration list.
          </p>

          <div className="mt-5 space-y-3">
            {languages.map((language) => {
              const total = toNumber(
                language.total_keys
              );
              const translated = language.is_source
                ? total
                : toNumber(
                    language.translated_keys
                  );
              const percent =
                total > 0
                  ? Math.round(
                      (translated / total) * 100
                    )
                  : 0;
              const selected =
                language.code === selectedCode;

              return (
                <button
                  key={language.code}
                  type="button"
                  onClick={() =>
                    selectLanguage(language.code)
                  }
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-green-400 bg-green-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-green-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-gray-950">
                        {language.native_name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {language.display_name} · {language.code}
                      </p>
                    </div>

                    <div className="flex flex-wrap justify-end gap-1">
                      {language.is_default && (
                        <span className="rounded-full bg-gray-950 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">
                          Default
                        </span>
                      )}
                      {language.is_source && (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                          Source
                        </span>
                      )}
                      {!language.is_active && (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-gray-500">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-green-600"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-gray-500">
                    <span>
                      {translated}/{total} translated
                    </span>
                    <span>{percent}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <details className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              Add Language
            </p>
            <h2 className="mt-2 text-lg font-bold text-gray-950">
              Install another language
            </h2>
          </summary>

          <div className="space-y-3 border-t border-gray-100 p-5">
            <input
              value={newCode}
              onChange={(event) =>
                setNewCode(event.target.value)
              }
              placeholder="Code, e.g. de"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
            <input
              value={newDisplayName}
              onChange={(event) =>
                setNewDisplayName(event.target.value)
              }
              placeholder="English name, e.g. German"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
            <input
              value={newNativeName}
              onChange={(event) =>
                setNewNativeName(event.target.value)
              }
              placeholder="Native name, e.g. Deutsch"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={createLanguage}
              disabled={
                isCreatingLanguage ||
                newCode.trim().length < 2 ||
                newDisplayName.trim().length < 2 ||
                newNativeName.trim().length < 2
              }
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {isCreatingLanguage
                ? "Creating..."
                : "Add Language"}
            </button>
          </div>
        </details>
      </aside>

      <div className="min-w-0 space-y-6">
        {selectedLanguage && (
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
                  Language Settings
                </p>
                <h2 className="mt-2 text-2xl font-bold text-gray-950">
                  {selectedLanguage.native_name}
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  Source and application default are separate. Turkish can be the default while English remains the source column.
                </p>
              </div>

              <button
                type="button"
                onClick={saveLanguage}
                disabled={isSavingLanguage}
                className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
              >
                {isSavingLanguage
                  ? "Saving..."
                  : "Save Language"}
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Display name
                </span>
                <input
                  value={displayName}
                  onChange={(event) =>
                    setDisplayName(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                />
              </label>

              <label>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Native name
                </span>
                <input
                  value={nativeName}
                  onChange={(event) =>
                    setNativeName(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                />
              </label>

              <label>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Sort order
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                />
              </label>

              <div className="flex flex-col justify-end gap-3 rounded-xl border border-gray-200 p-4">
                <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    disabled={selectedLanguage.is_source}
                    onChange={(event) =>
                      setIsActive(event.target.checked)
                    }
                    className="h-4 w-4"
                  />
                  Active
                </label>

                <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(event) =>
                      setIsDefault(event.target.checked)
                    }
                    className="h-4 w-4"
                  />
                  Default application language
                </label>
              </div>
            </div>
          </section>
        )}

        {message && (
          <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
            {message}
          </p>
        )}

        {selectedLanguage && (
          <LanguagePackageManager
            selectedLanguage={selectedLanguage}
            sourceLanguage={sourceLanguage}
            onMessage={setMessage}
            onReloadEditor={loadEditor}
          />
        )}

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">
                Translation Editor
              </p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                English source and {selectedLanguage?.native_name ?? "translation"}
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                The list is paginated because displaying thousands of text boxes in one page is apparently frowned upon by browsers and civilization. Preserve template tokens such as {1}, {2} and {3}.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                ["Complete", editor?.summary.complete, "bg-green-50 text-green-800"],
                ["Missing", editor?.summary.missing, "bg-red-50 text-red-800"],
                ["Outdated", editor?.summary.outdated, "bg-amber-50 text-amber-800"],
              ].map(([label, value, classes]) => (
                <div
                  key={String(label)}
                  className={`rounded-xl px-4 py-3 text-center ${classes}`}
                >
                  <p className="text-xs">{label}</p>
                  <p className="mt-1 text-xl font-bold">
                    {toNumber(value as number | string)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[220px_180px_minmax(0,1fr)_120px]">
            <select
              value={namespace}
              onChange={(event) =>
                changeFilter(() =>
                  setNamespace(event.target.value)
                )
              }
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-purple-500"
            >
              <option value="">All sections</option>
              {(editor?.namespaces ?? []).map(
                (namespaceName) => (
                  <option
                    key={namespaceName}
                    value={namespaceName}
                  >
                    {titleCaseNamespace(namespaceName)}
                  </option>
                )
              )}
            </select>

            <select
              value={status}
              onChange={(event) =>
                changeFilter(() =>
                  setStatus(
                    event.target.value as
                      | ""
                      | TranslationStatus
                  )
                )
              }
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-purple-500"
            >
              <option value="">All statuses</option>
              <option value="missing">Missing</option>
              <option value="outdated">Outdated</option>
              <option value="complete">Complete</option>
            </select>

            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search source, translation, key or source file"
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-purple-500"
            />

            <select
              value={pageSize}
              onChange={(event) => {
                if (!confirmDiscard()) {
                  return;
                }
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-xl border border-gray-200 px-3 py-3 outline-none focus:border-purple-500"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3">
            <p className="text-sm text-gray-600">
              Page {currentPage} of {pageCount} · {toNumber(editor?.pagination.total)} matching entries
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (confirmDiscard()) {
                    setPage((current) =>
                      Math.max(current - 1, 1)
                    );
                  }
                }}
                disabled={currentPage <= 1}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDiscard()) {
                    setPage((current) =>
                      Math.min(current + 1, pageCount)
                    );
                  }
                }}
                disabled={currentPage >= pageCount}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
              >
                Next
              </button>
              <button
                type="button"
                onClick={savePage}
                disabled={
                  isSaving ||
                  changedEntries.length === 0 ||
                  selectedLanguage?.is_source === true
                }
                className="rounded-xl bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-40"
              >
                {selectedLanguage?.is_source
                  ? "Source is read-only"
                  : isSaving
                    ? "Saving..."
                    : `Save page (${changedEntries.length})`}
              </button>
            </div>
          </div>

          {isLoading ? (
            <p className="mt-6 rounded-2xl bg-gray-50 p-6 text-sm text-gray-500">
              Loading translations...
            </p>
          ) : (editor?.entries ?? []).length > 0 ? (
            <div className="mt-6 space-y-4">
              {(editor?.entries ?? []).map((entry) => (
                <article
                  key={entry.key}
                  className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs font-semibold text-purple-700">
                        {entry.key}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">
                        {titleCaseNamespace(entry.namespace)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClasses(entry.status)}`}
                    >
                      {entry.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        English source
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">
                        {entry.default_text}
                      </p>
                      {entry.description && (
                        <p className="mt-3 text-xs leading-5 text-gray-500">
                          {entry.description}
                        </p>
                      )}
                    </div>

                    <label>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {selectedLanguage?.native_name ?? "Translation"}
                      </span>
                      <textarea
                        rows={4}
                        readOnly={
                          selectedLanguage?.is_source === true
                        }
                        value={drafts[entry.key] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDrafts((current) => ({
                            ...current,
                            [entry.key]: value,
                          }));
                          setDirtyKeys((current) => {
                            const next = new Set(current);
                            if (value === entry.value) {
                              next.delete(entry.key);
                            } else {
                              next.add(entry.key);
                            }
                            return next;
                          });
                        }}
                        placeholder={entry.default_text}
                        className="mt-2 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-purple-500 read-only:bg-gray-100 read-only:text-gray-500"
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              No translation entries match these filters.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
            <p className="text-sm text-gray-500">
              Page {currentPage} of {pageCount}
            </p>
            <button
              type="button"
              onClick={savePage}
              disabled={
                isSaving ||
                changedEntries.length === 0 ||
                selectedLanguage?.is_source === true
              }
              className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-40"
            >
              {selectedLanguage?.is_source
                ? "Source is read-only"
                : isSaving
                  ? "Saving..."
                  : `Save page (${changedEntries.length})`}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
