import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getCollaborationActivityPresentation,
  parseCollaborationActivity,
} from "../src/lib/collaborationActivity.ts";

const INTENT_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_ID = "22222222-2222-4222-8222-222222222222";

function row(overrides = {}) {
  return {
    planning_intent_id: INTENT_ID,
    plan_id: PLAN_ID,
    activity_title: "Explore the City Together",
    activity_status: "planned",
    window_start: "2026-11-01",
    window_end: "2026-11-01",
    scheduled_start: "2026-11-01T10:00:00+03:00",
    scheduled_end: "2026-11-01T12:00:00+03:00",
    timezone: "Europe/Istanbul",
    activity_location_name: "Eskişehir",
    meeting_point: "Odunpazarı",
    activity_city: "Eskişehir",
    activity_district: "Odunpazarı",
    cancelled_at: null,
    completed_at: null,
    expired_at: null,
    cancellation_phase: null,
    viewer_can_open_room: true,
    event_resolution: "plan_resolved",
    ...overrides,
  };
}

test("verified activity projection drives exact web lifecycle labels and direct room routes", () => {
  const activity = parseCollaborationActivity(row(), "Eskişehir");
  assert.ok(activity);

  const future = getCollaborationActivityPresentation(activity, "2026-10-10T12:00:00Z");
  const current = getCollaborationActivityPresentation(activity, "2026-11-01T08:00:00Z");
  const ended = getCollaborationActivityPresentation(activity, "2026-11-01T10:00:01Z");

  assert.equal(future.label, "Planlandı");
  assert.equal(future.tone, "amber");
  assert.equal(future.dateLabel, "1 Kas 2026 · 10:00–12:00");
  assert.equal(future.locationLabel, "Eskişehir · Odunpazarı");
  assert.equal(future.href, `/plans/${PLAN_ID}/activity`);
  assert.equal(current.label, "Şu an aktif");
  assert.equal(current.tone, "green");
  assert.equal(ended.label, "Sonuç bekleniyor");
  assert.equal(ended.tone, "slate");
});

test("planning cancellation and activity cancellation use different truthful labels", () => {
  const planningCancellation = parseCollaborationActivity(row({
    activity_status: "cancelled",
    cancellation_phase: "planning",
    cancelled_at: "2026-10-07T10:00:00Z",
  }), "Eskişehir");
  const activityCancellation = parseCollaborationActivity(row({
    activity_status: "cancelled",
    cancellation_phase: "activity",
    cancelled_at: "2026-11-01T10:00:00Z",
  }), "Eskişehir");
  assert.ok(planningCancellation && activityCancellation);
  assert.equal(getCollaborationActivityPresentation(planningCancellation).label, "Plan iptal edildi");
  assert.equal(getCollaborationActivityPresentation(planningCancellation).dateLabel, "Planlanan: 1 Kas 2026 · 10:00–12:00");
  assert.equal(getCollaborationActivityPresentation(activityCancellation).label, "Gerçekleşmedi / İptal");
  assert.equal(getCollaborationActivityPresentation(activityCancellation).tone, "red");
});

test("non-members fall back to the intent page and intent-only rows stay explicit", () => {
  const noRoomAccess = parseCollaborationActivity(row({ viewer_can_open_room: false }), "Eskişehir");
  assert.ok(noRoomAccess);
  assert.equal(getCollaborationActivityPresentation(noRoomAccess).href, `/activities/${INTENT_ID}`);

  const preparing = parseCollaborationActivity(row({
    plan_id: null,
    activity_title: null,
    activity_status: null,
    window_start: null,
    window_end: null,
    scheduled_start: null,
    scheduled_end: null,
    timezone: null,
    activity_location_name: null,
    meeting_point: null,
    activity_city: null,
    activity_district: null,
    viewer_can_open_room: false,
    event_resolution: "intent_only",
  }), "Eskişehir");
  assert.ok(preparing);
  assert.equal(preparing.title, "Eskişehir");
  assert.equal(getCollaborationActivityPresentation(preparing).label, "Etkinlik bağlantısı doğrulanamadı");
  assert.equal(getCollaborationActivityPresentation(preparing).tone, "red");
});

test("expired plans have a distinct truthful state", () => {
  const expired = parseCollaborationActivity(row({
    scheduled_start: null,
    scheduled_end: null,
    expired_at: "2026-10-09T12:00:00Z",
  }), "Eskişehir");
  assert.ok(expired);
  const presentation = getCollaborationActivityPresentation(expired, "2026-10-10T12:00:00Z");
  assert.equal(presentation.label, "Süresi doldu");
  assert.equal(presentation.tone, "slate");
});

test("passed target windows settle consistently when exact scheduling is incomplete", () => {
  const withoutExactSchedule = parseCollaborationActivity(row({
    scheduled_start: null,
    scheduled_end: null,
  }), "Eskişehir");
  const withoutExactEnd = parseCollaborationActivity(row({ scheduled_end: null }), "Eskişehir");
  assert.ok(withoutExactSchedule && withoutExactEnd);
  assert.equal(getCollaborationActivityPresentation(withoutExactSchedule, "2026-11-02T12:00:00Z").label, "Sonuç bekleniyor");
  assert.equal(getCollaborationActivityPresentation(withoutExactEnd, "2026-11-02T12:00:00Z").label, "Sonuç bekleniyor");
});

test("malformed or contradictory event projections fail closed", () => {
  assert.throws(() => parseCollaborationActivity(row({ event_resolution: "unknown" }), "Eskişehir"), /doğrulanamadı|eksik/);
  assert.throws(() => parseCollaborationActivity(row({ plan_id: null }), "Eskişehir"), /Etkinlik planı eksik/);
  assert.throws(() => parseCollaborationActivity(row({ activity_title: "" }), "Eskişehir"), /Etkinlik planı eksik/);
  assert.throws(() => parseCollaborationActivity(row({ viewer_can_open_room: "yes" }), "Eskişehir"), /Etkinlik özeti eksik/);
});

test("web chat and inbox use the v170 projections without an added event request", () => {
  const page = readFileSync(new URL("../src/app/collaboration-chat/[suggestionId]/page.tsx", import.meta.url), "utf8");
  const chat = readFileSync(new URL("../src/components/collaboration/CollaborationChat.tsx", import.meta.url), "utf8");
  const inboxPage = readFileSync(new URL("../src/app/collaboration-suggestions/page.tsx", import.meta.url), "utf8");
  const inbox = readFileSync(new URL("../src/components/collaboration/CollaborationInbox.tsx", import.meta.url), "utf8");

  assert.match(page, /get_personal_intent_collaboration_plan_v170/);
  assert.match(chat, /get_personal_intent_collaboration_plan_v170/);
  assert.doesNotMatch(chat, /get_personal_intent_collaboration_plan_v35/);
  assert.match(chat, /setRefreshError/);
  assert.match(chat, /Eski etkinlik durumunu göstermiyoruz/);
  assert.match(inboxPage, /get_my_personal_intent_collaboration_chats_v170/);
  assert.doesNotMatch(inboxPage, /get_my_personal_intent_collaboration_chats_v34/);
  assert.match(inbox, /presentation\.label/);
  assert.match(inbox, /chat\.last_message_body/);
  assert.doesNotMatch(chat + inboxPage, /fetchMobileIntentDetail|fetchMobileActivityRoom/);
  assert.match(inboxPage, /value\.seed_id === null && value\.canonical_target_id === null/);
  assert.match(page, /const canonicalResult = chat\.seed_id/);
  assert.match(page, /Collaboration activity summary unavailable/);
});
