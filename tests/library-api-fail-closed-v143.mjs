import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("category count failures never become successful zero counters", () => {
  const route = read("src/app/api/ideas/category-counts/route.ts");
  const loader = read("src/utils/ideaCategoryCounts.ts");
  assert.match(loader, /get_uin_category_counts_v129/);
  assert.match(route, /status\s*:\s*503/);
  assert.doesNotMatch(loader, /result\.error\s*\?\s*0/);
  assert.doesNotMatch(loader, /placeResult\.data[^\n]*\|\|\s*0/);
});

test("category cards omit only proven hidden targets and fail closed otherwise", () => {
  const source = read("src/app/api/ideas/category-cards/route.ts");
  const visibilityRead = source.indexOf('db.rpc("get_uin_cover_positions_v62"');
  const summaryRead = source.indexOf('db.rpc("get_uin_catalogue_for_targets_v123"');

  assert.ok(visibilityRead >= 0, "category cards need the canonical visibility projection");
  assert.ok(summaryRead > visibilityRead, "visibility must be resolved before summaries");
  assert.match(source, /if\(visibilityResult\.error\)[\s\S]*status:\s*503/);
  assert.match(source, /visibleTargetIds=new Set\(visibilityRows\.map/);
  assert.match(source, /visibleIds=ids\.filter\(id=>visibleTargetIds\.has\(id\)\)/);
  assert.match(source, /missingIds=visibleIds\.filter\(id=>!cardByTarget\.has\(id\)\)/);
  assert.match(source, /if\(missingIds\.length\)[\s\S]*status:\s*503/);
  assert.match(source, /invalidMetricIds=visibleIds\.filter/);
  assert.match(source, /catalogue=visibleIds\.map/);
  assert.doesNotMatch(source, /missingIds=ids\.filter/);
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
  assert.match(route, /if\s*\(catalogue\.error\)[^\n]*status:\s*503/);
  assert.match(route, /if\s*\(missingIds\.length\)[^\n]*status:\s*503/);
  assert.match(client, /fetch\(`\/api\/ideas\?q=\$\{encodeURIComponent\(query\.trim\(\)\)\}`/);
  assert.match(client, /Kütüphanenin tamamını aynı anda yüklemek yerine/);
});

test("personal child cards bypass Library-only hierarchy hiding", () => {
  const source = read("src/components/ideas/InlineTopicSearch.tsx");

  assert.match(source, /scope==="library"&&effectiveKind!=="place"&&hasSameCategoryParent\(item\)/);
  assert.match(source, /scope==="library"&&cardKind\(item\)==="club"/);
  assert.match(source, /scope==="library"&&\(kind==="all"\|\|Boolean\(categoryCardsError\)\)\?\[\]/);
  assert.match(source, /!matches\(card,next\)/);
});

test("cross-category source relations do not hide browseable cards", () => {
  const source = read("src/components/ideas/InlineTopicSearch.tsx");
  const route = read("src/app/api/ideas/category-cards/route.ts");

  assert.match(source, /hasSameCategoryParent=.*parent\.content_type_id\|\|cardKind\(parent\).*item\.content_type_id\|\|cardKind\(item\)/);
  assert.doesNotMatch(source, /if\(item\.parent_target_id\)return false/);
  assert.match(route, /content_type_id:placementType/);
  assert.match(route, /parentItem&&parentPlacementType===placementType\?rawParentId:null/);
  assert.doesNotMatch(route, /content_type_id:String\([^\n]*card\.content_type_id/);
});

test("unresolved category counts render as loading or unavailable, never fake zero", () => {
  const source = read("src/components/ideas/InlineTopicSearch.tsx");

  assert.match(source, /categoryCountsLoading/);
  assert.match(source, /id==="library"&&!hasCategoryCounts\?\(categoryCountsLoading\?"…":"—"\)/);
  assert.match(source, /hasCategoryCounts\?categoryTotal:categoryCountsLoading\?"…":"—"/);
  assert.match(source, /hasCategoryCounts\?count:categoryCountsLoading\?"…":"—"/);
});

test("public category counts are cached and do not block the Ideas SSR shell", () => {
  const page = read("src/app/ideas/page.tsx");
  const route = read("src/app/api/ideas/category-counts/route.ts");
  const cache = read("src/utils/ideaCategoryCounts.ts");
  const client = read("src/components/ideas/InlineTopicSearch.tsx");

  assert.doesNotMatch(page, /get_uin_category_counts_v129/);
  assert.match(route, /getCachedIdeaCategoryCounts/);
  assert.match(route, /s-maxage=60/);
  assert.match(route, /searchParams\.get\("admin"\)==="1"/);
  assert.match(route, /get_admin_role/);
  assert.match(route, /private, max-age=15/);
  assert.match(cache, /unstable_cache/);
  assert.match(cache, /revalidate:\s*60/);
  assert.match(client, /const endpoint=isAdmin\?"\/api\/ideas\/category-counts\?admin=1":"\/api\/ideas\/category-counts"/);
  assert.match(client, /fetch\(endpoint,\{signal:controller\.signal\}\)/);
  assert.match(client, /if\(current\|\|Date\.now\(\)-lastLoadedAt<15_000\)return/);
});

test("card details parallelize ordinary readers and preserve loading aggregates", () => {
  const route = read("src/app/api/ideas/[targetId]/route.ts");
  const modal = read("src/components/ideas/TopicCardModal.tsx");

  assert.match(route, /base_kind==="place"\s*\?\s*\[await readPeople\(\),await readReviews\(\),await readEvents\(\)\]/);
  assert.match(route, /:\s*await Promise\.all\(\[readPeople\(\),readReviews\(\),readEvents\(\)\]\)/);
  assert.match(modal, /loading&&!detail/);
  assert.match(modal, /count:selected\.aggregateWanting/);
  assert.match(modal, /count:selected\.aggregateDone/);
  assert.match(modal, /count:selected\.aggregateActive/);
  assert.match(modal, /item\.count==null\?"…":item\.count/);
  assert.doesNotMatch(modal, /count:selected\.aggregate(?:Wanting|Done|Active)\|\|0/);
});