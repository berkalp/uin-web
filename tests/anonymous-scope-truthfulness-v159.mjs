import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync("src/components/ideas/InlineTopicSearch.tsx", "utf8");

test("personal catalogue scopes follow the local browser session", () => {
  assert.match(client, /supabase\.auth\.getSession\(\)/);
  assert.match(client, /supabase\.auth\.onAuthStateChange/);
  assert.match(client, /const scope:LibraryScope=viewerId&&!addingOnly\?storedScope:"library"/);
  assert.match(client, /const scopeOptions=viewerId&&!addingOnly\?/);

  const fetchStart = client.indexOf("useEffect(()=>{if(addingOnly||!viewerId)return;");
  const fetchEnd = client.indexOf("useEffect(()=>{if(addingOnly||viewerId!==null)return;", fetchStart);
  assert.ok(fetchStart >= 0 && fetchEnd > fetchStart, "personal fetch effect must stay identifiable");
  const personalFetch = client.slice(fetchStart, fetchEnd);
  assert.match(personalFetch, /fetch\(`\/api\/ideas\/scopes\?/);
  assert.ok(
    personalFetch.indexOf("if(addingOnly||!viewerId)return;") < personalFetch.indexOf("fetch(`/api/ideas/scopes?"),
    "anonymous viewers must be rejected before the personal endpoint is fetched",
  );

  assert.match(client, /if\(nextViewerId===null\)\{setScope\("library"\)/);
  assert.match(client, /nextParams\.delete\("scope"\);router\.replace/);
});

test("personal counts expose unknown and error states without discarding good data", () => {
  assert.match(client, /useState<ScopeData\|null>\(null\)/);
  assert.match(client, /id!=="library"&&!scopeData\?\(scopeLoading\?"…":"—"\):scopeCount\(id\)/);
  assert.match(client, /scopeLoading&&!scopeData/);

  const fetchStart = client.indexOf("useEffect(()=>{if(addingOnly||!viewerId)return;");
  const fetchEnd = client.indexOf("useEffect(()=>{if(addingOnly||viewerId!==null)return;", fetchStart);
  const personalFetch = client.slice(fetchStart, fetchEnd);
  const errorStart = personalFetch.indexOf("catch(cause)");
  const errorEnd = personalFetch.indexOf("finally", errorStart);
  assert.ok(errorStart >= 0 && errorEnd > errorStart, "personal error path must stay identifiable");
  assert.doesNotMatch(
    personalFetch.slice(errorStart, errorEnd),
    /setScopeData/,
    "a refresh error must preserve the last successful personal payload",
  );
  assert.doesNotMatch(client, /!\(scope!=="library"&&scopeError\)/);
});

test("library category errors keep last-good cards and library total is informational", () => {
  const categoryEffectStart = client.indexOf("useEffect(()=>{const type=contentTypes.find(item=>item.id===kind);");
  const categoryEffectEnd = client.indexOf("async function refreshCatalogue", categoryEffectStart);
  assert.ok(categoryEffectStart >= 0 && categoryEffectEnd > categoryEffectStart, "category effect must stay identifiable");
  const categoryEffect = client.slice(categoryEffectStart, categoryEffectEnd);
  assert.doesNotMatch(
    categoryEffect,
    /setCatalogue\(current=>current\.filter/,
    "a failed refresh must not erase previously loaded category cards",
  );

  assert.match(client, /const \[loadedCategoryKinds,setLoadedCategoryKinds\]=useState<Set<string>>/);
  assert.match(client, /const categoryCardsPending=[^;]*!hasLoadedCategoryCards&&\(categoryCardsLoading\|\|!categoryCardsError\)/);
  assert.match(client, /const suggestionSource=scope==="library"&&kind==="all"\?\[\]/);
  assert.doesNotMatch(client, /kind==="all"\|\|Boolean\(categoryCardsError\)/);
  assert.doesNotMatch(client, /!\(scope==="library"&&categoryCardsError\)/);
  assert.match(
    client,
    /\{scope==="library"\?<div[^>]*>[\s\S]*?Kategori toplamı · aşağıdan bir kategori seç[\s\S]*?:<button type="button" onClick=\{\(\)=>chooseCategory\("all"\)\}/,
  );
});
