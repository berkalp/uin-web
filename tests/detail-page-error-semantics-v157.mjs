import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function assertFailurePrecedesMissing(content, failureMarker, missingMarker) {
  const failure = content.indexOf(failureMarker);
  const missing = content.indexOf(missingMarker, failure + failureMarker.length);
  assert.ok(failure >= 0, `${failureMarker} must exist`);
  assert.ok(missing > failure, `${missingMarker} must follow the read-error branch`);
  assert.match(content.slice(failure, missing), /return unavailable|PageDataUnavailable/);
  assert.doesNotMatch(content.slice(failure, missing), /notFound\(\)/);
}

test("detail routes distinguish failed reads from genuinely missing records", () => {
  const messages = source("src/app/messages/[conversationId]/page.tsx");
  const seed = source("src/app/seeds/[seedId]/page.tsx");
  const subject = source("src/app/seeds/subjects/[subjectId]/page.tsx");
  const plan = source("src/app/plans/[planId]/page.tsx");
  const profile = source("src/app/settings/profile/page.tsx");

  const messageFailure = messages.indexOf(
    "if (detailResponse.error || messagesResponse.error)",
  );
  const messageMissing = messages.indexOf("if (!detail)", messageFailure);
  const messageFailureBranch = messages.slice(messageFailure, messageMissing);
  assert.ok(messageFailure >= 0 && messageMissing > messageFailure);
  assert.match(messageFailureBranch, /error\?\.code === "P0002"[\s\S]*notFound\(\)/);
  assert.match(messageFailureBranch, /return unavailable/);
  assertFailurePrecedesMissing(seed, "if (initialReadError)", "if (!detail)");
  assertFailurePrecedesMissing(subject, "if (error)", "if (!data)");
  assertFailurePrecedesMissing(plan, "if (error)", "if (!data)");
  assertFailurePrecedesMissing(profile, "if (profileError)", "if (!profileData)");

  for (const content of [messages, seed, subject, plan, profile]) {
    assert.match(content, /PageDataUnavailable/);
  }
});

test("an absent auth session keeps anonymous and redirect behavior", () => {
  const pages = [
    source("src/app/messages/[conversationId]/page.tsx"),
    source("src/app/seeds/[seedId]/page.tsx"),
    source("src/app/seeds/subjects/[subjectId]/page.tsx"),
    source("src/app/plans/[planId]/page.tsx"),
    source("src/app/settings/profile/page.tsx"),
  ];

  for (const page of pages) {
    assert.match(page, /isAuthSessionMissingError/);
    assert.match(
      page,
      /if \(userError && !isAuthSessionMissingError\(userError\)\)/,
    );
  }

  assert.match(pages[0], /if \(!user\) redirect\("\/"\)/);
  assert.match(pages[3], /if \(!user\)[\s\S]*redirect\("\/"\)/);
  assert.match(pages[4], /if \(!user\)[\s\S]*redirect\("\/"\)/);
  assert.doesNotMatch(pages[1], /if \(!user\)[\s\S]*redirect/);
  assert.doesNotMatch(pages[2], /if \(!user\)[\s\S]*redirect/);
});

test("secondary detail reads fail closed instead of rendering partial defaults", () => {
  const seed = source("src/app/seeds/[seedId]/page.tsx");
  const subject = source("src/app/seeds/subjects/[subjectId]/page.tsx");
  const profile = source("src/app/settings/profile/page.tsx");

  assert.match(seed, /reactionResult\.error \?\? reminderResult\.error/);
  assert.match(seed, /if \(contextResult\.error\)[\s\S]*return unavailable/);
  assert.match(seed, /if \(catalogError\)[\s\S]*return unavailable/);
  assert.match(seed, /if \(canonicalResult\.error\)[\s\S]*return unavailable/);

  assert.match(subject, /if \(roleError\)[\s\S]*return unavailable/);
  assert.match(
    subject,
    /if \(placeResponse\.error \|\| seedTypesResponse\.error\)[\s\S]*return unavailable/,
  );

  assert.match(
    profile,
    /const relatedSettingsError =[\s\S]*presenceResult\.error[\s\S]*connectionsFamilyResult\.error[\s\S]*familyResponse\.error[\s\S]*publicFamilyResponse\.error/,
  );
  assert.match(profile, /if \(relatedSettingsError\)[\s\S]*return \([\s\S]*PageDataUnavailable/);
});

test("onboarding keeps deep-link context and blocks the form after a context read error", () => {
  const onboarding = source("src/app/onboarding/page.tsx");
  const targetError = onboarding.indexOf("if (result.error)");
  const targetAssignment = onboarding.indexOf("targetContext = result.data", targetError);
  const seedError = onboarding.indexOf(
    "if (contextResult.error || candidatesResult.error)",
  );
  const form = onboarding.indexOf("<IntentForm");

  assert.ok(targetError >= 0 && targetAssignment > targetError);
  assert.match(onboarding.slice(targetError, targetAssignment), /return unavailable/);
  assert.ok(seedError >= 0 && form > seedError);
  assert.match(onboarding.slice(seedError, form), /return unavailable/);
  assert.match(onboarding, /const retryHref = getRetryHref\(resolvedSearchParams\)/);
  assert.match(onboarding, /query\.append\(key, item\)/);
  assert.doesNotMatch(onboarding, /if \(!result\.error\) targetContext/);
});

test("retry UI performs a hard reload and does not issue recovery queries", () => {
  const unavailable = source("src/components/common/PageDataUnavailable.tsx");
  const messages = source("src/app/messages/[conversationId]/page.tsx");
  const onboarding = source("src/app/onboarding/page.tsx");

  assert.match(unavailable, /role="alert"/);
  assert.match(unavailable, /<a[\s\S]*href=\{retryHref\}[\s\S]*Yeniden dene/);
  assert.match(unavailable, /Eksik veya yanlış bilgi göstermemek için/);

  assert.equal((messages.match(/supabase\.rpc\(/g) ?? []).length, 2);
  assert.equal((onboarding.match(/supabase\.rpc\(/g) ?? []).length, 3);
});
