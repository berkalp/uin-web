"use client";

import { useLayoutEffect, useMemo } from "react";

import type { AppTranslationBundle } from "@/utils/i18n/types";

type AppTranslationRuntimeProps = {
  bundle: AppTranslationBundle;
};

type TemplateTranslation = {
  source: string;
  translated: string;
  pattern: RegExp;
};

type TranslationRecord = {
  source: string;
  translated: string;
};

const TRANSLATABLE_ATTRIBUTES = [
  "placeholder",
  "title",
  "aria-label",
  "alt",
] as const;

const SKIPPED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "KBD",
  "SAMP",
  "TEXTAREA",
]);

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function buildTemplateTranslation(
  source: string,
  translated: string
): TemplateTranslation | null {
  const placeholderPattern = /\{(\d+)\}/g;

  if (!placeholderPattern.test(source)) {
    return null;
  }

  placeholderPattern.lastIndex = 0;

  let cursor = 0;
  let pattern = "^";
  let match: RegExpExecArray | null;

  while ((match = placeholderPattern.exec(source))) {
    pattern += escapeRegExp(
      source.slice(cursor, match.index)
    );
    pattern += "(.+?)";
    cursor = match.index + match[0].length;
  }

  pattern += escapeRegExp(source.slice(cursor));
  pattern += "$";

  return {
    source,
    translated,
    pattern: new RegExp(pattern, "s"),
  };
}

function applyTemplateTranslation(
  translation: TemplateTranslation,
  value: string
) {
  const match = value.match(translation.pattern);

  if (!match) {
    return null;
  }

  return translation.translated.replace(
    /\{(\d+)\}/g,
    (_placeholder, indexText: string) => {
      const index = Number(indexText);
      return match[index] ?? "";
    }
  );
}

function isIgnoredNode(node: Node) {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  if (!element) {
    return false;
  }

  if (SKIPPED_TAGS.has(element.tagName)) {
    return true;
  }

  return Boolean(
    element.closest(
      "[data-i18n-ignore], [contenteditable='true']"
    )
  );
}

export default function AppTranslationRuntime({
  bundle,
}: AppTranslationRuntimeProps) {
  const sourceMessages = bundle.source_messages || {};

  const templateTranslations = useMemo(
    () =>
      Object.entries(sourceMessages)
        .map(([source, translated]) =>
          buildTemplateTranslation(source, translated)
        )
        .filter(
          (item): item is TemplateTranslation =>
            item !== null
        )
        .sort(
          (left, right) =>
            right.source.length - left.source.length
        ),
    [sourceMessages]
  );

  useLayoutEffect(() => {
    document.documentElement.lang =
      bundle.locale || bundle.default_locale || "en";

    const textRecords = new WeakMap<
      Text,
      TranslationRecord
    >();

    const attributeRecords = new WeakMap<
      Element,
      Map<string, TranslationRecord>
    >();

    function translateNormalized(value: string) {
      const exact = sourceMessages[value];

      if (exact !== undefined) {
        return exact;
      }

      for (const template of templateTranslations) {
        const translated = applyTemplateTranslation(
          template,
          value
        );

        if (translated !== null) {
          return translated;
        }
      }

      return value;
    }

    function translateRawText(rawValue: string) {
      const normalized = normalizeText(rawValue);

      if (!normalized) {
        return rawValue;
      }

      const translated = translateNormalized(normalized);

      if (translated === normalized) {
        return rawValue;
      }

      const leading = rawValue.match(/^\s*/)?.[0] ?? "";
      const trailing = rawValue.match(/\s*$/)?.[0] ?? "";

      return `${leading}${translated}${trailing}`;
    }

    function translateTextNode(node: Text) {
      if (isIgnoredNode(node)) {
        return;
      }

      const previous = textRecords.get(node);

      if (previous && node.data === previous.translated) {
        return;
      }

      const source = node.data;
      const translated = translateRawText(source);

      textRecords.set(node, {
        source,
        translated,
      });

      if (translated !== source) {
        node.data = translated;
      }
    }

    function translateAttribute(
      element: Element,
      attribute: string
    ) {
      const current = element.getAttribute(attribute);

      if (!current) {
        return;
      }

      let elementRecords = attributeRecords.get(element);

      if (!elementRecords) {
        elementRecords = new Map();
        attributeRecords.set(element, elementRecords);
      }

      const previous = elementRecords.get(attribute);

      if (previous && current === previous.translated) {
        return;
      }

      const translated = translateRawText(current);

      elementRecords.set(attribute, {
        source: current,
        translated,
      });

      if (translated !== current) {
        element.setAttribute(attribute, translated);
      }
    }

    function translateElement(element: Element) {
      if (isIgnoredNode(element)) {
        return;
      }

      for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        translateAttribute(element, attribute);
      }

      if (
        element instanceof HTMLInputElement &&
        ["button", "submit", "reset"].includes(
          element.type
        ) &&
        element.value
      ) {
        const translated = translateRawText(element.value);

        if (translated !== element.value) {
          element.value = translated;
        }
      }
    }

    function translateTree(root: Node) {
      if (root.nodeType === Node.TEXT_NODE) {
        translateTextNode(root as Text);
        return;
      }

      if (root.nodeType === Node.ELEMENT_NODE) {
        translateElement(root as Element);
      }

      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT |
          NodeFilter.SHOW_TEXT
      );

      let current = walker.nextNode();

      while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
          translateTextNode(current as Text);
        } else if (
          current.nodeType === Node.ELEMENT_NODE
        ) {
          translateElement(current as Element);
        }

        current = walker.nextNode();
      }
    }

    translateTree(document.documentElement);

    const observer = new MutationObserver(
      (mutations) => {
        for (const mutation of mutations) {
          if (
            mutation.type === "characterData" &&
            mutation.target instanceof Text
          ) {
            translateTextNode(mutation.target);
          }

          if (
            mutation.type === "attributes" &&
            mutation.target instanceof Element
          ) {
            translateElement(mutation.target);
          }

          for (const addedNode of mutation.addedNodes) {
            translateTree(addedNode);
          }
        }
      }
    );

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        ...TRANSLATABLE_ATTRIBUTES,
        "value",
      ],
    });

    return () => {
      observer.disconnect();
    };
  }, [
    bundle.default_locale,
    bundle.locale,
    sourceMessages,
    templateTranslations,
  ]);

  return null;
}
