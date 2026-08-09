type ActivityLifecycleTimelineProps = {
  targetStart?: string | null;
  targetEnd?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  expiredAt?: string | null;
  status: string;
  timezone?: string | null;
  variant?: "compact" | "detail" | "horizontal";
  title?: string;
  description?: string;
};

type TimelineStepTone =
  | "target"
  | "plan"
  | "success"
  | "danger"
  | "warning"
  | "pending";

type TimelineStep = {
  label: string;
  value: string;
  helper: string | null;
  tone: TimelineStepTone;
};

function getSafeTimezone(
  timezone: string | null | undefined
) {
  const candidate =
    timezone?.trim() ||
    "Europe/Istanbul";

  try {
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: candidate,
      }
    ).format(new Date());

    return candidate;
  } catch {
    return "UTC";
  }
}

function parseDateValue(
  value: string | null | undefined
) {
  if (!value) {
    return null;
  }

  const trimmedValue =
    value.trim();

  if (!trimmedValue) {
    return null;
  }

  const dateOnlyMatch =
    /^\d{4}-\d{2}-\d{2}$/.test(
      trimmedValue
    );

  const date = new Date(
    dateOnlyMatch
      ? `${trimmedValue}T00:00:00Z`
      : trimmedValue
  );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function formatTargetDate(
  value: string | null | undefined
) {
  const date =
    parseDateValue(value);

  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function formatDateTime(
  value: string | null | undefined,
  timezone: string
) {
  const date =
    parseDateValue(value);

  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(date);
}

function formatTime(
  value: string | null | undefined,
  timezone: string
) {
  const date =
    parseDateValue(value);

  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(date);
}

function getLocalDateKey(
  value: string | null | undefined,
  timezone: string
) {
  const date =
    parseDateValue(value);

  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date);
}

function formatTargetWindow(
  startValue: string | null | undefined,
  endValue: string | null | undefined
) {
  const start =
    formatTargetDate(startValue);

  const end =
    formatTargetDate(endValue);

  if (start && end) {
    return start === end
      ? start
      : `${start} → ${end}`;
  }

  return (
    start ??
    end ??
    "No target window recorded"
  );
}

function formatSchedule(
  startValue: string | null | undefined,
  endValue: string | null | undefined,
  timezone: string
) {
  const start =
    formatDateTime(
      startValue,
      timezone
    );

  if (!start) {
    return null;
  }

  const end =
    formatDateTime(
      endValue,
      timezone
    );

  if (!end) {
    return start;
  }

  const sameDay =
    getLocalDateKey(
      startValue,
      timezone
    ) ===
    getLocalDateKey(
      endValue,
      timezone
    );

  if (sameDay) {
    return `${start} → ${
      formatTime(
        endValue,
        timezone
      ) ?? end
    }`;
  }

  return `${start} → ${end}`;
}

function normalizeStatus(
  status: string,
  expiredAt: string | null | undefined
) {
  if (expiredAt) {
    return "expired";
  }

  return status
    .trim()
    .toLocaleLowerCase("en-US");
}

function getSteps({
  targetStart,
  targetEnd,
  scheduledStart,
  scheduledEnd,
  completedAt,
  cancelledAt,
  expiredAt,
  status,
  timezone,
}: Omit<
  ActivityLifecycleTimelineProps,
  "variant" | "title" | "description"
>): TimelineStep[] {
  const safeTimezone =
    getSafeTimezone(timezone);

  const normalizedStatus =
    normalizeStatus(
      status,
      expiredAt
    );

  const targetWindow =
    formatTargetWindow(
      targetStart,
      targetEnd
    );

  const confirmedSchedule =
    formatSchedule(
      scheduledStart,
      scheduledEnd,
      safeTimezone
    );

  const completedRecord =
    formatDateTime(
      completedAt,
      safeTimezone
    );

  const cancellationRecord =
    formatDateTime(
      cancelledAt,
      safeTimezone
    );

  const occurredAt =
    formatDateTime(
      scheduledEnd ??
        scheduledStart,
      safeTimezone
    );

  const planStep: TimelineStep =
    confirmedSchedule
      ? {
          label:
            "Confirmed plan",
          value:
            confirmedSchedule,
          helper:
            "The date and time agreed in the Planning Room.",
          tone: "plan",
        }
      : {
          label:
            "Confirmed plan",
          value:
            normalizedStatus ===
              "forming"
              ? "Planning in progress"
              : "Not scheduled yet",
          helper:
            normalizedStatus ===
              "forming"
              ? "The group is still choosing the exact date and time."
              : "No exact Activity schedule has been confirmed.",
          tone: "pending",
        };

  let outcomeStep: TimelineStep;

  if (
    normalizedStatus ===
    "completed"
  ) {
    outcomeStep = {
      label: "Outcome",
      value: occurredAt
        ? `Completed · ${occurredAt}`
        : completedRecord
          ? `Completed · ${completedRecord}`
          : "Completed",
      helper:
        completedRecord &&
        completedRecord !==
          occurredAt
          ? `Marked complete in UIN on ${completedRecord}.`
          : "The Activity was recorded as completed.",
      tone: "success",
    };
  } else if (
    normalizedStatus ===
    "cancelled"
  ) {
    outcomeStep = {
      label: "Outcome",
      value: cancellationRecord
        ? `Cancelled · ${cancellationRecord}`
        : "Cancelled",
      helper:
        confirmedSchedule
          ? "A confirmed plan existed, but the Activity was cancelled."
          : "The Activity was cancelled before it happened.",
      tone: "danger",
    };
  } else if (
    normalizedStatus ===
    "expired"
  ) {
    outcomeStep = {
      label: "Outcome",
      value: "Did not happen",
      helper:
        "The target window ended without a completed Activity.",
      tone: "warning",
    };
  } else if (
    normalizedStatus ===
      "planned" ||
    normalizedStatus ===
      "forming"
  ) {
    outcomeStep = {
      label: "Outcome",
      value:
        "Waiting for the Activity",
      helper:
        normalizedStatus ===
        "planned"
          ? "The schedule is confirmed, but the result has not been recorded yet."
          : "Planning has started, but no final result exists yet.",
      tone: "pending",
    };
  } else if (
    normalizedStatus ===
    "closed"
  ) {
    outcomeStep = {
      label: "Outcome",
      value:
        "Closed without a result",
      helper:
        "This Intent is no longer accepting matches and has no completed Activity.",
      tone: "warning",
    };
  } else {
    outcomeStep = {
      label: "Outcome",
      value:
        "Waiting for a match",
      helper:
        "This person shared when they are available, but no Activity has happened yet.",
      tone: "pending",
    };
  }

  return [
    {
      label:
        "Target availability",
      value: targetWindow,
      helper:
        "When this person said they were available for the Activity.",
      tone: "target",
    },
    planStep,
    outcomeStep,
  ];
}

function getToneClasses(
  tone: TimelineStepTone
) {
  if (tone === "target") {
    return {
      dot: "bg-amber-500 ring-amber-100",
      badge:
        "bg-amber-50 text-amber-800",
    };
  }

  if (tone === "plan") {
    return {
      dot: "bg-blue-600 ring-blue-100",
      badge:
        "bg-blue-50 text-blue-800",
    };
  }

  if (tone === "success") {
    return {
      dot: "bg-green-600 ring-green-100",
      badge:
        "bg-green-50 text-green-800",
    };
  }

  if (tone === "danger") {
    return {
      dot: "bg-red-600 ring-red-100",
      badge:
        "bg-red-50 text-red-800",
    };
  }

  if (tone === "warning") {
    return {
      dot: "bg-orange-500 ring-orange-100",
      badge:
        "bg-orange-50 text-orange-800",
    };
  }

  return {
    dot: "bg-gray-400 ring-gray-100",
    badge:
      "bg-gray-100 text-gray-700",
  };
}

export default function ActivityLifecycleTimeline({
  targetStart,
  targetEnd,
  scheduledStart,
  scheduledEnd,
  completedAt,
  cancelledAt,
  expiredAt,
  status,
  timezone,
  variant = "detail",
  title = "Activity journey",
  description =
    "The original availability, the confirmed plan and the final result.",
}: ActivityLifecycleTimelineProps) {
  const steps = getSteps({
    targetStart,
    targetEnd,
    scheduledStart,
    scheduledEnd,
    completedAt,
    cancelledAt,
    expiredAt,
    status,
    timezone,
  });

  const isCompact =
    variant === "compact";
  const isHorizontal =
    variant === "horizontal";

  if (isCompact) {
    const headline =
      steps.find((step) => step.tone === "plan")?.value ||
      steps[0]?.value ||
      "Intent journey";

    return (
      <details className="group h-full min-w-0 overflow-hidden rounded-xl border border-gray-100 bg-white/75 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-green-700">
              Intent Journey
            </p>
            <p className="mt-0.5 truncate text-[11px] font-bold leading-4 text-gray-900">
              {headline}
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[9px] font-bold text-gray-600 transition group-open:rotate-180">
            ▾
          </span>
        </summary>

        <div className="space-y-1 border-t border-gray-100 px-3 py-2">
          {steps.map((step) => {
            const tone = getToneClasses(step.tone);

            return (
              <div
                key={step.label}
                className="flex min-w-0 items-center gap-2"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ring-2 ${tone.dot}`}
                />
                <span className="w-[72px] shrink-0 truncate text-[8px] font-semibold uppercase tracking-[0.05em] text-gray-400">
                  {step.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-gray-900">
                  {step.value}
                </span>
              </div>
            );
          })}
        </div>
      </details>
    );
  }

  if (isHorizontal) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-green-700">
            Timeline
          </p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {steps.map((step, index) => {
            const tone = getToneClasses(step.tone);

            return (
              <article
                key={step.label}
                className="min-w-0 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ${tone.dot}`}
                  />
                  <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                    {step.label}
                  </p>
                  <span
                    className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${tone.badge}`}
                  >
                    {index + 1}
                  </span>
                </div>

                <p className="mt-2 text-sm font-bold leading-5 text-gray-950">
                  {step.value}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section
      className={
        isCompact
          ? "min-w-0"
          : "rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6"
      }
    >
      {!isCompact && (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
            Timeline
          </p>

          <h2 className="mt-2 text-xl font-bold text-gray-950 md:text-2xl">
            {title}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            {description}
          </p>
        </div>
      )}

      <div
        className={
          isCompact
            ? "space-y-1.5"
            : "space-y-3"
        }
      >
        {steps.map(
          (step, index) => {
            const tone =
              getToneClasses(
                step.tone
              );

            const isLast =
              index ===
              steps.length - 1;

            return (
              <div
                key={step.label}
                className={`relative flex gap-3 ${
                  isCompact
                    ? "min-h-[34px]"
                    : "rounded-2xl bg-gray-50 p-4 md:p-5"
                }`}
              >
                <div className="relative flex w-4 shrink-0 justify-center">
                  <span
                    className={`relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ${tone.dot}`}
                  />

                  {!isLast && (
                    <span
                      className={`absolute bottom-[-14px] top-4 w-px ${
                        isCompact
                          ? "bg-gray-200"
                          : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`font-semibold uppercase tracking-wide text-gray-400 ${
                        isCompact
                          ? "text-[9px]"
                          : "text-[10px]"
                      }`}
                    >
                      {step.label}
                    </p>

                    {!isCompact && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.badge}`}
                      >
                        {index + 1}
                      </span>
                    )}
                  </div>

                  <p
                    className={`mt-1 font-bold text-gray-950 ${
                      isCompact
                        ? "text-[11px] leading-4"
                        : "text-base leading-6 md:text-lg"
                    }`}
                  >
                    {step.value}
                  </p>

                  {!isCompact &&
                    step.helper && (
                    <p className="mt-1 text-sm leading-6 text-gray-500">
                      {step.helper}
                    </p>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    </section>
  );
}
