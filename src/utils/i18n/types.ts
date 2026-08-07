export type AppLocale = {
  code: string;
  display_name: string;
  native_name: string;
  is_default: boolean;
  is_source: boolean;
  sort_order: number | string;
};

export type AppTranslationBundle = {
  locale: string;
  default_locale: string;
  source_locale: string;
  messages: Record<string, string>;
  source_messages: Record<string, string>;
  languages: AppLocale[];
};

export const EMPTY_TRANSLATION_BUNDLE: AppTranslationBundle = {
  locale: "en",
  default_locale: "en",
  source_locale: "en",
  messages: {},
  source_messages: {},
  languages: [],
};
