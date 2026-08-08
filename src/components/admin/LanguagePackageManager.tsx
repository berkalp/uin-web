"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type TranslationStatus = "missing" | "outdated" | "complete";

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
  pagination: {
    page: number | string;
    page_size: number | string;
    total: number | string;
    page_count: number | string;
  };
  entries: TranslationEntry[];
};

type LanguageSummary = {
  code: string;
  display_name: string;
  native_name: string;
  is_source: boolean;
};

type LanguagePackageEntry = {
  source: string;
  translation: string;
  source_revision: number;
  namespace: string;
  status?: TranslationStatus;
};

type LanguagePackage = {
  format: "uin-language-pack";
  version: 1;
  source_locale: string;
  target_locale: string;
  target_language: string;
  exported_at: string;
  mode: "source" | "full" | "needs-review";
  instructions: string[];
  entries: Record<string, LanguagePackageEntry>;
};

type ParsedIncomingEntry = {
  key: string;
  translation: string;
  source?: string;
  sourceRevision?: number;
};

type ImportPreview = {
  fileName: string;
  packageLocale: string | null;
  packageMode: string | null;
  expected: number;
  supplied: number;
  recognized: number;
  missingFromPackage: number;
  unknownKeys: string[];
  newTranslations: number;
  updatedTranslations: number;
  unchangedTranslations: number;
  emptyTranslations: number;
  staleEntries: string[];
  tokenIssues: string[];
  sourceMismatches: string[];
  localeMismatch: boolean;
  entriesToApply: Array<{ key: string; value: string }>;
};

type LanguagePackageManagerProps = {
  selectedLanguage: LanguageSummary;
  sourceLanguage: LanguageSummary | null;
  onMessage: (message: string | null) => void;
  onReloadEditor: () => Promise<void>;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "language";
}

function downloadJson(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getTemplateTokens(value: string) {
  return Array.from(value.matchAll(/\{(\d+)\}/g))
    .map((match) => match[0])
    .sort();
}

function hasSameTemplateTokens(source: string, translation: string) {
  const sourceTokens = getTemplateTokens(source);
  const translationTokens = getTemplateTokens(translation);

  if (sourceTokens.length !== translationTokens.length) {
    return false;
  }

  return sourceTokens.every(
    (token, index) => token === translationTokens[index]
  );
}

function normalizeIncomingPackage(
  raw: unknown
): {
  locale: string | null;
  mode: string | null;
  entries: ParsedIncomingEntry[];
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("The JSON file must contain an object.");
  }

  const record = raw as Record<string, unknown>;
  const packageLocale =
    typeof record.target_locale === "string"
      ? record.target_locale
      : null;
  const packageMode =
    typeof record.mode === "string" ? record.mode : null;

  if (
    record.format === "uin-language-pack" &&
    record.entries &&
    typeof record.entries === "object" &&
    !Array.isArray(record.entries)
  ) {
    const entriesRecord = record.entries as Record<string, unknown>;
    const entries: ParsedIncomingEntry[] = [];

    for (const [key, rawEntry] of Object.entries(entriesRecord)) {
      if (typeof rawEntry === "string") {
        entries.push({ key, translation: rawEntry });
        continue;
      }

      if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
        continue;
      }

      const item = rawEntry as Record<string, unknown>;
      const translation =
        typeof item.translation === "string" ? item.translation : "";
      const source = typeof item.source === "string" ? item.source : undefined;
      const sourceRevision =
        typeof item.source_revision === "number"
          ? item.source_revision
          : typeof item.source_revision === "string"
            ? Number(item.source_revision)
            : undefined;

      entries.push({
        key,
        translation,
        source,
        sourceRevision:
          sourceRevision !== undefined && Number.isFinite(sourceRevision)
            ? sourceRevision
            : undefined,
      });
    }

    return {
      locale: packageLocale,
      mode: packageMode,
      entries,
    };
  }

  // Also accept a deliberately simple { "translation.key": "Translated text" }
  // object so a language pack can be edited with almost any tool.
  const entries = Object.entries(record)
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => ({
      key,
      translation: value as string,
    }));

  if (entries.length === 0) {
    throw new Error(
      "No translations were found. Upload a UIN language pack or a key/value JSON object."
    );
  }

  return {
    locale: packageLocale,
    mode: packageMode,
    entries,
  };
}

export default function LanguagePackageManager({
  selectedLanguage,
  sourceLanguage,
  onMessage,
  onReloadEditor,
}: LanguagePackageManagerProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const sourceLocale = sourceLanguage?.code ?? "en";

  const canImport = !selectedLanguage.is_source;

  const previewHasBlockingIssue = useMemo(
    () => Boolean(preview?.localeMismatch),
    [preview]
  );

  useEffect(() => {
    setPreview(null);
  }, [selectedLanguage.code]);

  async function fetchAllEntries(status?: TranslationStatus) {
    const pageSize = 100;
    const allEntries: TranslationEntry[] = [];
    let currentPage = 1;
    let pageCount = 1;

    do {
      const { data, error } = await supabase.rpc(
        "get_admin_translation_editor",
        {
          p_locale_code: selectedLanguage.code,
          p_namespace: null,
          p_search: null,
          p_status: status ?? null,
          p_page: currentPage,
          p_page_size: pageSize,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const parsed = data as TranslationEditorData;
      allEntries.push(...(parsed.entries ?? []));
      pageCount = Math.max(toNumber(parsed.pagination?.page_count), 1);
      currentPage += 1;
    } while (currentPage <= pageCount);

    return allEntries;
  }

  function buildPackage(
    entries: TranslationEntry[],
    mode: LanguagePackage["mode"]
  ): LanguagePackage {
    return {
      format: "uin-language-pack",
      version: 1,
      source_locale: sourceLocale,
      target_locale: selectedLanguage.code,
      target_language: selectedLanguage.native_name,
      exported_at: new Date().toISOString(),
      mode,
      instructions: [
        "Translate only the translation values. Do not rename keys.",
        "Keep source text unchanged so UIN can detect stale packages.",
        "Preserve template tokens such as {1}, {2} and {3} exactly.",
        "Empty translation values are skipped during import and never erase an existing translation.",
      ],
      entries: Object.fromEntries(
        entries.map((entry) => [
          entry.key,
          {
            source: entry.default_text,
            translation:
              mode === "source" ? "" : entry.value ?? "",
            source_revision: toNumber(entry.source_revision),
            namespace: entry.namespace,
            status: entry.status,
          },
        ])
      ),
    };
  }

  async function exportPackage(mode: LanguagePackage["mode"]) {
    setIsExporting(true);
    onMessage(null);

    try {
      let entries: TranslationEntry[];

      if (mode === "needs-review") {
        const [missing, outdated] = await Promise.all([
          fetchAllEntries("missing"),
          fetchAllEntries("outdated"),
        ]);
        const unique = new Map<string, TranslationEntry>();
        [...missing, ...outdated].forEach((entry) => unique.set(entry.key, entry));
        entries = Array.from(unique.values());
      } else {
        entries = await fetchAllEntries();
      }

      const payload = buildPackage(entries, mode);
      const languagePart = safeFilePart(selectedLanguage.code);
      const suffix =
        mode === "source"
          ? "source"
          : mode === "needs-review"
            ? "needs-review"
            : "full";

      downloadJson(`uin-${languagePart}-${suffix}.json`, payload);
      onMessage(`${entries.length} translation key(s) exported.`);
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "The language package could not be exported."
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function inspectFile(file: File) {
    if (!canImport) {
      onMessage("The source language is read-only.");
      return;
    }

    setIsReadingFile(true);
    setPreview(null);
    onMessage(null);

    try {
      const rawText = await file.text();
      const parsedJson = JSON.parse(rawText) as unknown;
      const incoming = normalizeIncomingPackage(parsedJson);
      const currentEntries = await fetchAllEntries();
      const currentByKey = new Map(
        currentEntries.map((entry) => [entry.key, entry])
      );
      const incomingByKey = new Map(
        incoming.entries.map((entry) => [entry.key, entry])
      );

      const unknownKeys: string[] = [];
      const staleEntries: string[] = [];
      const tokenIssues: string[] = [];
      const sourceMismatches: string[] = [];
      const entriesToApply: Array<{ key: string; value: string }> = [];
      let recognized = 0;
      let newTranslations = 0;
      let updatedTranslations = 0;
      let unchangedTranslations = 0;
      let emptyTranslations = 0;

      for (const incomingEntry of incoming.entries) {
        const current = currentByKey.get(incomingEntry.key);

        if (!current) {
          unknownKeys.push(incomingEntry.key);
          continue;
        }

        recognized += 1;
        const incomingValue = incomingEntry.translation;

        if (!incomingValue.trim()) {
          emptyTranslations += 1;
          continue;
        }

        const currentRevision = toNumber(current.source_revision);
        if (
          incomingEntry.sourceRevision !== undefined &&
          incomingEntry.sourceRevision < currentRevision
        ) {
          staleEntries.push(incomingEntry.key);
          continue;
        }

        if (
          incomingEntry.source !== undefined &&
          incomingEntry.source !== current.default_text
        ) {
          sourceMismatches.push(incomingEntry.key);
          continue;
        }

        if (!hasSameTemplateTokens(current.default_text, incomingValue)) {
          tokenIssues.push(incomingEntry.key);
          continue;
        }

        if (incomingValue === current.value) {
          unchangedTranslations += 1;
          continue;
        }

        if (!current.value.trim()) {
          newTranslations += 1;
        } else {
          updatedTranslations += 1;
        }

        entriesToApply.push({
          key: incomingEntry.key,
          value: incomingValue,
        });
      }

      const missingFromPackage = currentEntries.filter(
        (entry) => !incomingByKey.has(entry.key)
      ).length;

      setPreview({
        fileName: file.name,
        packageLocale: incoming.locale,
        packageMode: incoming.mode,
        expected: currentEntries.length,
        supplied: incoming.entries.length,
        recognized,
        missingFromPackage,
        unknownKeys,
        newTranslations,
        updatedTranslations,
        unchangedTranslations,
        emptyTranslations,
        staleEntries,
        tokenIssues,
        sourceMismatches,
        localeMismatch:
          incoming.locale !== null && incoming.locale !== selectedLanguage.code,
        entriesToApply,
      });
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "The JSON file could not be read."
      );
    } finally {
      setIsReadingFile(false);
    }
  }

  async function applyImport() {
    if (!preview || previewHasBlockingIssue || preview.entriesToApply.length === 0) {
      return;
    }

    setIsApplying(true);
    onMessage(null);

    try {
      const chunkSize = 100;
      let saved = 0;

      for (let index = 0; index < preview.entriesToApply.length; index += chunkSize) {
        const chunk = preview.entriesToApply.slice(index, index + chunkSize);
        const { data, error } = await supabase.rpc("admin_set_translations", {
          p_locale_code: selectedLanguage.code,
          p_entries: chunk,
        });

        if (error) {
          throw new Error(error.message);
        }

        saved += toNumber(data);
      }

      onMessage(`${saved} translation(s) imported from ${preview.fileName}.`);
      setPreview(null);
      await onReloadEditor();
      router.refresh();
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "The language package could not be imported."
      );
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <section className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
            Language Package Workflow
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Export, translate and import in bulk
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Download the complete catalogue, translate the JSON outside UIN, then upload it here for validation. Keys and English source text stay intact; only translation values should change.
          </p>
        </div>

        <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <p className="font-semibold">{selectedLanguage.native_name}</p>
          <p className="mt-1 text-xs text-indigo-700">
            {sourceLocale} source → {selectedLanguage.code} target
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => exportPackage("source")}
          disabled={isExporting}
          className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Source package
          </span>
          <span className="mt-2 block text-lg font-bold text-gray-950">
            Download English source JSON
          </span>
          <span className="mt-2 block text-sm leading-6 text-gray-500">
            Every active key with English source text and an empty translation field. Best for a fresh translation pass.
          </span>
        </button>

        <button
          type="button"
          onClick={() => exportPackage("full")}
          disabled={isExporting}
          className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left transition hover:border-green-300 hover:bg-green-50 disabled:opacity-50"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-green-700">
            Full package
          </span>
          <span className="mt-2 block text-lg font-bold text-gray-950">
            Download {selectedLanguage.native_name} JSON
          </span>
          <span className="mt-2 block text-sm leading-6 text-gray-500">
            Includes current translations, missing entries, source revisions and namespaces. Use this for backup or a complete review.
          </span>
        </button>

        <button
          type="button"
          onClick={() => exportPackage("needs-review")}
          disabled={isExporting}
          className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left transition hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-amber-700">
            Smaller package
          </span>
          <span className="mt-2 block text-lg font-bold text-gray-950">
            Download missing + outdated
          </span>
          <span className="mt-2 block text-sm leading-6 text-gray-500">
            Only strings that still need attention. Useful after new UIN features add another handful of text nobody asked to type twice.
          </span>
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-bold text-gray-950">Import translated JSON</p>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              UIN previews changes before writing anything. Unknown keys, stale source text and broken template tokens are skipped instead of quietly wrecking the interface.
            </p>
          </div>

          <label className={`inline-flex cursor-pointer items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
            canImport
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "cursor-not-allowed bg-gray-200 text-gray-500"
          }`}>
            {isReadingFile ? "Reading package..." : "Choose JSON file"}
            <input
              type="file"
              accept="application/json,.json"
              disabled={!canImport || isReadingFile || isApplying}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) {
                  void inspectFile(file);
                }
              }}
            />
          </label>
        </div>
      </div>

      {preview && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
                Import Preview
              </p>
              <h3 className="mt-2 text-lg font-bold text-gray-950">
                {preview.fileName}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {preview.packageMode ? `${preview.packageMode} package · ` : ""}
                {preview.supplied} supplied · {preview.recognized} recognized
              </p>
            </div>

            <button
              type="button"
              onClick={applyImport}
              disabled={
                isApplying ||
                previewHasBlockingIssue ||
                preview.entriesToApply.length === 0
              }
              className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-40"
            >
              {isApplying
                ? "Importing..."
                : `Apply ${preview.entriesToApply.length} translation(s)`}
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["New", preview.newTranslations, "bg-green-50 text-green-800"],
              ["Updated", preview.updatedTranslations, "bg-blue-50 text-blue-800"],
              ["Unchanged", preview.unchangedTranslations, "bg-gray-100 text-gray-700"],
              ["Empty / skipped", preview.emptyTranslations, "bg-gray-100 text-gray-700"],
              ["Missing from file", preview.missingFromPackage, "bg-amber-50 text-amber-800"],
              ["Unknown keys", preview.unknownKeys.length, "bg-amber-50 text-amber-800"],
              ["Stale source", preview.staleEntries.length + preview.sourceMismatches.length, "bg-red-50 text-red-800"],
              ["Token issues", preview.tokenIssues.length, "bg-red-50 text-red-800"],
            ].map(([label, value, classes]) => (
              <div key={String(label)} className={`rounded-xl px-4 py-3 ${classes}`}>
                <p className="text-xs">{label}</p>
                <p className="mt-1 text-xl font-bold">{String(value)}</p>
              </div>
            ))}
          </div>

          {preview.localeMismatch && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              This package targets {preview.packageLocale}, but you are editing {selectedLanguage.code}. Select the matching language before importing.
            </p>
          )}

          {(preview.staleEntries.length > 0 ||
            preview.sourceMismatches.length > 0 ||
            preview.tokenIssues.length > 0 ||
            preview.unknownKeys.length > 0) && (
            <details className="mt-4 rounded-xl border border-gray-200 bg-white">
              <summary className="cursor-pointer p-4 text-sm font-semibold text-gray-800">
                Review skipped entries
              </summary>
              <div className="space-y-4 border-t border-gray-100 p-4 text-xs text-gray-600">
                {preview.staleEntries.length > 0 && (
                  <div>
                    <p className="font-bold text-red-700">Outdated source revision</p>
                    <p className="mt-1 break-words">{preview.staleEntries.slice(0, 20).join(", ")}</p>
                  </div>
                )}
                {preview.sourceMismatches.length > 0 && (
                  <div>
                    <p className="font-bold text-red-700">English source changed</p>
                    <p className="mt-1 break-words">{preview.sourceMismatches.slice(0, 20).join(", ")}</p>
                  </div>
                )}
                {preview.tokenIssues.length > 0 && (
                  <div>
                    <p className="font-bold text-red-700">Template token mismatch</p>
                    <p className="mt-1 break-words">{preview.tokenIssues.slice(0, 20).join(", ")}</p>
                  </div>
                )}
                {preview.unknownKeys.length > 0 && (
                  <div>
                    <p className="font-bold text-amber-700">Unknown keys</p>
                    <p className="mt-1 break-words">{preview.unknownKeys.slice(0, 20).join(", ")}</p>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
