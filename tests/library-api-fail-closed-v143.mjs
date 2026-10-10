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
  assert.ok(summaryRead >= 0, "category cards need the canonical summary projection");
  assert.match(source, /if\(visibilityResult\.error\)[\s\S]*status:\s*503/);
  assert.match(source, /visibleTargetIds=new Set\(visibilityRows\.map/);
  assert.match(source, /visibleIds=ids\.filter\(id=>visibleTargetIds\.has\(id\)\)/);
  assert.match(source, /missingIds=visibleIds\.filter\(id=>!cardByTarget\.has\(id\)\)/);
  assert.match(source, /if\(missingIds\.length\)[\s\S]*status:\s*503/);
  assert.match(source, /invalidMetricIds=visibleIds\.filter/);
  assert.match(source, /catalogue=visibleIds\.map/);
  assert.doesNotMatch(source, /missingIds=ids\.filter/);
  assert.doesNotMatch(source, /cardByTarget\.get\(id\)\s*\|\|\s*\{[^}]*intent_people_count\s*:\s*0/s);
  assert.match(source, /if\(typeResult\.error\)\{[\s\S]*status:503/);
  assert.match(source, /if\(!type\?\.active\)return NextResponse\.json\(\{error:"Kategori bulunamadı\."\},\{status:404\}\)/);
});

test("category cards preserve the native viewer session for visibility-aware counters", () => {
  const source = read("src/app/api/ideas/category-cards/route.ts");
  assert.match(source, /request\.headers\.get\("authorization"\)/);
  assert.match(source, /createSupabaseClient\([^\n]*global:\{headers:\{Authorization:`Bearer \$\{token\}`\}\}/);
  assert.match(source, /const db=await requestClient\(request\)/);
  assert.doesNotMatch(source, /const db=await createClient\(\)/);
});

test("category cards reuse enrichment, fail closed, and throttle repeat catalogue loads", () => {
  const route = read("src/app/api/ideas/category-cards/route.ts");
  const client = read("src/components/ideas/InlineTopicSearch.tsx");

  const parallelStart = route.indexOf("const [initialVisibilityResult,initialCardsResult,initialSocialResult,initialHierarchyResult]=await Promise.all([");
  const retryStart = route.indexOf("let visibilityResult=initialVisibilityResult");
  assert.ok(parallelStart >= 0 && retryStart > parallelStart, "all placement-id projections must start in one parallel batch");
  const initialBatch = route.slice(parallelStart, retryStart);
  assert.match(initialBatch, /db\.rpc\("get_uin_cover_positions_v62",\{p_target_ids:ids\}\)/);
  assert.match(initialBatch, /db\.rpc\("get_uin_catalogue_for_targets_v123",\{p_target_ids:ids\}\)/);
  assert.match(initialBatch, /db\.rpc\("get_uin_card_social_v87",\{p_target_ids:ids\}\)/);
  assert.match(initialBatch, /db\.rpc\("get_uin_card_parent_edges_v143",\{p_target_ids:ids\}\)/);
  assert.doesNotMatch(initialBatch, /p_target_ids:visibleIds/);
  assert.match(route, /let visibilityResult=initialVisibilityResult;\s*if\(visibilityResult\.error\)visibilityResult=await db\.rpc\("get_uin_cover_positions_v62",\{p_target_ids:ids\}\)/);
  assert.match(route, /let cardsResult=initialCardsResult;\s*if\(cardsResult\.error\)cardsResult=await db\.rpc\("get_uin_catalogue_for_targets_v123",\{p_target_ids:ids\}\)/);
  assert.match(route, /const \[socialResult,hierarchyResult\]=await Promise\.all\(\[/);
  assert.match(route, /initialSocialResult\.error\?db\.rpc\("get_uin_card_social_v87",\{p_target_ids:ids\}\):Promise\.resolve\(initialSocialResult\)/);
  assert.match(route, /initialHierarchyResult\.error\?db\.rpc\("get_uin_card_parent_edges_v143",\{p_target_ids:ids\}\):Promise\.resolve\(initialHierarchyResult\)/);
  assert.match(route, /if\(socialResult\.error\)\{[\s\S]*status:503/);
  assert.match(route, /if\(hierarchyResult\.error\)\{[\s\S]*status:503/);
  assert.match(route, /if\(!Array\.isArray\(socialResult\.data\)\)\{[\s\S]*status:503/);
  assert.match(route, /if\(!Array\.isArray\(hierarchyResult\.data\)\)\{[\s\S]*status:503/);
  assert.match(route, /invalidSocialIds=visibleIds\.filter/);
  assert.match(route, /if\(invalidSocialIds\.length\)\{[\s\S]*status:503/);
  assert.doesNotMatch(route, /socialResult\.error\?\[\]/);
  assert.doesNotMatch(route, /hierarchyResult\.error\?\[\]/);
  assert.doesNotMatch(route, /db\.rpc\("get_uin_card_ratings_v85"/);
  assert.match(route, /const social=new Map\(\(\(socialResult\.data\|\|\[\]\)/);
  assert.match(route, /average_rating:stats\?\.average_rating==null\?null:Number\(stats\.average_rating\)/);
assert.match(route, /const cacheHeaders=\{"Cache-Control":"private, max-age=60, must-revalidate","Vary":"Cookie, Authorization"\}/);
  assert.match(route, /return NextResponse\.json\(\{catalogue\},\{headers:cacheHeaders\}\)/);
  assert.doesNotMatch(route, /stale-while-revalidate/);

  assert.match(client, /const categoryLoadedAt=useRef<Record<string,number>>\(\{\}\)/);
  assert.match(client, /if\(!force&&Date\.now\(\)-Number\(categoryLoadedAt\.current\[next\]\|\|0\)<60_000\)return/);
  assert.match(client, /cache:force\?"no-store":"default",signal/);
  assert.match(client, /categoryLoadedAt\.current\[next\]=Date\.now\(\)/);
  assert.match(client, /await loadCategoryCatalogue\(kind as Kind,undefined,true\)/);
});
test("personal scopes use canonical direct membership and keep the light read light", () => {
  const source = read("src/app/api/ideas/scopes/route.ts");
  assert.match(source, /resolve_uin_card_targets_v143/);
  assert.match(source, /get_my_uin_active_plan_topics_v153/);
  assert.doesNotMatch(source, /get_my_uin_active_plan_topics_v152/);
  assert.match(source, /personal_event:/);
  assert.match(source, /personal_start_date:/);
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
  assert.match(source, /scope==="library"&&kind==="all"\?\[\]/);
  assert.doesNotMatch(source, /kind==="all"\|\|Boolean\(categoryCardsError\)/);
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
  assert.match(source, /hasScopeCounts\?categoryTotal:scopeCountsLoading\?"…":"—"/);
  assert.match(source, /hasScopeCounts\?count:scopeCountsLoading\?"…":"—"/);
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

test("card details parallelize bounded readers and preserve canonical aggregates", () => {
  const route = read("src/app/api/ideas/[targetId]/route.ts");
  const modal = read("src/components/ideas/TopicCardModal.tsx");

  assert.match(route, /let typeId=typeof card\.content_type_id==="string"\?card\.content_type_id:typeof metadata\.content_type_id==="string"\?metadata\.content_type_id:""/);
  assert.match(route, /supabase\.rpc\("get_place_hierarchy_v74",\{p_target_ids:\[targetId\]\}\)/);
  assert.match(route, /if\(typeResult\.data\?\.base_kind==="place"&&hierarchyResult\.error\)\{[\s\S]*status:503/);
  assert.match(route, /const hierarchyRow=/);
  assert.match(route, /const placeKind=String\(hierarchyRow\?\.place_hierarchy\?\.kind\|\|""\)/);
  assert.match(route, /const boundedPlaceKinds=\["il","şehir","city","ilçe","district","yer","place"\]/);
  assert.match(route, /const mustSerializePlaceReaders=typeResult\.data\?\.base_kind==="place"&&!boundedPlaceKinds\.includes\(placeKind\)/);
  assert.doesNotMatch(route, /metadata\.global_place_kind/);
  assert.match(route, /\[peoplePage,reviewPage,eventPage\]=mustSerializePlaceReaders\s*\?\s*\[await readPeople\(\),await readReviews\(\),await readEvents\(\)\]/);
  assert.match(route, /:\s*await Promise\.all\(\[readPeople\(\),readReviews\(\),readEvents\(\)\]\)/);
  assert.doesNotMatch(route, /base_kind==="place"\s*\?\s*\[await readPeople/);

  const canonicalHeader = route.indexOf('supabase.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:[targetId]})');
  const modalReaders = route.indexOf('const readPeople=()=>supabase.rpc("get_uin_card_people_v81"');
  assert.ok(canonicalHeader >= 0, "full details must read the same catalogue projection as the list");
  assert.ok(modalReaders > canonicalHeader, "canonical counters must be loaded before detail rows");
  assert.match(route, /\["intent_people_count","experience_people_count","active_event_count"\]/);
  assert.match(route, /communityCounts:\[Number\(card\.intent_people_count\|\|0\),Number\(card\.experience_people_count\|\|0\),Number\(card\.active_event_count\?\?card\.social_intent_count\?\?0\)\]/);

  assert.match(modal, /loading&&!detail/);
  assert.match(modal, /detail\?\.communityCounts\?\.\[0\]\?\?selected\.aggregateWanting/);
  assert.match(modal, /detail\?\.communityCounts\?\.\[1\]\?\?selected\.aggregateDone/);
  assert.match(modal, /detail\?\.communityCounts\?\.\[2\]\?\?selected\.aggregateActive/);
  assert.match(modal, /item\.count\?\?"…"/);
  assert.doesNotMatch(modal, /count:(?:people\.filter|reviews\.length|events\.filter)/);
  assert.doesNotMatch(modal, /communityCounts\?\.\[[012]\]\|\|0/);
});

test("card ownership excludes social event attendance from personal wish state", () => {
  const route = read("src/app/api/ideas/[targetId]/route.ts");
  const modal = read("src/components/ideas/TopicCardModal.tsx");
  const start = route.indexOf("const ownRow=");
  const end = route.indexOf("if(socialResult.error", start);
  const ownership = route.slice(start, end);

  assert.ok(start >= 0 && end > start, "card ownership block must remain identifiable");
  assert.match(
    ownership,
    /const ownPerson=people\.find\(person=>person\.user_id===viewerId&&person\.is_current!==false&&\["personal","seed"\]\.includes\(String\(person\.source_kind\|\|""\)\)\)/,
    "only personal and seed people may provide wish ownership",
  );
  assert.match(
    ownership,
    /const hasOwnPersonalIntent=ownRow\?\.status==="active"\|\|Boolean\(ownPerson\)/,
    "an explicit personal row must be active before it owns the wish",
  );
  assert.doesNotMatch(
    ownership,
    /const hasOwnPersonalIntent=Boolean\(ownIntentResult\?\.data\)\|\|Boolean\(ownPerson\)/,
    "completed personal rows must not be treated as current wishes",
  );
  assert.match(ownership, /const ownWish=ownRow\?\.status==="active"\?[\s\S]*?:ownPerson\?[\s\S]*?:null/);
  assert.match(ownership, /const ownIntentDraft=ownRow\?\.status==="active"\?[\s\S]*?:ownPerson\?[\s\S]*?:null/);
  assert.match(
    route,
    /wantRows\.filter\(row=>row\.user_id!==viewerId&&\["personal","seed"\]\.includes\(String\(row\.source_kind\|\|""\)\)\)/,
    "social event and plan rows must not trigger together-permission checks",
  );
  assert.match(modal, /function isPersonalWishSource\([^)]*\)\{return \["personal","seed"\]\.includes/);
  assert.match(modal, /const ownPersonalWish=people\.find\(person=>isCurrentPersonalWish\(person,detail\?\.viewerId\|\|null\)\)\|\|null/);
  assert.match(modal, /const hasWanted=wantedNow\|\|Boolean\(detail\?\.hasOwnPersonalIntent\)\|\|Boolean\(ownPersonalWish\)/);
  assert.doesNotMatch(modal, /hasWanted=[^;]*people\.some\(person=>person\.user_id===detail\?\.viewerId/);
  assert.match(modal, /const baseline=ownWish\|\|people\.find\(person=>isCurrentPersonalWish\(person,viewerId\)\)/);
  assert.match(modal, /person\.source_kind==="social"\?"Aktif etkinlik veya plan üzerinden görünüyor":"Genel istek"/);
  assert.match(modal, /allowProposal&&targetId&&viewerId&&isPersonalWishSource\(person\)/);
  assert.match(
    route,
    /const rowId=row\.source_kind==="social"\?`\$\{String\(row\.source_id\|\|sourceTarget\)\}:\$\{String\(row\.user_id\)\}`:row\.source_id\|\|row\.user_id/,
    "social participants sharing one event need distinct UI row identities",
  );
});

test("card wish mutations use the exact personal source target across aliases", () => {
  const route = read("src/app/api/ideas/[targetId]/route.ts");
  const modal = read("src/components/ideas/TopicCardModal.tsx");

  assert.match(route, /const ownPersonSourceTargetId=ownPerson\?\.source_target_id/);
  assert.match(
    route,
    /const ownWishTargetId=ownRow\?\.status==="active"\?targetId:[^;]*ownPersonSourceTargetId[^;]*:ownPerson\?targetId:null/,
  );
  assert.match(route, /return NextResponse\.json\(\{canonicalTargetId:targetId,ownWishTargetId,ownWish,ownIntentDraft/);
  assert.match(modal, /ownWishTargetId\?:string\|null/);
  assert.match(modal, /const canonicalTargetId=validTargetId\(detail\?\.canonicalTargetId\)\|\|selected\.canonicalTargetId/);
  assert.match(modal, /const wishTargetId=hasWanted\?\(validTargetId\(detail\?\.ownWishTargetId\)[^;]*\):canonicalTargetId/);
  assert.match(modal, /archive_my_common_wish_v73",\{p_target_id:wishTargetId\}/);
  assert.match(modal, /<CommonPersonalIntentForm[^>]*targetId=\{wishTargetId\}/);
  assert.match(modal, /hasWanted\?<div className="grid grid-cols-2 gap-1\.5">/);
  assert.match(modal, /onClick=\{\(\)=>setView\("want_form"\)\}[^>]*>Düzenle<\/button>/);
  assert.match(modal, /onClick=\{\(\)=>void cancelWish\(\)\}[^>]*>İptal et<\/button>/);
  assert.doesNotMatch(modal, /onClick=\{\(\)=>hasWanted\?void cancelWish\(\):setView\("want_form"\)\}/);
});

test("place admin edits rehydrate the stored hierarchy before saving", () => {
  const client = read("src/components/ideas/InlineTopicSearch.tsx");
  const route = read("src/app/api/ideas/admin/route.ts");

  assert.match(client, /place_hierarchy\?:AdminPlaceHierarchy\|null/);
  assert.match(client, /function browseAdminPlaceKind\(scope:string\)/);
  assert.match(client, /const fallbackPlaceKind=geo\?\.adminKind\|\|browseAdminPlaceKind\(geo\?\.kind\|\|""\)/);
  assert.match(client, /const placeHierarchy=adminPlaceHierarchyFrom\(metadata,fallbackPlaceKind,fallbackPlaceParent\)/);
  assert.match(client, /setAdminPlaceKind\(placeHierarchy\.kind\);setAdminParent\(placeHierarchy\.parentTargetId\)/);
  assert.match(client, /const adminKind=browseAdminPlaceKind\(node\.scope\)/);
  assert.match(client, /const parentTargetId=node\.parent_target_id\|\|\(node\.scope==="district"\?selection\.cityTargetId:""\)/);
  assert.match(client, /disabled=\{busy\|\|adminLoading\|\|!adminTitle\.trim\(\)/);
  assert.match(client, /UUID_PATTERN\.test\(hierarchy\.parent_target_id\)/);
  assert.match(client, /const hasParent=Object\.prototype\.hasOwnProperty\.call\(hierarchy,"parent_target_id"\)/);
  assert.match(client, /const parentTargetId=hasParent\?\(typeof hierarchy\.parent_target_id==="string"&&UUID_PATTERN\.test\(hierarchy\.parent_target_id\)\?hierarchy\.parent_target_id:""\):fallbackParentTargetId/);
  assert.match(route, /const effectivePlaceParent=placeHierarchy&&String\(placeHierarchy\.kind\)!==""&&String\(placeHierarchy\.kind\)!=="Ülke"/);
  assert.doesNotMatch(route, /!\["İlçe","Yer"\]\.includes\(String\(placeHierarchy\.kind\)\)/);
});
