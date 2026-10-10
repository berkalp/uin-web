import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("seed catalogue page and every mutation require a verified staff session", () => {
  const page = source("src/app/admin/seed-catalogue/page.tsx");
  const actions = source("src/app/admin/seed-catalogue/actions.ts");

  assert.match(page, /import \{ requireAdmin \} from "@\/utils\/admin"/);
  assert.match(page, /const \{ supabase \} = await requireAdmin\(\)/);
  assert.doesNotMatch(page, /createClient\(/);

  const actionNames = [
    "reviewSeedCatalogueItem",
    "deleteSeedCatalogueItem",
    "updateSeedCatalogueItem",
    "createSeedCatalogueItem",
  ];
  for (const [index, actionName] of actionNames.entries()) {
    const start = actions.indexOf(`export async function ${actionName}`);
    const end =
      index + 1 < actionNames.length
        ? actions.indexOf(`export async function ${actionNames[index + 1]}`, start)
        : actions.length;
    assert.notEqual(start, -1, `${actionName} must remain exported`);
    const body = actions.slice(start, end);
    assert.match(body, /await requireAdmin\(\)/, `${actionName} must authorize before its RPC`);
    assert.ok(
      body.indexOf("await requireAdmin()") < body.indexOf(".rpc("),
      `${actionName} must authorize before its RPC`,
    );
  }
});

test("anonymous public requests skip server and client authentication startup", () => {
  const layout = source("src/app/layout.tsx");
  const proxy = source("src/proxy.ts");
  const listener = source("src/components/notifications/ReminderToastListener.tsx");

  assert.match(layout, /const hasAuthSession = cookieStore/);
  assert.match(layout, /hasAuthSession\s*\? getViewerContext\(\)/);
  assert.match(layout, /<ReminderToastListener enabled=\{Boolean\(viewerContext\.user\)\}/);
  assert.match(listener, /if \(!enabled\) return;/);
  assert.match(source("src/components/navigation/AppNavigation.tsx"), /if \(!hasAuthSession\) return null/);

  const cookieGuard = proxy.indexOf("if (!hasAuthSession)");
  const clientCreation = proxy.indexOf("createServerClient(");
  assert.ok(cookieGuard >= 0 && cookieGuard < clientCreation);
});

test("navigation and list pages do not turn failed reads into reassuring zeroes", () => {
  const navigation = source("src/components/navigation/AppNavigation.tsx");
  const bell = source("src/components/notifications/NotificationBellButton.tsx");
  const friends = source("src/app/friends/page.tsx");
  const notifications = source("src/app/notifications/page.tsx");
  const connections = source("src/app/connections/page.tsx");

  assert.match(navigation, /notifications\.error[\s\S]*\? null/);
  assert.match(bell, /initialUnreadCount: number \| null/);
  assert.match(bell, /count == null[\s\S]*sayısı şu anda bilinmiyor/);
  assert.match(friends, /<WebCardLayoutPicker[\s\S]*\{!readFailed && \(/);
  assert.match(notifications, /\{!error && \([\s\S]*\{unreadCount\} okunmamış/);
  assert.match(connections, /\{readFailed \? "—" : counts\[view\]\}/);
});

test("event presentation reads use bounded batches with a lossless compatibility fallback", () => {
  for (const relativePath of [
    "src/app/discover/page.tsx",
    "src/app/timeline/page.tsx",
    "src/app/u/[username]/page.tsx",
  ]) {
    const content = source(relativePath);
    const batchCall = content.indexOf('supabase.rpc("get_uin_event_presentations_v150"');
    const fallbackCall = content.indexOf('supabase.rpc("get_uin_event_presentation_v86"', batchCall);
    assert.ok(batchCall >= 0, `${relativePath} must use the batch RPC`);
    assert.ok(fallbackCall > batchCall, `${relativePath} must preserve the exact fallback`);
    assert.match(content.slice(batchCall - 500, batchCall), /slice\([^\n]*100/);
  }
});

test("restriction verification failures fail closed instead of admitting the session", () => {
  const proxy = source("src/proxy.ts");
  const page = source("src/app/account-restricted/page.tsx");
  const errorBranch = proxy.slice(
    proxy.indexOf("if (restrictionError)"),
    proxy.indexOf("if (\n    hasAccountRestriction", proxy.indexOf("if (restrictionError)")),
  );

  assert.match(errorBranch, /redirectUrl\.pathname\s*=\s*"\/account-restricted"/);
  assert.match(errorBranch, /verification=unavailable/);
  assert.doesNotMatch(errorBranch, /return response/);
  assert.match(page, /restriction \? \(/);
  assert.match(page, /Hesap durumu doğrulanamadı/);
  assert.match(page, /Yeniden dene/);
});

test("failed profile privacy reads do not expose a partially authorized profile", () => {
  const profile = source("src/app/u/[username]/page.tsx");

  for (const marker of ["hiddenResourceError", "minorContextError"]) {
    const start = profile.indexOf(`if (${marker})`);
    assert.notEqual(start, -1, `${marker} branch must exist`);
    assert.match(
      profile.slice(start, start + 500),
      /return <ProfileDataUnavailable/,
      `${marker} must fail closed`,
    );
  }

  assert.match(
    profile,
    /if \(\s*!minorContextData[\s\S]{0,400}return <ProfileDataUnavailable/,
  );
  assert.match(
    profile,
    /Promise\.all\(\[\s*supabase\.rpc\("get_profile_hidden_resource_keys"[\s\S]{0,400}supabase\.rpc\("get_public_minor_profile_context"/,
  );
});

test("public profile overlaps complete reads and batches bounded plan lookups", () => {
  const profile = source("src/app/u/[username]/page.tsx");
  const launchStart = profile.indexOf("const visibleSeedResultPromise");
  const firstConsumerAwait = profile.indexOf(
    "const [visibleSeedResult, displayOrderResult] = await",
    launchStart,
  );

  assert.ok(launchStart >= 0 && firstConsumerAwait > launchStart);
  for (const marker of [
    "const publicPreferencesResultPromise",
    "const familyResultPromise",
    "const planMetadataResultPromise",
    "const profileDisplayTitlesPromise",
    "const profilePeopleResponsePromise",
    "const presentationIntentIdsPromise",
  ]) {
    const position = profile.indexOf(marker, launchStart);
    assert.ok(
      position > launchStart && position < firstConsumerAwait,
      `${marker} must start before the first independent result is consumed`,
    );
  }

  assert.match(profile, /const planIdBatches = toBatches\(planIds\)/);
  for (const rpc of [
    "get_visible_plan_source_intents",
    "get_visible_plan_card_metadata",
    "get_visible_public_plan_activity_locations",
  ]) {
    assert.match(
      profile,
      new RegExp(`planIdBatches\\.map\\(\\(batchPlanIds\\)[\\s\\S]{0,180}${rpc}[\\s\\S]{0,120}p_plan_ids: batchPlanIds`),
      `${rpc} must stay inside the database's 100-id boundary`,
    );
  }

  assert.doesNotMatch(profile, /get_public_profile_community_memberships/);
  assert.doesNotMatch(profile, /plan_visibility \?\? "public"/);
  assert.doesNotMatch(profile, /const missingActivityPeople/);
  assert.doesNotMatch(profile, /const missingPlanSourceIntent/);
  assert.match(profile, /const missingSignedPlanMedia =/);
  assert.match(profile, /missingSignedPlanMedia \|\|/);
  assert.match(profile, /const requiredPlanDetailIds = planIds\.filter/);
  assert.match(profile, /metadata\?\.plan_visibility \?\? "private"/);
  assert.match(profile, /metadata\?\.recruitment_status \?\? "closed"/);
  assert.match(
    profile,
    /const planVisibility = metadata \? metadata\.plan_visibility : "public"/,
  );
  assert.match(
    profile,
    /ownerData\(metadata, activity\.relationship === "host"\)/,
  );
  assert.match(
    profile,
    /const secondaryReadErrors =[\s\S]*if \(secondaryReadErrors\.length > 0 \|\| secondaryPayloadIncomplete\)[\s\S]*return <ProfileDataUnavailable/,
  );
});

test("visible plan media uses bucket-level signed URL batches", () => {
  const visibility = source("src/utils/planPresentationVisibility.ts");

  assert.match(visibility, /createSignedUrls\(uniquePaths, 60 \* 60\)/);
  assert.doesNotMatch(visibility, /\.createSignedUrl\(/);
  assert.match(visibility, /new Set\(paths\.filter/);
});

test("interactive detail reads always settle and offer a retry after an error", () => {
  const quickDetails = source("src/components/intentions/CommonIntentQuickDetails.tsx");
  const rooms = source("src/components/messages/RoomConversationList.tsx");

  assert.match(quickDetails, /catch[\s\S]*finally[\s\S]*setBusy\(false\)/);
  assert.match(quickDetails, /Tekrar dene/);
  assert.match(rooms, /loadFailed\?: boolean/);
  assert.match(rooms, /!loadFailed && activeConversations\.length === 0/);
  assert.match(rooms, /Yeniden dene/);
});

test("discover filters at the database boundary and does not fetch unused personal cards", () => {
  const discover = source("src/app/discover/page.tsx");
  const quickFilters = source("src/components/discover/DiscoverQuickFilters.tsx");

  assert.equal((discover.match(/p_scope: scope/g) ?? []).length, 3);
  assert.doesNotMatch(discover, /p_scope: "all"/);
  assert.doesNotMatch(discover, /get_common_intent_cards_v38/);
  assert.match(quickFilters, /count===null\?"—":count/);
});

test("discover fills eligibility pages before slicing and only exposes exact pagination facts", () => {
  const discover = source("src/app/discover/page.tsx");
  const scanStart = discover.indexOf("while (\n    needsEligibilityScan");
  const scanEnd = discover.indexOf("const eligibilityPageStart", scanStart);
  const scan = discover.slice(scanStart, scanEnd);

  assert.equal(
    /const ELIGIBILITY_SCAN_BATCH_SIZE = 60/.test(discover),
    true,
    "each database and eligibility read must stay bounded to the RPC's 60-row limit",
  );
  assert.ok(scanStart >= 0 && scanEnd > scanStart, "the bounded eligibility scan must exist");
  assert.match(scan, /matchingResults\.length < eligibilityLookaheadTarget/);
  assert.match(
    scan,
    /runDiscoverSearch\(\s*ELIGIBILITY_SCAN_BATCH_SIZE,\s*rawRowsScanned\s*\)/,
  );
  assert.match(scan, /enrichEligibilityRows\(uniqueBatchRows\)/);
  assert.match(
    discover,
    /async function enrichEligibilityRows[\s\S]*get_visible_intent_participant_eligibility/,
  );
  assert.match(
    discover,
    /const missingEligibility =[\s\S]*if \(missingEligibility\)[\s\S]*katılım uygunluğu doğrulanamadı/,
  );
  assert.match(scan, /rawRowsScanned >= rawSearchTotal/);
  assert.match(
    discover,
    /const hasEligibilityLookahead =[\s\S]*matchingResults\.length > page \* PAGE_SIZE/,
  );
  assert.match(
    discover,
    /const eligibleResults = needsEligibilityScan[\s\S]*matchingResults\.slice\(/,
  );
  assert.match(
    discover,
    /const selectedScopeTotal = eligibility === "all"[\s\S]*rawSearchExhausted && !eligibilityScanError[\s\S]*\? matchingResults\.length[\s\S]*: null/,
  );
  assert.match(discover, /const totalPages = totalCount === null\s*\? null/);
  assert.match(
    discover,
    /const hasNext = needsEligibilityScan\s*\? hasEligibilityLookahead/,
  );
});

test("navigation exposes decision flows without adding another archive request", () => {
  const navigation = source("src/components/navigation/AppNavigation.tsx");
  const header = source("src/components/timeline/TimelineHeader.tsx");
  const menu = source("src/components/navigation/UserAccountMenu.tsx");

  assert.doesNotMatch(navigation, /activeMatchCount=\{0\}|inboxCount=\{0\}/);
  for (const href of ["/inbox", "/messages", "/matches"]) {
    assert.match(header + menu, new RegExp(`href="${href}"`));
  }
  assert.doesNotMatch(menu, /get_my_archived_resource_keys/);
});

test("anonymous common-card actions ask for sign-in before opening an editor", () => {
  const upcoming = source("src/components/intentions/CommonTargetUpcomingList.tsx");
  assert.match(upcoming, /const signInHref=/);
  assert.match(upcoming, /const eventAction=viewerId\?/);
  assert.match(upcoming, /const wantAction=viewerId\?/);
});

test("settings and request reads hide incomplete collections instead of showing empty state", () => {
  const privacy = source("src/app/settings/privacy/page.tsx");
  const family = source("src/app/settings/family/page.tsx");
  const requests = source("src/app/requests/page.tsx");

  assert.match(privacy, /error \? null : controls\.filter/);
  assert.match(privacy, /ignoredCount \?\? "—"/);
  assert.match(family, /publicFamilyResponse\.error[\s\S]*\? null/);
  assert.match(family, /publicFamilyData \? \(/);
  assert.doesNotMatch(family, /accepted_relationships: \[\]/);
  assert.match(requests, /if \(requestError\)[\s\S]*return <RequestsUnavailable \/>/);
  assert.match(requests, /if \(relatedDataFailed\)[\s\S]*return <RequestsUnavailable \/>/);
});

test("the app has shared error and not-found states", () => {
  const error = source("src/app/error.tsx");
  const notFound = source("src/app/not-found.tsx");

  assert.match(error, /reset: \(\) => void/);
  assert.match(error, /Eksik bilgi göstermemek için/);
  assert.match(notFound, /Bu sayfa bulunamadı/);
});

test("discover does not silently hide a failed event archive read", () => {
  const discover = source("src/app/discover/page.tsx");

  assert.match(
    discover,
    /view === "cards" && archiveReadError[\s\S]*İptal olan ve süresi geçen etkinlikler şu anda yüklenemedi/,
  );
  assert.match(
    discover,
    /view === "cards" && !archiveReadError && archivedResults\.length > 0/,
  );
});

test("loved detail distinguishes read failure and people without public profiles", () => {
  const loved = source("src/app/loved/[source]/[id]/page.tsx");

  assert.match(loved, /if\(error\)[\s\S]*return unavailable/);
  assert.match(loved, /if\(!data\)notFound\(\)/);
  assert.doesNotMatch(loved, /href=\{person\.username\?[^\n]*:"#"\}/);
  assert.match(loved, /publicCount===null\?"Kişi sayısı bilinmiyor"/);
});

test("common-card pages fail closed when secondary reads are incomplete", () => {
  const page = source("src/app/intentions/[targetId]/page.tsx");
  const personal = source("src/app/intentions/[targetId]/personal/page.tsx");
  const unavailable = source("src/components/intentions/CommonIntentUnavailable.tsx");

  assert.match(page, /if\(cardResult\.error\)[\s\S]*CommonIntentUnavailable/);
  assert.match(page, /isAuthSessionMissingError\(authResult\.error\)/);
  assert.match(page, /const authReadError=/);
  assert.match(page, /const initialReadError=/);
  assert.match(page, /const presentationReadError=/);
  assert.match(page, /if\(ownDetailResult\?\.error\)/);
  assert.match(personal, /if\(targetResult\.error\|\|sportResult\.error\)/);
  assert.match(unavailable, /eksik göstermemek için içerik geçici olarak gizlendi/);
  assert.match(unavailable, /Yeniden dene/);
});
