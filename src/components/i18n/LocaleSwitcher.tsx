"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  AppLocale,
} from "@/utils/i18n/types";
import { supabase } from "@/utils/supabase/client";

type LocaleSwitcherProps = {
  compact?: boolean;
};

type LocaleRow = {
  code: string;
  display_name: string;
  native_name: string;
  is_default: boolean;
  sort_order: number | string;
};

export default function LocaleSwitcher({
  compact = false,
}: LocaleSwitcherProps) {
  const [
    languages,
    setLanguages,
  ] = useState<AppLocale[]>(
    []
  );

  const [
    selectedLocale,
    setSelectedLocale,
  ] = useState("en");

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  useEffect(() => {
    setSelectedLocale(
      document.documentElement
        .lang ||
        "en"
    );

    async function loadLanguages() {
      /*
       * These columns existed from the first migration.
       * No optional RPC or newer is_source column is required here.
       */
      const {
        data,
        error,
      } = await supabase
        .from(
          "app_locales"
        )
        .select(
          "code, display_name, native_name, is_default, sort_order"
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          }
        )
        .order(
          "native_name",
          {
            ascending:
              true,
          }
        );

      if (error) {
        if (
          process.env.NODE_ENV !==
          "production"
        ) {
          console.warn(
            "Languages are temporarily unavailable:",
            error.message
          );
        }

        return;
      }

      const rows =
        (
          data ??
          []
        ) as LocaleRow[];

      setLanguages(
        rows.map(
          (
            language
          ) => ({
            ...language,
            is_source:
              language.code ===
              "en",
          })
        )
      );
    }

    loadLanguages();
  }, []);

  if (
    languages.length <
    2
  ) {
    return null;
  }

  async function changeLocale(
    localeCode: string
  ) {
    setSelectedLocale(
      localeCode
    );

    setIsSaving(true);

    document.cookie =
      `uin_locale=${encodeURIComponent(
        localeCode
      )}; Path=/; Max-Age=31536000; SameSite=Lax`;

    const {
      data:
        userResult,
    } =
      await supabase.auth.getUser();

    if (
      userResult.user
    ) {
      const {
        error,
      } = await supabase.rpc(
        "set_my_preferred_locale",
        {
          p_locale_code:
            localeCode,
        }
      );

      if (
        error &&
        process.env.NODE_ENV !==
          "production"
      ) {
        console.warn(
          "The profile language preference could not be saved:",
          error.message
        );
      }
    }

    window.location.reload();
  }

  return (
    <label
      className={
        compact
          ? "block border-t border-gray-100 px-4 py-3"
          : "block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
      }
      data-i18n-ignore="true"
    >
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
        Language
      </span>

      <select
        value={
          selectedLocale
        }
        onChange={(
          event
        ) =>
          changeLocale(
            event.target.value
          )
        }
        disabled={
          isSaving
        }
        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none transition focus:border-green-500 disabled:opacity-60"
      >
        {languages.map(
          (
            language
          ) => (
            <option
              key={
                language.code
              }
              value={
                language.code
              }
            >
              {
                language.native_name
              }
            </option>
          )
        )}
      </select>
    </label>
  );
}
