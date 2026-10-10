import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../src/app/collaboration-chat/[suggestionId]/page.tsx", import.meta.url),
  "utf8",
);

test("collaboration chat distinguishes a missing chat from unavailable transport", () => {
  assert.match(page, /if \(chatResult\.error\) \{[\s\S]*includes\("Tanışma sohbeti bulunamadı"\)\) notFound\(\);[\s\S]*throw new Error\("Sohbet yüklenemedi/);
  assert.match(page, /if \(chatResult\.data === null\) notFound\(\)/);
  assert.match(page, /if \(planResult\.error\) throw new Error\("Planlama bilgileri yüklenemedi/);
  assert.match(page, /if \(canonicalResult\.error\) throw new Error\("Kart bağlantısı yüklenemedi/);
  assert.match(page, /userError && !isAuthSessionMissingError\(userError\)/);
  assert.doesNotMatch(page, /chatResult\.error \|\| !chatResult\.data\) notFound/);
});

test("planning state must come from the successful plan read", () => {
  assert.doesNotMatch(page, /const EMPTY_PLAN/);
  assert.doesNotMatch(page, /if \(value === null/);
  assert.match(page, /const initialPlan = parsePlan\(planResult\.data\)/);
  assert.doesNotMatch(page, /planResult\.data \|\| \{ planning_creator_user_id/);
});

test("card context uses the bounded catalogue projection and validates every rendered metric", () => {
  assert.match(page, /get_uin_catalogue_for_targets_v123/);
  assert.doesNotMatch(page, /get_common_intent_cards_v38/);
  assert.doesNotMatch(page, /get_uin_card_summary_v(?:81|106)/);
  assert.match(page, /cards\.error \|\| profile\.error \|\| ratings\.error \|\| social\.error \|\| people\.error/);
  for (const result of ["cards", "ratings", "social"]) {
    assert.match(page, new RegExp(`!Array\\.isArray\\(${result}\\.data\\) \\|\\| ${result}\\.data\\.length !== 1`));
  }
  assert.match(page, /assertTargetRow\(rating, targetId/);
  assert.match(page, /assertTargetRow\(cardSocial, targetId/);
  assert.match(page, /readFiniteMetric\(card\.intent_people_count/);
  assert.match(page, /readFiniteMetric\(card\.experience_people_count/);
  assert.match(page, /readFiniteMetric\(card\.active_event_count/);
  assert.match(page, /readFiniteMetric\(rating\.rating_count/);
  assert.match(page, /readFiniteMetric\(cardSocial\.follower_count/);
  assert.match(page, /contentTypeResult\.error \|\| !isRecord\(contentTypeResult\.data\)/);
  assert.match(page, /if \(!validPeople\) throw new Error\("Kartın kişi listesi eksik/);
});

test("optional card enrichment cannot make a verified chat unavailable", () => {
  const component = readFileSync(
    new URL("../src/components/collaboration/CollaborationChat.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /try \{[\s\S]*Collaboration card context unavailable[\s\S]*cardContextUnavailable = true/);
  assert.match(page, /cardContextUnavailable=\{cardContextUnavailable\}/);
  assert.match(component, /cardContextUnavailable && <section role="alert"/);
  assert.match(component, /Kütüphane kartı bilgileri şu anda doğrulanamadı/);
});

test("collaboration card context never invents zeroes or generic labels after incomplete reads", () => {
  assert.doesNotMatch(page, /Number\(stats\?\.(?:wanting|done|active) \|\| 0\)/);
  assert.doesNotMatch(page, /Number\(rating\?\.rating_count \|\| 0\)/);
  assert.doesNotMatch(page, /Number\(cardSocial\?\.follower_count \|\| 0\)/);
  assert.doesNotMatch(page, /typeLabel: contentType\?\.label \|\| "Kütüphane kartı"/);
  assert.doesNotMatch(page, /person\.full_name \|\| person\.username \|\| "UIN üyesi"/);
});
