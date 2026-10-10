import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("shared inbox navigation exposes six truthful destinations without invented counts", () => {
  const navigation = source("src/components/inbox/InboxSectionNav.tsx");

  for (const label of [
    "Tümü",
    "Sohbetler",
    "İstekler",
    "Etkinlikler",
    "Takip Ettiğim Kartlardan",
    "UIN Ekibinden",
  ]) {
    assert.match(navigation, new RegExp(`label: "${label}"`));
  }

  assert.match(navigation, /href: "\/notifications"[\s\S]{0,100}Tüm bildirim akışı/);
  assert.match(navigation, /\/collaboration-suggestions#sohbetler/);
  assert.match(navigation, /\/inbox#istekler/);
  assert.match(navigation, /\/messages\?section=activities#etkinlikler/);
  assert.match(navigation, /\/notifications\?section=cards#kart-gelismeleri/);
  assert.match(navigation, /\/messages\?section=staff#uin-ekibinden/);
  assert.doesNotMatch(navigation, /count|sayaç/i);
});

test("notification feed groups existing payload without another data request", () => {
  const notifications = source("src/app/notifications/page.tsx");

  assert.match(notifications, /function isActivityUpdateNotification/);
  assert.match(notifications, /isCardUpdateNotification\(notification\.notification_type\)/);
  assert.match(notifications, /id: "etkinlik-gelismeleri"/);
  assert.match(notifications, /id: "kart-gelismeleri"/);
  assert.match(notifications, /id: "diger-gelismeler"/);
  assert.equal(
    (notifications.match(/"get_my_update_notifications_page"/g) ?? []).length,
    1,
  );
});

test("event rooms reuse loaded plan statuses and keep terminal rooms in a closed archive", () => {
  const page = source("src/app/messages/page.tsx");
  const rooms = source("src/components/messages/RoomConversationList.tsx");

  assert.match(page, /summaries=\{roomSummaries\}/);
  assert.match(page, /plans=\{plans\}/);
  assert.match(
    page,
    /\.select\("id, title, creation_mode, status, planned_at, scheduled_start, scheduled_end, completed_at, cancelled_at, expired_at, window_end, timezone"\)/,
  );
  assert.match(page, /isNullableString\(row\.scheduled_start\)/);
  assert.match(page, /isNullableString\(row\.scheduled_end\)/);
  assert.match(page, /isNullableString\(row\.completed_at\)/);
  assert.match(page, /isNullableString\(row\.cancelled_at\)/);
  assert.match(rooms, /statusPresentation: getRoomConversationStatusPresentation\(entry\.plan\)/);
  assert.match(rooms, /const activeConversations = conversations\.filter[\s\S]{0,140}!ARCHIVED_ROOM_KINDS\.has\(entry\.statusPresentation\.kind\)/);
  assert.match(rooms, /const archivedConversations = conversations\.filter[\s\S]{0,140}ARCHIVED_ROOM_KINDS\.has\(entry\.statusPresentation\.kind\)/);
  assert.match(rooms, /<details[\s\S]{0,120}id="etkinlik-arsivi"/);
  assert.doesNotMatch(rooms, /<details[^>]*\sopen(?:=|\s|>)/);
  assert.match(rooms, /STALE_SCHEDULED_ROOM_STATUSES[\s\S]{0,180}"planned"[\s\S]{0,180}"active"/);
  assert.match(rooms, /nowTimestamp > scheduledEnd[\s\S]{0,180}status: "awaiting_result"/);
  assert.match(rooms, /ARCHIVED_ROOM_KINDS[\s\S]{0,180}"awaiting_result"[\s\S]{0,180}"expired"[\s\S]{0,180}"completed"[\s\S]{0,180}"cancelled"/);
  assert.match(rooms, /plan\.cancelled_at[\s\S]{0,180}plan\.completed_at[\s\S]{0,180}plan\.expired_at/);
});

test("UIN team badge uses the member-side granted marker", () => {
  const direct = source("src/components/messages/DirectConversationList.tsx");

  assert.match(direct, /id="uin-ekibinden"/);
  assert.match(direct, /viewer_access_kind === "granted"[\s\S]{0,180}UIN EKİBİ/);
  assert.match(direct, /viewer_access_kind === "staff"[\s\S]{0,180}YÖNETİM KANALI/);
});
