import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../src/app/intentions/[targetId]/page.tsx", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL(
    "../supabase/migrations/202610100002_common_intent_public_detail_v161.sql",
    import.meta.url,
  ),
  "utf8",
);

test("common card detail reads only the requested target through the canonical projection", () => {
  assert.match(page, /get_uin_catalogue_for_targets_v123/);
  assert.match(page, /p_target_ids:\[targetId\]/);
  assert.doesNotMatch(page, /get_common_intent_cards_v38/);
  assert.match(page, /get_uin_card_people_v81/);
  assert.match(page, /get_uin_card_events_v81/);
  assert.doesNotMatch(page, /get_uin_card_people_v80/);
  assert.doesNotMatch(page, /get_uin_card_events_v80/);
});

test("public page context checks admin membership without rejecting non-admin viewers", () => {
  assert.match(migration, /'is_admin', public\.is_admin\(\)/);
  assert.doesNotMatch(migration, /get_admin_role\s*\(/);
  assert.match(
    migration,
    /grant execute on function public\.get_common_target_page_context_v41\(uuid\)[\s\S]*to anon, authenticated/,
  );
});

test("common card detail keeps fail-closed behavior for every required projection", () => {
  assert.match(
    page,
    /initialReadError=socialResult\.error\|\|activityResult\.error\|\|reviewResult\.error\|\|pageContextResult\.error\|\|sportContextResult\.error\|\|authReadError/,
  );
  assert.match(page, /if\(initialReadError\).*CommonIntentUnavailable/s);
  assert.match(page, /cardResult\.data\.length!==1\|\|!cardRow\(cardResult\.data\[0\],targetId\)/);
  assert.match(page, /while\(rows\.length<total\)/);
  assert.match(page, /body:text\(row\.experience_text\)\?\?text\(row\.body\)/);
  assert.match(page, /socialCount=\{Number\(card\.active_event_count\)\}/);
  assert.doesNotMatch(page, /intent_people_count\|\|0/);
});
