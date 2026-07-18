import { supabase } from "@/utils/supabase/client";

export type SchedulePlanInput = {
  planId: string;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  meetingPoint: string;
  scheduleNotes?: string | null;
};

export type FinalizeActivityInput = {
  planId: string;
  continueRecruitment: boolean;
};

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function getDateTimePartsInTimezone(
  date: Date,
  timezone: string
): DateTimeParts {
  const formatter = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  );

  const parts = formatter.formatToParts(date);

  const getPart = (type: string) => {
    const value = parts.find(
      (part) => part.type === type
    )?.value;

    if (!value) {
      throw new Error(
        "The date and time could not be processed."
      );
    }

    return Number(value);
  };

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
  };
}

function parseLocalDateTime(
  localDateTime: string
): DateTimeParts {
  const match = localDateTime.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (!match) {
    throw new Error(
      "Select a valid date and time."
    );
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

function dateTimePartsToUtcMilliseconds(
  parts: DateTimeParts
) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0,
    0
  );
}

function zonedDateTimeToIso(
  localDateTime: string,
  timezone: string
) {
  const desiredParts =
    parseLocalDateTime(localDateTime);

  const desiredUtcMilliseconds =
    dateTimePartsToUtcMilliseconds(
      desiredParts
    );

  let calculatedMilliseconds =
    desiredUtcMilliseconds;

  for (
    let attempt = 0;
    attempt < 4;
    attempt += 1
  ) {
    const calculatedDate = new Date(
      calculatedMilliseconds
    );

    const actualParts =
      getDateTimePartsInTimezone(
        calculatedDate,
        timezone
      );

    const actualUtcMilliseconds =
      dateTimePartsToUtcMilliseconds(
        actualParts
      );

    const difference =
      desiredUtcMilliseconds -
      actualUtcMilliseconds;

    calculatedMilliseconds += difference;

    if (difference === 0) {
      break;
    }
  }

  const finalDate = new Date(
    calculatedMilliseconds
  );

  const finalParts =
    getDateTimePartsInTimezone(
      finalDate,
      timezone
    );

  const isExactMatch =
    finalParts.year === desiredParts.year &&
    finalParts.month === desiredParts.month &&
    finalParts.day === desiredParts.day &&
    finalParts.hour === desiredParts.hour &&
    finalParts.minute === desiredParts.minute;

  if (!isExactMatch) {
    throw new Error(
      "The selected date and time are not valid in this timezone."
    );
  }

  return finalDate.toISOString();
}

export async function schedulePlan({
  planId,
  scheduledStart,
  scheduledEnd,
  timezone,
  meetingPoint,
  scheduleNotes,
}: SchedulePlanInput) {
  const cleanedMeetingPoint =
    meetingPoint.trim();

  const cleanedScheduleNotes =
    scheduleNotes?.trim() || null;

  if (!planId) {
    throw new Error(
      "Plan information is missing."
    );
  }

  if (!scheduledStart) {
    throw new Error(
      "Start date and time are required."
    );
  }

  if (!scheduledEnd) {
    throw new Error(
      "End date and time are required."
    );
  }

  if (!timezone) {
    throw new Error(
      "Timezone information is missing."
    );
  }

  if (!cleanedMeetingPoint) {
    throw new Error(
      "Meeting point is required."
    );
  }

  const scheduledStartIso =
    zonedDateTimeToIso(
      scheduledStart,
      timezone
    );

  const scheduledEndIso =
    zonedDateTimeToIso(
      scheduledEnd,
      timezone
    );

  const startMilliseconds =
    new Date(
      scheduledStartIso
    ).getTime();

  const endMilliseconds =
    new Date(
      scheduledEndIso
    ).getTime();

  if (
    endMilliseconds <=
    startMilliseconds
  ) {
    throw new Error(
      "End time must be later than start time."
    );
  }

  const { data, error } =
    await supabase.rpc("schedule_plan", {
      p_plan_id: planId,
      p_scheduled_start:
        scheduledStartIso,
      p_scheduled_end:
        scheduledEndIso,
      p_meeting_point:
        cleanedMeetingPoint,
      p_schedule_notes:
        cleanedScheduleNotes,
    });

  if (error) {
    throw new Error(
      error.message ||
        "The schedule draft could not be saved."
    );
  }

  return data as string;
}

export async function finalizeActivity({
  planId,
  continueRecruitment,
}: FinalizeActivityInput) {
  if (!planId) {
    throw new Error(
      "Plan information is missing."
    );
  }

  const { data, error } =
    await supabase.rpc(
      "finalize_activity",
      {
        p_plan_id: planId,
        p_continue_recruitment:
          continueRecruitment,
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "The Activity could not be finalized."
    );
  }

  return data as string;
}