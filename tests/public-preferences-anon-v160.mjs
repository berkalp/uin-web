import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/202610100001_public_preferences_anon_access_v160.sql",
  "utf8",
);
const profile = readFileSync("src/app/u/[username]/page.tsx", "utf8");

test("the public-only preference reader is available to anonymous profiles", () => {
  assert.match(
    migration,
    /revoke all\s+on function public\.get_public_preferences_v2921\(text\)\s+from public/i,
  );
  assert.match(
    migration,
    /grant execute\s+on function public\.get_public_preferences_v2921\(text\)\s+to anon, authenticated/i,
  );
  assert.doesNotMatch(migration, /to public/i);
});

test("profile does not fetch preferences after the favorites section is removed", () => {
  assert.doesNotMatch(profile, /supabase\.rpc\("get_public_preferences_v2921"/);
  assert.doesNotMatch(profile, /PublicFavoritesPanel|publicPreferencesError/);
});
