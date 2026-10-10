import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("collection pages do not turn malformed payloads into valid empty states", () => {
  const pages = [
    "src/app/archive/page.tsx",
    "src/app/connections/page.tsx",
    "src/app/friends/page.tsx",
    "src/app/intent-drafts/page.tsx",
    "src/app/matches/page.tsx",
    "src/app/reputation/feedback/page.tsx",
  ];

  for (const path of pages) {
    const page = source(path);
    assert.match(page, /readFailed = Boolean\(error \|\| !Array\.isArray\(data\)\)/, path);
    assert.match(page, /readFailed \? \[\] :/, path);
  }

  const matches = source("src/app/matches/page.tsx");
  assert.match(matches, /readFailed \? "Aktif eşleşme sayısı yüklenemedi"/);
});

test("decision center rejects incomplete sources before deriving counters", () => {
  const inbox = source("src/app/inbox/page.tsx");

  assert.match(inbox, /requestPayloadValid = Array\.isArray\(requestResponse\.data\)/);
  assert.match(inbox, /invitationPayloadValid = Array\.isArray\(intentInvitationResponse\.data\)/);
  assert.match(inbox, /joinRequestPayloadValid = Array\.isArray\(joinRequestResponse\.data\)/);
  assert.match(inbox, /managedProfilePayloadValid = Array\.isArray\(managedProfileResponse\.data\)/);
  assert.match(inbox, /ownedIntentPayloadValid = Array\.isArray\(activeOwnedIntentResponse\.data\)/);
  assert.match(inbox, /!requestPayloadValid \|\|[\s\S]*!ownedIntentPayloadValid/);
  assert.match(inbox, /requestResponse\.error \|\| !requestPayloadValid \? null/);
  assert.match(inbox, /managedProfileResponse\.error \|\| !managedProfilePayloadValid/);
});

test("message pages validate summaries, plans, thread details, and messages", () => {
  const list = source("src/app/messages/page.tsx");
  const detail = source("src/app/messages/[conversationId]/page.tsx");

  assert.match(list, /directResult\.data\.every\(isDirectConversationSummary\)/);
  assert.match(list, /roomResult\.data\.every\(isRoomConversationSummary\)/);
  assert.match(list, /planResult\.data\.every\(isRoomConversationPlan\)/);
  assert.match(list, /initialLoadFailed=\{directLoadFailed\}/);
  assert.match(list, /const roomLoadFailed = Boolean\(roomSummaryLoadFailed \|\| planLoadFailed\)/);

  const malformedGuard = detail.indexOf("!Array.isArray(detailResponse.data)");
  const missingGuard = detail.indexOf("detailResponse.data.length === 0");
  assert.ok(malformedGuard >= 0 && missingGuard > malformedGuard);
  assert.match(detail, /detailResponse\.data\.length !== 1/);
  assert.match(detail, /messagesResponse\.data\.every\(isConversationMessage\)/);
});

test("detail routes distinguish read failures from missing records", () => {
  const person = source("src/app/people/[userId]/page.tsx");
  const draft = source("src/app/intent-drafts/[draftId]/page.tsx");
  const feedback = source("src/app/reputation/feedback/[planId]/[targetUserId]/page.tsx");

  assert.match(person, /if\(error\).*PageDataUnavailable/);
  assert.match(person, /if\(data===null\)notFound\(\)/);

  assert.match(draft, /if \(draftResult\.error \|\| locationsResult\.error\)[\s\S]{0,80}return unavailable/);
  assert.match(draft, /if \(draftResult\.data === null\)[\s\S]{0,50}notFound\(\)/);
  assert.match(draft, /locationsResult\.data\.every\(isIntentDraftLocation\)/);
  assert.match(draft, /value\.city === null \|\| typeof value\.city === "string"/);
  assert.match(draft, /value\.district === null \|\| typeof value\.district === "string"/);
  assert.match(draft, /city: location\.city \?\? ""/);
  assert.match(draft, /district: location\.district \?\? ""/);

  const feedbackError = feedback.indexOf("if (error)");
  const feedbackMissing = feedback.indexOf("if (!data)", feedbackError);
  assert.ok(feedbackError >= 0 && feedbackMissing > feedbackError);
  assert.match(feedback.slice(feedbackError, feedbackMissing), /PageDataUnavailable/);
  assert.match(feedback, /if \(!isFeedbackFormData\(data\)\)/);
});

test("sports catalogue and intent editing fail closed on incomplete dependencies", () => {
  const sports = source("src/app/sports/page.tsx");
  const leagues = source("src/app/sports/[sportSlug]/page.tsx");
  const edit = source("src/app/intents/[intentId]/edit/page.tsx");

  assert.match(sports, /Array\.isArray\(data\)&&data\.every\(isSportBranchCard\)/);
  assert.match(sports, /readFailed\?<p/);
  assert.match(leagues, /Array\.isArray\(data\)&&data\.every\(isSportLeagueCard\)/);
  assert.match(leagues, /readFailed\?<p/);

  assert.match(edit, /if \(linkedPlanError\)[\s\S]{0,500}return unavailable/);
  assert.match(edit, /categoryResult\.data\.every\(isCategoryRow\)/);
  assert.match(edit, /activityResult\.data\.every\(isActivityRow\)/);
  assert.match(edit, /locationResult\.data\.every\(isLocationRow\)/);
  assert.match(edit, /value\.city === null \|\| typeof value\.city === "string"/);
  assert.match(edit, /value\.district === null \|\| typeof value\.district === "string"/);
  assert.match(edit, /typeof acceptedParticipantResult\.count !== "number"/);
  assert.match(edit, /fixtureResult\.data\.every\(isSportFixtureOption\)/);
});

test("catalogue entry and subject detail pages reject malformed success payloads", () => {
  const ideas = source("src/app/ideas/page.tsx");
  const explore = source("src/app/seeds/explore/page.tsx");
  const create = source("src/app/seeds/new/page.tsx");
  const seed = source("src/app/seeds/[seedId]/page.tsx");
  const loved = source("src/app/loved/[source]/[id]/page.tsx");

  assert.match(ideas, /typeResult\.data\.every\(isContentType\)/);
  assert.match(ideas, /seedTypeResult\.data\.every\(isSeedType\)/);
  assert.match(explore, /Array\.isArray\(data\) && data\.every\(isSeedType\)/);
  assert.match(create, /Array\.isArray\(data\) && data\.every\(isSeedTypeOption\)/);
  assert.match(create, /readFailed \? "Seed Types could not be loaded"/);

  assert.match(seed, /if \(detailResult\.data === null\)[\s\S]{0,50}notFound\(\)/);
  assert.match(seed, /if \(!detail\)[\s\S]{0,150}return unavailable/);
  assert.match(seed, /reactionContexts\.length !== reactionResult\.data\.length/);

  assert.match(loved, /if\(!isLovedDetail\(data,source\)\)/);
  assert.match(loved, /row\.people\.every\(isLovedPerson\)/);
});
