export const INTENT_LINK_TYPES = [
  "official_event",
  "ticket",
  "organizer",
  "venue",
  "reference",
  "video",
  "other",
] as const;

export type IntentLinkType =
  (typeof INTENT_LINK_TYPES)[number];

export type IntentLinkInput = {
  id?: string;
  linkType: IntentLinkType;
  label: string;
  url: string;
};

export type IntentLinkView = {
  id: string;
  intentId: string;
  linkType: IntentLinkType;
  label: string | null;
  url: string;
  sortOrder: number;
};

export type IntentLinkRpcRow = {
  intent_id: string;
  link_id: string;
  link_type: IntentLinkType;
  label: string | null;
  url: string;
  sort_order: number | string;
};

export const INTENT_LINK_TYPE_OPTIONS: Array<{
  value: IntentLinkType;
  label: string;
}> = [
  {
    value: "official_event",
    label: "Official event",
  },
  {
    value: "ticket",
    label: "Ticket",
  },
  {
    value: "organizer",
    label: "Organizer",
  },
  {
    value: "venue",
    label: "Venue",
  },
  {
    value: "reference",
    label: "More information",
  },
  {
    value: "video",
    label: "Video",
  },
  {
    value: "other",
    label: "Other",
  },
];

export function getIntentLinkLabel(
  link: Pick<
    IntentLinkInput,
    "linkType" | "label"
  >
) {
  const customLabel =
    link.label.trim();

  if (customLabel) {
    return customLabel;
  }

  return (
    INTENT_LINK_TYPE_OPTIONS.find(
      (option) =>
        option.value ===
        link.linkType
    )?.label ??
    "Related link"
  );
}

export function serializeIntentLinks(
  links: IntentLinkInput[]
) {
  return links.map(
    (link) => ({
      link_type:
        link.linkType,
      label:
        link.label.trim() ||
        null,
      url:
        link.url.trim(),
    })
  );
}

export function parseIntentLinkRows(
  rows:
    | IntentLinkRpcRow[]
    | null
    | undefined
): IntentLinkView[] {
  return (
    rows ?? []
  ).map(
    (row) => ({
      id:
        row.link_id,
      intentId:
        row.intent_id,
      linkType:
        row.link_type,
      label:
        row.label,
      url:
        row.url,
      sortOrder:
        Number(
          row.sort_order
        ),
    })
  );
}

export function groupIntentLinksByIntentId(
  links: IntentLinkView[]
) {
  const result =
    new Map<
      string,
      IntentLinkView[]
    >();

  links.forEach(
    (link) => {
      const existing =
        result.get(
          link.intentId
        ) ?? [];

      existing.push(
        link
      );

      result.set(
        link.intentId,
        existing
      );
    }
  );

  result.forEach(
    (intentLinks) => {
      intentLinks.sort(
        (first, second) =>
          first.sortOrder -
          second.sortOrder
      );
    }
  );

  return result;
}
