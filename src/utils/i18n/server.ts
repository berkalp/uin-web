import {
  EMPTY_TRANSLATION_BUNDLE,
  type AppLocale,
  type AppTranslationBundle,
} from "@/utils/i18n/types";
import { createClient } from "@/utils/supabase/server";

type RawTranslationBundle = {
  locale?: string;
  default_locale?: string;
  source_locale?: string;
  messages?: Record<
    string,
    string
  >;
  source_messages?: Record<
    string,
    string
  >;
  languages?: AppLocale[];
};

export async function getAppTranslationBundle(
  requestedLocale: string | null
): Promise<AppTranslationBundle> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_app_translations",
    {
      p_locale_code:
        requestedLocale,
    }
  );

  if (
    error ||
    !data
  ) {
    if (
      process.env.NODE_ENV !==
      "production"
    ) {
      console.warn(
        "Translations are temporarily unavailable:",
        error?.message ??
          "No translation data returned."
      );
    }

    return {
      ...EMPTY_TRANSLATION_BUNDLE,
      locale:
        requestedLocale ||
        EMPTY_TRANSLATION_BUNDLE.locale,
    };
  }

  const payload =
    data as RawTranslationBundle;

  return {
    locale:
      payload.locale ||
      requestedLocale ||
      EMPTY_TRANSLATION_BUNDLE.locale,

    default_locale:
      payload.default_locale ||
      EMPTY_TRANSLATION_BUNDLE.default_locale,

    source_locale:
      payload.source_locale ||
      EMPTY_TRANSLATION_BUNDLE.source_locale,

    messages:
      payload.messages &&
      typeof payload.messages ===
        "object"
        ? payload.messages
        : {},

    /*
     * AppTranslationRuntime translates visible DOM text by matching
     * the English source sentence against this source-text dictionary.
     */
    source_messages:
      payload.source_messages &&
      typeof payload.source_messages ===
        "object"
        ? payload.source_messages
        : {},

    languages:
      Array.isArray(
        payload.languages
      )
        ? payload.languages
        : [],
  };
}
