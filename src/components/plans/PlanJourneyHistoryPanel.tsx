import Link from "next/link";

export type PlanJourneyLifecycleEvent = {
  id: string;
  eventType: string;
  actorName: string | null;
  subjectName: string | null;
  roomPhase: "planning" | "activity" | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type JourneyItem = {
  key: string;
  occurredAt: string;
  label: string;
  title: string;
  description: string;
  tone: "green" | "blue" | "amber" | "red" | "gray" | "purple";
  icon: string;
};

type Props = {
  planId: string;
  planCreatedAt: string;
  plannedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  status: "forming" | "planned" | "completed" | "cancelled";
  timezone: string;
  sourceIntentCount: number;
  cancellationReason?: string | null;
  lifecycleEvents: PlanJourneyLifecycleEvent[];
};

function getMetadataString(
  metadata: Record<string, unknown> | null,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatDateTime(value: string, timezone: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: timezone || "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  } catch {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  }
}

function toneClasses(tone: JourneyItem["tone"]) {
  if (tone === "green") {
    return {
      dot: "bg-green-600 ring-green-100",
      badge: "bg-green-50 text-green-800",
      card: "border-green-100 bg-green-50/40",
    };
  }

  if (tone === "blue") {
    return {
      dot: "bg-blue-600 ring-blue-100",
      badge: "bg-blue-50 text-blue-800",
      card: "border-blue-100 bg-blue-50/40",
    };
  }

  if (tone === "amber") {
    return {
      dot: "bg-amber-500 ring-amber-100",
      badge: "bg-amber-50 text-amber-800",
      card: "border-amber-100 bg-amber-50/40",
    };
  }

  if (tone === "red") {
    return {
      dot: "bg-red-600 ring-red-100",
      badge: "bg-red-50 text-red-800",
      card: "border-red-100 bg-red-50/40",
    };
  }

  if (tone === "purple") {
    return {
      dot: "bg-purple-600 ring-purple-100",
      badge: "bg-purple-50 text-purple-800",
      card: "border-purple-100 bg-purple-50/40",
    };
  }

  return {
    dot: "bg-gray-400 ring-gray-100",
    badge: "bg-gray-100 text-gray-700",
    card: "border-gray-100 bg-gray-50/60",
  };
}

function eventToJourneyItem(event: PlanJourneyLifecycleEvent): JourneyItem | null {
  if (event.eventType === "plan_cancelled") {
    return null;
  }

  if (event.eventType === "member_left") {
    const name = event.subjectName || event.actorName || "Bir katılımcı";
    return {
      key: `event:${event.id}`,
      occurredAt: event.createdAt,
      label: event.roomPhase === "planning" ? "Planlama" : "Aktivite",
      title: `${name} ayrıldı`,
      description:
        event.roomPhase === "planning"
          ? "Katılımcı Planlama Odasından ayrıldı. Üyelik geçmişi silinmedi."
          : "Katılımcı artık Aktiviteye katılmayacak. Katılım geçmişi korunuyor.",
      tone: "amber",
      icon: "↪",
    };
  }

  if (event.eventType === "linked_intent_reopened") {
    const name = event.subjectName || event.actorName || "Niyet sahibi";
    return {
      key: `event:${event.id}`,
      occurredAt: event.createdAt,
      label: "Recovery",
      title: `${name} Niyetini yeniden açtı`,
      description:
        "İptal edilen Plan / Aktivite geçmişte kaldı; kaynak Niyet yeni bir deneme için tekrar açıldı.",
      tone: "green",
      icon: "↺",
    };
  }

  if (event.eventType === "host_transferred") {
    const name = event.subjectName || "yeni host";
    return {
      key: `event:${event.id}`,
      occurredAt: event.createdAt,
      label: "Team",
      title: `Hostluk ${name} kullanıcısına devredildi`,
      description: "Organizasyon devam etti; geçmişteki host değişimi Journey içinde korunuyor.",
      tone: "purple",
      icon: "⇄",
    };
  }

  const eventLabel = event.eventType.replaceAll("_", " ");
  const reason = getMetadataString(event.metadata, "reason_label");

  return {
    key: `event:${event.id}`,
    occurredAt: event.createdAt,
    label: event.roomPhase === "planning" ? "Planlama" : event.roomPhase === "activity" ? "Aktivite" : "Journey",
    title: eventLabel.charAt(0).toLocaleUpperCase("tr-TR") + eventLabel.slice(1),
    description: reason || "Bu lifecycle olayı geçmiş kaydına işlendi.",
    tone: "gray",
    icon: "•",
  };
}

export default function PlanJourneyHistoryPanel({
  planId,
  planCreatedAt,
  plannedAt,
  completedAt,
  cancelledAt,
  expiredAt,
  status,
  timezone,
  sourceIntentCount,
  cancellationReason,
  lifecycleEvents,
}: Props) {
  const items: JourneyItem[] = [
    {
      key: "plan-created",
      occurredAt: planCreatedAt,
      label: "Intent → Plan",
      title: "Planlama Odası oluşturuldu",
      description:
        sourceIntentCount > 1
          ? `${sourceIntentCount} uyumlu Niyet bu ortak Planın kaynağını oluşturdu.`
          : "Kaynak Niyet Planlama Odasına dönüştü.",
      tone: "green",
      icon: "🌱",
    },
  ];

  if (plannedAt) {
    items.push({
      key: "activity-confirmed",
      occurredAt: plannedAt,
      label: "Plan → Activity",
      title: "Aktivite kesinleşti",
      description: "Planlama tamamlandı ve aynı geçmişin Activity Room aşaması açıldı.",
      tone: "blue",
      icon: "✓",
    });
  }

  for (const event of lifecycleEvents) {
    const item = eventToJourneyItem(event);
    if (item) items.push(item);
  }

  if (cancelledAt) {
    items.push({
      key: "cancelled",
      occurredAt: cancelledAt,
      label: status === "cancelled" && plannedAt ? "Activity → Cancelled" : "Plan → Cancelled",
      title: plannedAt ? "Aktivite iptal edildi" : "Plan iptal edildi",
      description: cancellationReason
        ? `Gerekçe: ${cancellationReason}. Geçmiş silinmedi ve bağlı Niyetler otomatik olarak yeniden açılmadı.`
        : "Geçmiş silinmedi ve bağlı Niyetler otomatik olarak yeniden açılmadı.",
      tone: "red",
      icon: "×",
    });
  } else if (completedAt) {
    items.push({
      key: "completed",
      occurredAt: completedAt,
      label: "Activity → Memory",
      title: "Aktivite yaşandı",
      description: "Aktivite tamamlandı. Değerlendirme, Reputation ve Memory aşaması açıldı.",
      tone: "purple",
      icon: "◆",
    });
  } else if (expiredAt) {
    items.push({
      key: "expired",
      occurredAt: expiredAt,
      label: "Expired",
      title: "Planlama penceresi sona erdi",
      description: "Plan geçmişte korunuyor; bu deneme yeni bir Activityye dönüşmeden sona erdi.",
      tone: "amber",
      icon: "⌛",
    });
  }

  items.sort((left, right) => {
    const delta = new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
    if (delta !== 0) return delta;
    return left.key.localeCompare(right.key);
  });

  const currentLabel = cancelledAt
    ? "İptal edildi"
    : completedAt
      ? "Yaşandı"
      : plannedAt
        ? "Aktivite"
        : "Planlama";

  return (
    <section
      id="journey-history"
      className="scroll-mt-24 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-700">
            Niyet Yolculuğu
          </p>
          <h2 className="mt-2 text-xl font-black text-gray-950 md:text-2xl">
            Geçmiş geri sarılmaz
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            Niyetin Plana, Planın Aktiviteye dönüşmesi; ayrılmalar, iptaller ve yeniden açılmalar aynı Journey içinde ayrı olaylar olarak korunur.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-700">
            {sourceIntentCount} {sourceIntentCount === 1 ? "Niyet" : "Niyet"} → 1 Plan
          </span>
          <span className="rounded-full border border-green-200 bg-green-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-green-800">
            Şimdi · {currentLabel}
          </span>
        </div>
      </div>

      <div className="relative mt-6">
        <div className="absolute bottom-5 left-[17px] top-5 w-px bg-gray-200" aria-hidden="true" />

        <div className="space-y-3">
          {items.map((item, index) => {
            const tone = toneClasses(item.tone);

            return (
              <article key={item.key} className="relative flex gap-4">
                <div className="relative z-10 mt-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white bg-white shadow-sm">
                  <span className={`absolute h-3 w-3 rounded-full ring-4 ${tone.dot}`} aria-hidden="true" />
                  <span className="sr-only">{item.icon}</span>
                </div>

                <div className={`min-w-0 flex-1 rounded-2xl border p-4 ${tone.card}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${tone.badge}`}>
                          {item.label}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-400">
                          Adım {index + 1}
                        </span>
                      </div>
                      <h3 className="mt-2 text-sm font-black text-gray-950 md:text-base">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-gray-600 md:text-sm">
                        {item.description}
                      </p>
                    </div>

                    <time className="shrink-0 text-[10px] font-semibold text-gray-400">
                      {formatDateTime(item.occurredAt, timezone)}
                    </time>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {cancelledAt && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
          <div>
            <p className="text-xs font-black text-green-950">İptal, Niyetin sonu olmak zorunda değil.</p>
            <p className="mt-1 text-xs leading-5 text-green-800">
              Kaynak Niyet sana aitse bu odadaki recovery alanından yeniden açabilir; bu iptal edilmiş deneme Journey içinde kalır.
            </p>
          </div>
          <Link
            href={`/plans/${encodeURIComponent(planId)}/${plannedAt ? "activity" : "planning"}#top`}
            className="rounded-xl border border-green-200 bg-white px-3 py-2 text-xs font-bold text-green-800"
          >
            Oda durumuna dön ↑
          </Link>
        </div>
      )}
    </section>
  );
}
