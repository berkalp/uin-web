import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("timeline and experience collections fail closed on read or payload loss", () => {
  const timeline = source("src/app/timeline/page.tsx");
  const seeds = source("src/components/seeds/MySeedsContent.tsx");

  assert.match(timeline, /experienceData\.loadFailed[\s\S]{0,500}PageDataUnavailable/);
  assert.match(timeline, /const timelineReadFailed = Boolean\([\s\S]*!timelinePayloadsValid/);
  assert.match(timeline, /if \(timelineReadFailed\)[\s\S]{0,500}PageDataUnavailable/);
  assert.match(timeline, /const profileOverviewReadFailed = Boolean\([\s\S]*profilePreferencesResult\.error/);
  assert.match(timeline, /myTypesResult\.error \|\|[\s\S]*mySourcesResult\.error/);
  assert.match(timeline, /const timelineRetryHref =[\s\S]*retryQuery\.toString\(\)/);
  assert.match(timeline, /userError && !isAuthSessionMissingError\(userError\)/);
  assert.match(timeline, /loadMySeedsData\(\{searchParams:[\s\S]{0,100},user\}\)/);
  assert.match(timeline, /isFamilyCenterPayload\(familyCenterData\)/);
  assert.match(timeline, /isRecordArray\(ownedIntentResult\.data\)[\s\S]*isNullableString\(row\.start_date\)[\s\S]*isNullableString\(row\.end_date\)/);
  assert.match(timeline, /function isProfileReactionRow[\s\S]{0,1200}isNullableString\(value\.start_date\)[\s\S]*isNullableString\(value\.end_date\)/);
  assert.match(timeline, /isPersonalProfilePayload\(personalProfileResult\.data\)/);
  assert.match(timeline, /function isPersonalProfilePayload\(value: unknown\) \{[\s\S]{0,80}value === null/);
  assert.match(timeline, /planResult\.data\.every\(isTimelinePlanRow\)/);
  assert.match(timeline, /mutual_friends\.every\(isProfileMutualFriendRow\)/);
  assert.match(timeline, /typeof profileProfessionalResult\.data\.identity_verified !== "boolean"/);
  assert.match(timeline, /isCountLike\(profilePreferencesResult\.data\.shared_favorite_count\)/);

  assert.match(seeds, /let loadFailed = Boolean\([\s\S]*personalCardsResult\.error[\s\S]*ratingsResult\.error[\s\S]*presentationResult\.error/);
  assert.match(seeds, /const mySeedsPayloadValid =[\s\S]*every\(isSeedRecordRow\)/);
  assert.match(seeds, /const personalCardsPayloadValid =[\s\S]*every\(isPersonalIntentRow\)/);
  assert.match(seeds, /function isPersonalIntentRow[\s\S]{0,900}isNullableString\(value\.end_date\)[\s\S]*typeof value\.created_at === "string"/);
  assert.match(seeds, /const ratingsPayloadValid =[\s\S]*every\(isRatingRow\)/);
  assert.match(seeds, /const reactionPayloadValid =[\s\S]*every\(isReactionRow\)/);
  assert.match(seeds, /value\.friend_water_preview\.every\([\s\S]*typeof friend\.user_id === "string"/);
  assert.doesNotMatch(seeds, /supabase\.auth\.getUser\(\)/);
  assert.match(seeds, /supabase\.rpc\("is_admin"\)/);
  assert.doesNotMatch(seeds, /supabase\.rpc\("get_admin_role"\)/);
  assert.match(seeds, /if\(data\.loadFailed\)[\s\S]*Yeniden dene/);
});

test("decision pages never turn failed or malformed collections into zeroes", () => {
  const invitations = source("src/app/intent-invitations/page.tsx");
  const requests = source("src/app/join-requests/page.tsx");

  assert.match(invitations, /receivedReadFailed[\s\S]*pendingReceived = receivedReadFailed[\s\S]*\? null/);
  assert.match(invitations, /pendingReceived \?\? "—"/);
  assert.match(invitations, /pendingSent \?\? "—"/);
  assert.match(invitations, /role="alert"[\s\S]*Yeniden dene/);

  assert.match(requests, /const readFailed = Boolean\([\s\S]*!presentationPayloadValid/);
  assert.match(requests, /\{readFailed \? "—" : pendingReceived\.length\}/);
  assert.match(requests, /\{readFailed \? "—" : pendingSent\.length\}/);
  assert.match(requests, /\{readFailed \? "—" : history\.length\}/);
  assert.match(requests, /\{!readFailed && \(/);
});

test("deep-linked create and message flows distinguish missing rows from failed reads", () => {
  const onboarding = source("src/app/onboarding/page.tsx");
  const message = source("src/app/messages/new/page.tsx");

  const form = onboarding.indexOf("<IntentForm");
  const missingTarget = onboarding.indexOf("if (result.data === null) notFound()");
  const malformedTarget = onboarding.indexOf("if (!isCommonTargetContext(result.data))");
  const missingSeed = onboarding.indexOf("if (contextResult.data.length === 0) notFound()");
  const malformedSeed = onboarding.indexOf("!contextResult.data.every(isSeedGrowthContext)");
  assert.ok(missingTarget >= 0 && missingTarget < malformedTarget && malformedTarget < form);
  assert.ok(missingSeed >= 0 && missingSeed < malformedSeed && malformedSeed < form);
  assert.match(onboarding, /targetContext\.target_id !== requestedTargetId[\s\S]*return unavailable/);
  assert.match(onboarding, /seedContext\.seed_id !== requestedSeedId[\s\S]*return unavailable/);
  assert.match(onboarding, /!Array\.isArray\(contextResult\.data\)[\s\S]*!Array\.isArray\(candidatesResult\.data\)[\s\S]*return unavailable/);
  assert.match(onboarding, /candidatesResult\.data\.every\(isSeedGrowthCandidate\)/);

  const readFailure = message.indexOf("if (error)");
  const missing = message.indexOf("if (data.length === 0) notFound()", readFailure);
  assert.ok(readFailure >= 0 && missing > readFailure);
  assert.match(message.slice(readFailure, missing), /PageDataUnavailable/);
  assert.match(message, /if \(!Array\.isArray\(data\)\)[\s\S]*PageDataUnavailable/);
  assert.match(message, /data\.length !== 1 \|\| !isMessageTargetContext\(data\[0\]\)/);
  assert.match(message, /typeof value\.is_staff_target === "boolean"/);
  assert.match(message, /isNullableString\(value\.full_name\)[\s\S]*isNullableString\(value\.avatar_url\)/);
  assert.match(message, /userError && !isAuthSessionMissingError\(userError\)/);
  assert.match(message, /!userId \|\| !isValidUuid\(userId\)/);
});

test("notification route enrichment never replaces a valid stored route after a failed read", () => {
  const notifications = source("src/app/notifications/page.tsx");

  assert.match(notifications, /collaborationRouteReadFailed = true/);
  assert.match(notifications, /chatsError \|\|[\s\S]{0,80}!Array\.isArray\(chats\)/);
  assert.match(notifications, /data\.items\.every\(isNotificationRow\)/);
  assert.match(notifications, /isNotificationCount\(data\.total_count\)/);
  assert.match(notifications, /typeof value\.notification_type === "string"[\s\S]*typeof value\.is_read === "boolean"/);
  assert.match(notifications, /chats\.every\(isCollaborationChatRouteRow\)/);
  assert.match(
    notifications,
    /const actionUrl = !collaborationRouteReadFailed[\s\S]*: notification\.action_url/,
  );
  assert.match(notifications, /const error = queryError \?\?[\s\S]*Notification payload was incomplete/);
  assert.match(notifications, /userError && !isAuthSessionMissingError\(userError\)/);
  assert.match(notifications, /retryHref=\{pageHref\(requestedPage\)\}/);
});
