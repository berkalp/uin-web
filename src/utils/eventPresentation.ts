import { commonIntentTitle } from "@/utils/commonIntentTitle";

export type EventDnaCard = {
  targetId: string;
  title: string;
  kind?: string | null;
  isPrimary?: boolean;
  coverUrl?: string | null;
};

export type EventPresentation = {
  intentId: string;
  planId?: string | null;
  activityId: string;
  intentLabel: string;
  eventLabel: string;
  categoryId?: string | null;
  categoryName?: string | null;
  displayTitle: string;
  mainTarget?: EventDnaCard | null;
  primaryDna?: EventDnaCard | null;
  dnaCards: EventDnaCard[];
  aiCoverEnabled?: boolean;
  visualRuleVersion?: string;
};

const EVENT_LABELS: Record<string, string> = {
  "host a house gathering": "Ev Buluşması",
  "join a social gathering": "Sosyal Buluşma",
  "watch a sports broadcast together": "Birlikte Spor Yayını",
  "sing karaoke": "Karaoke",
  camping: "Kamp",
  cycling: "Bisiklet",
  concert: "Konser",
  "watch sports live at the venue": "Sporu Yerinde Canlı İzleme",
};

export function activityIntentLabel(name: string | null | undefined, explicit?: string | null) {
  return explicit?.trim() || commonIntentTitle(name);
}

export function activityEventLabel(name: string | null | undefined, explicit?: string | null) {
  const source = name?.trim() || "UIN Aktivitesi";
  return explicit?.trim() || EVENT_LABELS[source.toLocaleLowerCase("en-US")] || commonIntentTitle(source);
}

export function buildEventTitle({
  activityName,
  eventLabel,
  primaryDnaTitle,
}: {
  activityName?: string | null;
  eventLabel?: string | null;
  primaryDnaTitle?: string | null;
}) {
  const base = activityEventLabel(activityName, eventLabel);
  const dna = primaryDnaTitle?.trim();
  if (!dna || dna.toLocaleLowerCase("tr-TR") === base.toLocaleLowerCase("tr-TR")) return base;
  return `${base} · ${dna}`;
}

export function eventTitleFromPresentation(
  presentation: EventPresentation | null | undefined,
  fallbackActivityName?: string | null,
) {
  if (presentation?.displayTitle?.trim()) return presentation.displayTitle.trim();
  return buildEventTitle({
    activityName: fallbackActivityName,
    eventLabel: presentation?.eventLabel,
    primaryDnaTitle: presentation?.primaryDna?.title,
  });
}
