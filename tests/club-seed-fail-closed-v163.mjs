import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("club profiles distinguish failed reads, missing cards, and malformed payloads", () => {
  const club = source("src/app/clubs/[targetId]/page.tsx");
  const failedProfile = club.indexOf("if (profileError)");
  const missingProfile = club.indexOf("if (profileData == null)", failedProfile);

  assert.ok(failedProfile >= 0 && missingProfile > failedProfile);
  assert.match(club.slice(failedProfile, missingProfile), /return unavailable/);
  assert.doesNotMatch(club.slice(failedProfile, missingProfile), /notFound\(\)/);
  assert.match(club, /const profile = parseClubProfile\(profileData\)/);
  assert.match(club, /if \(!profile\)[\s\S]*return unavailable/);
  assert.match(
    club,
    /if \(contentTypesError \|\| !Array\.isArray\(contentTypesData\)\)[\s\S]*return unavailable/,
  );
  assert.match(club, /if \(!rawContentType\)[\s\S]*return unavailable/);
  assert.match(club, /if \(!contentType\)[\s\S]*return unavailable/);
  assert.match(club, /if \(contentType\.base_kind !== "club"\) notFound\(\)/);
  assert.match(club, /supabase\.rpc\("is_admin"\)/);
  assert.doesNotMatch(club, /get_admin_role/);
  assert.match(
    club,
    /if \(adminError \|\| typeof isAdmin !== "boolean"\)[\s\S]*return unavailable/,
  );
  assert.match(club, /isAdmin=\{isAdmin === true\}/);
  assert.match(club, /PageDataUnavailable/);
});

test("seed editing keeps successful absence as 404 and fails closed on reads", () => {
  const edit = source("src/app/seeds/[seedId]/edit/page.tsx");
  const failedRead = edit.indexOf("if (readError)");
  const missingSeed = edit.indexOf("if (seedResult.data.length === 0)", failedRead);

  assert.ok(failedRead >= 0 && missingSeed > failedRead);
  assert.match(edit.slice(failedRead, missingSeed), /return unavailable/);
  assert.doesNotMatch(edit.slice(failedRead, missingSeed), /notFound\(\)/);
  assert.match(
    edit,
    /const readError =[\s\S]*seedResult\.error[\s\S]*seedTypeResult\.error[\s\S]*catalogueIdentityResult\.error[\s\S]*reminderResult\.error/,
  );
  assert.match(edit, /if \(!Array\.isArray\(seedResult\.data\)\)[\s\S]*return unavailable/);
  assert.match(edit, /if \(seedResult\.data\.length === 0\)[\s\S]*notFound\(\)/);
  assert.match(
    edit,
    /seedResult\.data\.length !== 1 \|\| !isSeedRecord\(seedResult\.data\[0\]\)[\s\S]*return unavailable/,
  );
  assert.match(edit, /rawSeed\.seed_id !== seedId[\s\S]*return unavailable/);
  assert.match(edit, /seedTypeResult\.data\.length === 0/);
  assert.match(
    edit,
    /isNullableString\(value\.suggested_activity_id\)[\s\S]*isNullableString\(value\.suggested_category_name\)/,
  );
  assert.match(edit, /userError && !isAuthSessionMissingError\(userError\)/);
  assert.match(edit, /PageDataUnavailable/);
});

test("past-experience subjects distinguish query failure from a missing subject", () => {
  const past = source("src/app/seeds/subjects/[subjectId]/past/page.tsx");
  const failedRead = past.indexOf("if (error)");
  const missingSubject = past.indexOf("if (data == null)", failedRead);
  const malformedSubject = past.indexOf(
    "if (!isSubjectDetail(data, subjectId))",
    missingSubject,
  );

  assert.ok(failedRead >= 0 && missingSubject > failedRead);
  assert.match(past.slice(failedRead, missingSubject), /return unavailable/);
  assert.doesNotMatch(past.slice(failedRead, missingSubject), /notFound\(\)/);
  assert.match(past.slice(missingSubject, malformedSubject), /notFound\(\)/);
  assert.match(past.slice(malformedSubject), /return unavailable/);
  assert.match(past, /if \(!isValidUuid\(subjectId\)\)[\s\S]*notFound\(\)/);
  assert.match(past, /subject\.catalog_item_id !== expectedSubjectId/);
  assert.match(past, /userError && !isAuthSessionMissingError\(userError\)/);
  assert.match(past, /PageDataUnavailable/);
});
