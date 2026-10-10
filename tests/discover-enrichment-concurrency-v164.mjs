import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const discover = readFileSync(
  new URL("../src/app/discover/page.tsx", import.meta.url),
  "utf8",
);

test("Discover starts independent card enrichments in one concurrent barrier", () => {
  const barrier = discover.match(
    /const \[\s*intentCommonTargetResponse,[\s\S]*?\] = await Promise\.all\(\[([\s\S]*?)\n  \]\);/,
  );

  assert.ok(barrier, "the enrichment Promise.all barrier must remain present");
  const body = barrier[1];

  for (const expectedRead of [
    "get_visible_intent_common_targets_v40",
    "loadEventDisplayTitles()",
    "get_visible_intent_reaction_context",
    "get_visible_intent_card_notes",
    "get_visible_discover_map_points",
    "get_intent_sport_cover_context",
    "get_visible_activity_people_batch",
    "get_my_visible_plan_lineage",
    "loadPrivatePresentations()",
    "loadPublicExperienceCovers()",
    "get_visible_public_plan_activity_locations",
    "loadPublicPlanContent()",
    "get_visible_intent_links",
  ]) {
    assert.match(body, new RegExp(expectedRead.replace(/[()]/g, "\\$&")));
  }
});

test("Discover signs public experience covers in one deduplicated storage batch", () => {
  assert.match(
    discover,
    /const storagePaths = Array\.from\([\s\S]*?new Set\([\s\S]*?createSignedUrls\(storagePaths, 60 \* 60\)/,
  );
  assert.doesNotMatch(discover, /\.createSignedUrl\(/);
});

test("presentation batches retain the exact per-resource fallback", () => {
  assert.match(
    discover,
    /presentationBatches\.map\([\s\S]*?get_uin_event_presentations_v150/,
  );
  assert.match(
    discover,
    /if \(batchReadError\)[\s\S]*?Promise\.all\([\s\S]*?resourceIds\.map[\s\S]*?get_uin_event_presentation_v86/,
  );
});

test("failed authoritative enrichment hides incomplete cards instead of showing empty data", () => {
  assert.match(
    discover,
    /const discoverEnrichmentError =[\s\S]*?eventPresentationLoad\.error[\s\S]*?activityPeopleError[\s\S]*?publicPlanContentLoad\.error[\s\S]*?intentLinksError/,
  );
  assert.match(discover, /fallbackError \?\?= result\.error/);
  assert.match(
    discover,
    /!filterReadError &&[\s\S]*?!discoverEnrichmentError &&[\s\S]*?<DiscoverIntentCard/,
  );
  assert.match(discover, /getRowsetReadError\([\s\S]*?!Array\.isArray|Array\.isArray\(data\)/);
});
