import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const source=relativePath=>readFileSync(new URL(`../${relativePath}`,import.meta.url),"utf8");

test("place hierarchy never turns failed or partial card reads into zero-valued cards",()=>{
  const route=source("src/app/api/places/hierarchy/route.ts");

  assert.match(route,/!usePopulationCatalogue&&!Array\.isArray\(levelResult\.data\).*Yer hiyerarşisi eksik döndü/s);
  assert.match(route,/if\(batch\.error\)throw batch\.error/);
  assert.match(route,/const TARGET_BATCH_THRESHOLD=15/);
  assert.match(route,/const TARGET_BATCH_CONCURRENCY=2/);
  assert.match(route,/const batchTargets=includeCards&&targetIds\.length>TARGET_BATCH_THRESHOLD/);
  assert.match(route,/targetIds\.length&&!batchTargets\?db\.rpc\("get_uin_catalogue_for_targets_v123"/);
  assert.match(route,/targetIds\.length&&!batchTargets\?db\.rpc\("get_uin_card_social_v87"/);
  assert.match(route,/Math\.min\(TARGET_BATCH_CONCURRENCY,jobs\.length\)/);
  assert.match(route,/cardBatches\[job\.batchIndex\]=batch\.data/);
  assert.match(route,/socialBatches\[job\.batchIndex\]=batch\.data/);
  assert.match(route,/if\(includeCards&&placementResult\.error\)throw placementResult\.error/);
  assert.match(route,/targetIds\.some\(id=>!cardIds\.has\(id\)\).*targetIds\.some\(id=>!socialIds\.has\(id\)\)/);
  assert.match(route,/cardMetricKeys\.some\(key=>!finiteCount\(row\[key\]\)\)/);
  assert.match(route,/socialMetricKeys\.some\(key=>!finiteCount\(row\[key\]\)\)/);
  assert.match(route,/typeof value!=="number"&&typeof value!=="string"/);
  assert.doesNotMatch(route,/if\(!batch\.error\)cardRows\.push/);
  assert.doesNotMatch(route,/intent_people_count:0,experience_people_count:0/);
  assert.doesNotMatch(route,/get_uin_card_summary_v129/);
});

test("catalogue search requires every dependency before returning success",()=>{
  const route=source("src/app/api/ideas/catalogue/route.ts");

  assert.match(route,/cards\.error\|\|types\.error\|\|seeds\.error/);
  assert.match(route,/cards\.data\.every\(catalogueCard\)/);
  assert.match(route,/types\.data\.every\(contentType\)/);
  assert.match(route,/seeds\.data\.every\(seedType\)/);
  assert.match(route,/const roleDenied=role\.error\?\.code==="42501"/);
  assert.match(route,/if\(role\.error&&!roleDenied\)return unavailable/);
  assert.match(route,/canAddSports:!roleDenied&&Boolean\(role\.data\)/);
  assert.match(route,/status:503/);
  assert.match(route,/private, no-store/);
  assert.doesNotMatch(route,/types:types\.data\|\|\[\]/);
  assert.doesNotMatch(route,/seedTypes:seeds\.data\|\|\[\]/);
});

test("place cover endpoint reports request failures as retryable errors",()=>{
  const route=source("src/app/api/places/covers/route.ts");

  assert.match(route,/catch\{[\s\S]*status:502/);
  assert.match(route,/placeCoverUrls\(nodes,\{throwOnError:true\}\)/);
  assert.match(route,/Yer kapakları yüklenemedi/);
  assert.match(route,/private, no-store/);
  assert.doesNotMatch(route,/catch\{return NextResponse\.json\(\{covers:\{\}\}\)\}/);
});
