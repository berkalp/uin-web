import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("discover distinguishes a broken session read and skips the hidden archive in map views", () => {
  const page = source("src/app/discover/page.tsx");

  assert.match(page, /error: userError/);
  assert.match(page, /userError && !isAuthSessionMissingError\(userError\)[\s\S]{0,450}<PageDataUnavailable/);
  assert.match(
    page,
    /view === "cards"\s*\? runDiscoverSearch\(80, 0, "history"\)\s*:\s*Promise\.resolve\(\{ data: \[\], error: null \}\)/,
  );
});

test("friend and connection pages reject incomplete people rows before deriving counts", () => {
  for (const path of ["src/app/friends/page.tsx", "src/app/connections/page.tsx"]) {
    const page = source(path);
    assert.match(page, /error: userError/);
    assert.match(page, /userError && !isAuthSessionMissingError\(userError\)[\s\S]{0,450}<PageDataUnavailable/);
    assert.match(page, /const incompleteRows = !readFailed && !\(data as unknown\[\]\)\.every\(is(?:Friendship|Connection)Row\)/);
    assert.match(page, /readFailed = readFailed \|\| incompleteRows/);
    assert.match(page, /readFailed \? \[\] :/);
  }
});

test("message center and live refreshes keep verified data when a refresh is incomplete", () => {
  const page = source("src/app/messages/page.tsx");
  const list = source("src/components/messages/DirectConversationList.tsx");
  const thread = source("src/components/messages/DirectConversationThread.tsx");

  assert.match(page, /userError && !isAuthSessionMissingError\(userError\)[\s\S]{0,450}<PageDataUnavailable/);
  assert.match(list, /!Array\.isArray\(data\) \|\| !data\.every\(isConversationSummary\)/);
  assert.doesNotMatch(list, /const next = \(data \?\? \[\]\)/);
  assert.match(list, /if \(initialLoadFailed \|\| !initialConversations\.every\(isConversationSummary\)\)[\s\S]{0,350}loadFailed: true/);
  assert.match(list, /\.\.\.listState,[\s\S]{0,120}loadFailed: true,[\s\S]{0,180}previousInitialConversations: initialConversations/);
  assert.match(list, /Son doğrulanmış liste ekranda tutuluyor/);
  assert.match(list, /onClick=\{\(\) => void refreshConversations\(\)\}/);
  assert.match(list, /const requestGeneration = \+\+refreshGenerationRef\.current/);
  assert.match(list, /requestGeneration !== refreshGenerationRef\.current/);
  assert.match(
    list,
    /isConversationSnapshotAtLeastAsFresh\(\s*current\.conversations,\s*next\s*\)/,
  );
  assert.match(list, /hasClientSnapshotSinceServer/);
  assert.match(list, /canServerSnapshotReplaceClient\(listState\.conversations, initialConversations\)/);
  assert.match(list, /nextTimestamp > currentTimestamp \|\| sameConversation\(conversation, next\)/);
  assert.match(list, /requestServerGeneration === current\.serverGeneration/);
  assert.match(thread, /!Array\.isArray\(data\) \|\| !data\.every\(isConversationMessage\)/);
  assert.doesNotMatch(thread, /const next = \(data \?\? \[\]\)/);
  assert.match(thread, /The previous verified conversation is still shown/);
  assert.match(thread, /onClick=\{\(\) => void refreshMessages\(\)\}/);
  assert.match(thread, /const requestGeneration = \+\+refreshGenerationRef\.current/);
  assert.match(thread, /requestGeneration !== refreshGenerationRef\.current/);
  assert.match(thread, /snapshotState\.conversationId !== detail\.conversation_id/);
  assert.match(thread, /snapshotState\.conversationId !== detail\.conversation_id[\s\S]{0,420}serverGeneration: snapshotState\.serverGeneration \+ 1/);
  assert.match(thread, /hasClientSnapshotSinceServer/);
  assert.match(thread, /const comparison = compareMessageSnapshots\(snapshotState\.liveMessages, messages\)/);
  assert.match(thread, /comparison > 0 \|\| sameMessageSnapshot\(snapshotState\.liveMessages, messages\)/);
  assert.match(thread, /requestServerGeneration !== current\.serverGeneration/);
});

test("settings pages no longer replace unreadable privacy or professional data with empty records", () => {
  const privacy = source("src/app/settings/privacy/page.tsx");
  const professional = source("src/app/settings/professional/page.tsx");

  assert.match(privacy, /!Array\.isArray\(data\) \|\| !data\.every\(isDiscoveryControl\)/);
  assert.match(privacy, /const controls = readFailed \? \[\] : data as/);
  assert.match(privacy, /\{readFailed \? \(/);

  assert.match(professional, /const readFailed = Boolean\(error \|\| !isProfessionalProfile\(data\)\)/);
  assert.match(professional, /const profile = readFailed \? null : data/);
  assert.doesNotMatch(professional, /data \?\? \{[\s\S]{0,120}status: "unverified"/);
  assert.match(professional, /mevcut kayıtlar gizleniyor/);
});

test("weather reads start only when an event card approaches the viewport", () => {
  for (const path of [
    "src/components/weather/PlanWeatherBadges.tsx",
    "src/components/weather/IntentWeatherBadge.tsx",
  ]) {
    const component = source(path);
    assert.match(component, /new IntersectionObserver\(/, path);
    assert.match(component, /rootMargin: "320px 0px"/, path);
    assert.match(component, /if \(!shouldLoad\) return/, path);
    assert.match(component, /ref=\{visibilityRef\}/, path);
  }
});

test("notification refresh marks the unread count unknown after a failed read", () => {
  const bell = source("src/components/notifications/NotificationBellButton.tsx");

  assert.match(bell, /if \(error\) \{\s*setCount\(null\);\s*return;/);
  assert.match(bell, /error: userError/);
  assert.match(bell, /if \(userError\) \{\s*setCount\(null\);\s*return;/);
});
