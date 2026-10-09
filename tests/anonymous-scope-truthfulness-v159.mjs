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
  assert.match(client, /const personalCardsPending=[^;]*\(!scopeData\|\|!personalCardsReady\)/);

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

test("personal card readiness belongs to the requested scope and kind", () => {
  assert.match(client, /const \[scopeDataKey,setScopeDataKey\]=useState<string\|null>\(null\)/);
  assert.match(client, /const requestedPersonalCardKey=scope!=="library"&&!categoryLanding\?`\$\{scope\}:\$\{kind\}`:null/);
  assert.match(client, /scopeDataKey===requestedPersonalCardKey/);

  const fetchStart = client.indexOf("useEffect(()=>{if(addingOnly||!viewerId)return;");
  const fetchEnd = client.indexOf("useEffect(()=>{if(addingOnly||viewerId!==null)return;", fetchStart);
  assert.ok(fetchStart >= 0 && fetchEnd > fetchStart, "personal fetch effect must stay identifiable");
  const personalFetch = client.slice(fetchStart, fetchEnd);
  assert.match(personalFetch, /const requestCardKey=includeCards\?`\$\{scope\}:\$\{kind\}`:null/);
  assert.match(personalFetch, /setScopeData\(body\);setScopeDataKey\(requestCardKey\)/);
  assert.doesNotMatch(
    personalFetch.slice(personalFetch.indexOf("catch(cause)")),
    /setScopeDataKey/,
    "a failed refresh of the current key must preserve its last-good payload key",
  );

  assert.match(client, /const currentScopeError=scopeErrorKey===scopeRequestKey\?scopeError:""/);
  assert.match(client, /scope!=="library"&&\(!scopeData\|\|!personalCardsReady\)\?\(personalCardsPending\?"…":"—"\)/);
  assert.match(client, /!categoryLanding&&!\(scope!=="library"&&\(!scopeData\|\|!personalCardsReady\)\)/);
});

test("switching A to B to A never treats B's shared payload as ready for A", () => {
  let scopeDataKey = null;
  const accept = (scope, kind, includeCards = true) => {
    scopeDataKey = includeCards ? `${scope}:${kind}` : null;
  };
  const ready = (scope, kind) => scopeDataKey === `${scope}:${kind}`;

  accept("wishes", "movie");
  assert.equal(ready("wishes", "movie"), true);
  accept("wishes", "book");
  assert.equal(ready("wishes", "movie"), false);
  assert.equal(ready("wishes", "book"), true);

  // Navigating back happens before the movie response is accepted.
  assert.equal(ready("wishes", "movie"), false);
  accept("wishes", "movie");
  assert.equal(ready("wishes", "movie"), true);

  // A counts-only response cannot make any card key ready.
  accept("wishes", "movie", false);
  assert.equal(ready("wishes", "movie"), false);
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
