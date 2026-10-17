type PlanTimingInput = {status: string; scheduled_start: string | null; scheduled_end: string | null};
// Read the clock once at the server request boundary; callers/tests can supply a snapshot.
export function getPlanRoomTiming(plan: PlanTimingInput, phase: 'planning' | 'activity', now = Date.now()) {
  const start = plan.scheduled_start ? Date.parse(plan.scheduled_start) : NaN;
  const end = plan.scheduled_end ? Date.parse(plan.scheduled_end) : NaN;
  const active = phase === 'activity' && plan.status === 'planned';
  const hasScheduledActivityStarted = active && Number.isFinite(start) && start <= now;
  const isScheduledActivityEnded = active && Number.isFinite(end) && end <= now;
  return {hasScheduledActivityStarted, isScheduledActivityEnded, isOutcomeUnknown: isScheduledActivityEnded && end + 7 * 24 * 60 * 60 * 1000 <= now};
}
