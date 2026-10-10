import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function source(path) {
  return readFileSync(path, "utf8");
}

function loadProfileSeedParser() {
  const compiled = ts.transpileModule(
    source("src/utils/publicProfileSeeds.ts"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const moduleRecord = { exports: {} };
  vm.runInNewContext(compiled, {
    module: moduleRecord,
    exports: moduleRecord.exports,
  });
  return moduleRecord.exports;
}

function loadProfileActivityHelpers() {
  const compiled = ts.transpileModule(
    source("src/components/profile/ProfileActivityTabs.tsx"),
    {
      compilerOptions: {
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const moduleRecord = { exports: {} };
  const reactStub = {
    useMemo: (factory) => factory(),
    useState: (initialValue) => [initialValue, () => {}],
  };
  const jsxStub = {
    Fragment: Symbol("Fragment"),
    jsx: () => null,
    jsxs: () => null,
  };

  vm.runInNewContext(compiled, {
    module: moduleRecord,
    exports: moduleRecord.exports,
    require(specifier) {
      if (specifier === "react") return reactStub;
      if (specifier === "react/jsx-runtime") return jsxStub;
      if (specifier === "@/components/discover/DiscoverIntentCard") {
        return { __esModule: true, default: () => null };
      }
      throw new Error(`Unexpected ProfileActivityTabs import: ${specifier}`);
    },
  });
  return moduleRecord.exports;
}

function fixture(index, overrides = {}) {
  const day = String((index % 27) + 1).padStart(2, "0");
  return {
    seed_id: `seed-${index}`,
    catalog_item_id: `catalog-${index}`,
    canonical_target_id: `target-${index}`,
    seed_type_icon: "🎬",
    seed_type_name: "Film",
    seed_type_slug: "movie",
    title: `Deneyim ${index}`,
    subtitle: null,
    cover_url: null,
    visibility: "everyone",
    seed_scope: "library",
    status: "completed",
    target_date: null,
    key_takeaway: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: `2026-09-${day}T00:00:00.000Z`,
    relationship_status: "completed",
    experience_precision: "exact",
    experience_date: `2026-09-${day}`,
    experience_year: 2026,
    personal_cover_url: null,
    rating: (index % 10) + 1,
    notes: null,
    creator_name: null,
    release_year: null,
    catalog_cover_url: null,
    catalog_item_kind: "movie",
    ...overrides,
  };
}

test("profile Seed reader is secure, uncapped and consumed atomically", () => {
  const profile = source("src/app/u/[username]/page.tsx");
  const parser = source("src/utils/publicProfileSeeds.ts");
  const migration = source(
    "supabase/migrations/20261010210000_visible_profile_seed_life_v170.sql",
  );

  assert.match(profile, /get_visible_profile_seed_life_v170/);
  assert.doesNotMatch(profile, /get_visible_profile_seed_life_v24/);
  assert.doesNotMatch(profile, /get_visible_profile_seeds_v2/);

  const request = profile.slice(
    profile.indexOf("const visibleSeedResultPromise"),
    profile.indexOf("const displayOrderResultPromise"),
  );
  assert.doesNotMatch(request, /p_limit|slice\s*\(/);
  assert.match(profile, /invalidVisibleSeedRows\s*=\s*parsePublicProfileSeedLifePayload/);
  assert.match(profile, /secondaryPayloadIncomplete\s*=[\s\S]*invalidVisibleSeedRows/);
  assert.match(profile, /activePersonalCount = visibleSeeds\.filter/);
  assert.match(profile, /personalExperienceCount = visibleSeeds\.filter/);
  assert.match(
    profile,
    /forbiddenNonOwnerSeedScope\s*=\s*!page\.viewer\.is_owner[\s\S]{0,120}seed\.seed_scope !== "library"/,
  );
  assert.match(
    profile,
    /forbiddenNonOwnerSeedVisibility\s*=\s*!page\.viewer\.is_owner[\s\S]{0,220}seed\.visibility === "only_me"/,
  );
  assert.match(
    profile,
    /seed\.visibility === "friends"[\s\S]{0,100}page\.viewer\.friendship_status !== "accepted"/,
  );
  assert.match(
    profile,
    /secondaryPayloadIncomplete\s*=[\s\S]*forbiddenNonOwnerSeedScope[\s\S]*forbiddenNonOwnerSeedVisibility/,
  );
  assert.match(parser, /One malformed[\s\S]*partial count or list/);
  assert.match(parser, /\["library", "private"\]\.includes\(value\.seed_scope/);
  assert.match(
    parser,
    /row\.canonical_target_id\s*\?\?\s*row\.catalog_item_id\s*\?\?\s*row\.seed_id/,
  );

  assert.match(migration, /seed_is_visible_to_viewer\([\s\S]*auth\.uid\(\)/);
  assert.match(
    migration,
    /seed\.seed_scope = 'library'[\s\S]{0,120}catalog_item\.status = 'active'/,
  );
  assert.match(
    migration,
    /seed\.user_id = auth\.uid\(\)[\s\S]{0,120}seed\.seed_scope in \('library', 'private'\)/,
  );
  assert.match(
    migration,
    /seed\.user_id is distinct from auth\.uid\(\)[\s\S]{0,120}seed\.seed_scope = 'library'[\s\S]{0,120}catalog_item\.status = 'active'/,
  );
  assert.match(
    migration,
    /p_profile_user_id = auth\.uid\(\)[\s\S]{0,100}or not public\.is_managed_minor_user\(p_profile_user_id\)/,
  );
  assert.match(
    migration,
    /when seed\.status = 'completed' then personal_state\.rating[\s\S]{0,80}else null/,
  );
  assert.match(
    migration,
    /coalesce\(seed\.canonical_target_id, catalog_item\.canonical_target_id\)/,
  );
  assert.doesNotMatch(migration, /p_limit/);
});

test("the SQL contract denies direct managed-minor UUID reads and preserves owner reads", () => {
  const contract = source(
    "supabase/tests/visible_profile_seed_life_v170_contract.sql",
  );

  assert.match(
    contract,
    /public\.is_managed_minor_user\(profile\.id\)/,
  );
  assert.match(
    contract,
    /Anonymous direct UUID access exposed[\s\S]*Authenticated non-owner direct UUID access exposed/,
  );
  assert.match(contract, /Managed-minor owner completeness mismatch/);
});

test("the parser preserves 151 unique visible rows and rejects partial payloads", () => {
  const { parsePublicProfileSeedLifePayload } = loadProfileSeedParser();
  const rows = Array.from({ length: 151 }, (_, index) => fixture(index));

  assert.equal(parsePublicProfileSeedLifePayload(rows).length, 151);
  assert.equal(
    parsePublicProfileSeedLifePayload([
      ...rows.slice(0, 75),
      { ...rows[75], visibility: "unexpected" },
      ...rows.slice(76),
    ]),
    null,
  );
});

test("the parser rejects malformed timestamps and active experience metadata", () => {
  const { parsePublicProfileSeedLifePayload } = loadProfileSeedParser();
  const active = fixture(152, {
    status: "active",
    relationship_status: "want",
    experience_precision: null,
    experience_date: null,
    experience_year: null,
    rating: null,
  });

  assert.equal(parsePublicProfileSeedLifePayload([active]).length, 1);
  assert.equal(
    parsePublicProfileSeedLifePayload([
      { ...active, created_at: "not-a-timestamp" },
    ]),
    null,
  );
  assert.equal(
    parsePublicProfileSeedLifePayload([
      { ...active, updated_at: "not-a-timestamp" },
    ]),
    null,
  );

  for (const override of [
    { rating: 8 },
    { experience_precision: "exact" },
    { experience_date: "2026-10-11" },
    { experience_year: 2026 },
  ]) {
    assert.equal(
      parsePublicProfileSeedLifePayload([{ ...active, ...override }]),
      null,
    );
  }
});

test("canonical duplicates collapse only within one lifecycle relationship", () => {
  const { parsePublicProfileSeedLifePayload } = loadProfileSeedParser();
  const older = fixture(1, {
    seed_id: "older-completed",
    canonical_target_id: "shared-target",
    experience_date: "2025-01-01",
    rating: 5,
  });
  const newer = fixture(2, {
    seed_id: "newer-completed",
    canonical_target_id: "shared-target",
    experience_date: "2026-01-01",
    rating: 9,
  });
  const active = fixture(3, {
    seed_id: "active-wish",
    canonical_target_id: "shared-target",
    status: "active",
    relationship_status: "want",
    experience_precision: null,
    experience_date: null,
    experience_year: null,
    rating: null,
  });

  const result = parsePublicProfileSeedLifePayload([older, active, newer]);
  assert.equal(result.length, 2);
  assert.deepEqual(
    Array.from(result, (row) => row.seed_id).sort(),
    ["active-wish", "newer-completed"],
  );

  const catalogResult = parsePublicProfileSeedLifePayload([
    fixture(4, {
      seed_id: "catalog-older",
      canonical_target_id: null,
      catalog_item_id: "shared-catalog",
      experience_date: "2024-01-01",
    }),
    fixture(5, {
      seed_id: "catalog-newer",
      canonical_target_id: null,
      catalog_item_id: "shared-catalog",
      experience_date: "2026-01-01",
    }),
  ]);
  assert.equal(catalogResult.length, 1);
  assert.equal(catalogResult[0].seed_id, "catalog-newer");
});

test("profile controls mirror Library cards and expose meaningful navigation", () => {
  const profile = source("src/app/u/[username]/page.tsx");
  const panel = source("src/components/seeds/PublicSeedsPanel.tsx");
  const card = source("src/components/seeds/ProfileSeedCard.tsx");

  for (const id of [
    "active-social",
    "active-personal",
    "planning",
    "social-experiences",
    "personal-experiences",
    "upcoming",
  ]) {
    assert.match(profile, new RegExp(`href: "#${id}"`));
    assert.match(profile, new RegExp(`id="${id}"`));
  }

  assert.match(profile, /<WebCardLayoutPicker\s*\/>/);
  assert.equal((profile.match(/UIN Güven Özeti/g) ?? []).length, 1);
  assert.doesNotMatch(profile, /PublicFavoritesPanel|get_public_preferences_v2921/);
  assert.match(panel, /Puanı yüksek/);
  assert.match(panel, /En yeni deneyim/);
  assert.match(panel, /uin-card-grid/);
  assert.match(panel, /const byId = new Map\(seeds\.map/);
  assert.match(panel, /return \[\.\.\.ordered, \.\.\.byId\.values\(\)\]/);
  assert.doesNotMatch(panel, /useEffect\([\s\S]{0,120}setOrderedSeeds/);
  assert.match(card, /<PersonalLibraryCard/);
  assert.match(card, /personalRating=\{seed\.personal_rating\}/);
  assert.match(card, /\?editExperience=1/);
});

test("activity role badges and rendered cards share each lifecycle section filter", () => {
  const activityTabs = source(
    "src/components/profile/ProfileActivityTabs.tsx",
  );
  const { filterProfileCardsForLifecycle } = loadProfileActivityHelpers();
  const cards = ["open", "forming", "planned", "future", "completed"].map(
    (lifecycleStatus) => ({
      intent_id: lifecycleStatus,
      lifecycle_status: lifecycleStatus,
      plan_id: null,
      resource_id: lifecycleStatus,
    }),
  );
  const ids = (rows) => Array.from(rows, (row) => row.resource_id);

  assert.deepEqual(
    ids(filterProfileCardsForLifecycle(cards, "active", "active", "all")),
    ["open"],
  );
  assert.deepEqual(
    ids(filterProfileCardsForLifecycle(cards, "active", "forming", "all")),
    ["forming"],
  );
  assert.deepEqual(
    ids(filterProfileCardsForLifecycle(cards, "active", "upcoming", "all")),
    ["planned", "future"],
  );
  assert.deepEqual(
    ids(filterProfileCardsForLifecycle(cards, "active", "all", "planned")),
    ["planned"],
  );
  assert.deepEqual(
    ids(filterProfileCardsForLifecycle(cards, "experience", "active", "all")),
    ["open", "forming", "planned", "future", "completed"],
  );

  assert.match(
    activityTabs,
    /const filteredCards = lifecycleFilteredCardsByTab\[activeTab\]/,
  );
  for (const tab of ["all", "hosting", "participating"]) {
    assert.match(
      activityTabs,
      new RegExp(`count: lifecycleFilteredCardsByTab\\.${tab}\\.length`),
    );
  }
});
