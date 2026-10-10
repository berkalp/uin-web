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

test("profile reads the public preference payload and fails closed on transport errors", () => {
  assert.match(profile, /supabase\.rpc\("get_public_preferences_v2921"/);
  assert.match(profile, /publicPreferencesError/);
  assert.match(
    profile,
    /secondaryReadErrors\s*=\s*\[[\s\S]*publicPreferencesError/,
  );
  assert.match(
    profile,
    /publicPreferencesPayloadIncomplete\s*=\s*[\s\S]{0,220}!isRecord\(publicPreferencesData\)/,
  );
  assert.match(
    profile,
    /secondaryPayloadIncomplete\s*=\s*[\s\S]{0,220}publicPreferencesPayloadIncomplete/,
  );
});
