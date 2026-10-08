import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("category count failures never become successful zero counters", () => {
  const source = read("src/app/api/ideas/category-counts/route.ts");
  assert.match(source, /get_uin_category_counts_v129/);
  assert.match(source, /status\s*:\s*503/);
  assert.doesNotMatch(source, /result\.error\s*\?\s*0/);
  assert.doesNotMatch(source, /placeResult\.data[^\n]*\|\|\s*0/);
});

test("category cards fail closed when a requested summary is absent", () => {
  const source = read("src/app/api/ideas/category-cards/route.ts");
  assert.match(source, /missingIds/);
  assert.match(source, /if\s*\(missingIds\.length\)/);
  assert.match(source, /status\s*:\s*503/);
  assert.doesNotMatch(source, /cardByTarget\.get\(id\)\s*\|\|\s*\{[^}]*intent_people_count\s*:\s*0/s);
});

test("personal scopes use canonical direct membership and keep the light read light", () => {
  const source = read("src/app/api/ideas/scopes/route.ts");
  assert.match(source, /resolve_uin_card_targets_v143/);
  assert.match(source, /type_id/);
  assert.match(source, /missingIds/);
  assert.match(source, /if\s*\(missingIds\.length\)/);
  assert.doesNotMatch(source, /cardByTarget\.get\(id\)\s*\|\|\s*\{\}/);

  const lightReturn = source.indexOf("if (!includeCards)");
  const heavyCatalogueRead = source.indexOf('db.rpc("get_uin_catalogue_for_targets_v123"');
  assert.ok(lightReturn >= 0, "cards=0 needs an early response");
  assert.ok(heavyCatalogueRead > lightReturn, "cards=0 must not run card people/event summaries");
});

test("global Library search works without preloading the entire catalogue", () => {
  const route = read("src/app/api/ideas/route.ts");
  const client = read("src/components/ideas/InlineTopicSearch.tsx");

  assert.doesNotMatch(route, /query\.length\s*<\s*2\s*\|\|\s*!seedTypeId/);
  assert.match(route, /p_seed_type_id:\s*seedTypeId\s*\|\|\s*null/);
  assert.match(client, /fetch\(`\/api\/ideas\?q=\$\{encodeURIComponent\(query\.trim\(\)\)\}`/);
  assert.match(client, /Kütüphanenin tamamını aynı anda yüklemek yerine/);
});

test("personal child cards bypass Library-only hierarchy hiding", () => {
  const source = read("src/components/ideas/InlineTopicSearch.tsx");

  assert.match(source, /scope==="library"&&effectiveKind!=="place"&&item\.parent_target_id/);
  assert.match(source, /scope==="library"&&cardKind\(item\)==="club"/);
  assert.match(source, /scope==="library"&&\(kind==="all"\|\|Boolean\(categoryCardsError\)\)\?\[\]/);
  assert.match(source, /!matches\(card,next\)/);
});
