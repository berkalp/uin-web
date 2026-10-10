import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const adminRoot = path.join(root, "src", "app", "admin");

function source(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function pageFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return pageFiles(absolute);
    return entry.name === "page.tsx" ? [absolute] : [];
  });
}

test("every admin page RPC read validates its payload before presenting data", () => {
  const unguarded = pageFiles(adminRoot)
    .filter((file) => readFileSync(file, "utf8").includes(".rpc("))
    .filter((file) => !/getAdmin(?:Array|Record|Count)ReadError/.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file));

  assert.deepEqual(unguarded, []);
});

test("shared admin read guards reject malformed containers and invalid counts", () => {
  const helper = source("src/app/admin/_lib/read-state.ts");

  assert.match(helper, /Array\.isArray\(data\)/);
  assert.match(helper, /returned incomplete data/);
  assert.match(helper, /Number\.isSafeInteger\(parsed\) && parsed >= 0/);
  assert.match(helper, /countRowFields\.some/);
  assert.match(helper, /countFields\.some/);
  assert.match(helper, /!Array\.isArray\(record\[field\]\)/);
  assert.match(helper, /if \(collection === null\) \{\s*return true;/);
  assert.doesNotMatch(helper, /record\[field\] !== null/);
});

test("admin list and analytics pages hide result summaries after failed reads", () => {
  for (const relativePath of [
    "src/app/admin/audit/page.tsx",
    "src/app/admin/intents/page.tsx",
    "src/app/admin/plans/page.tsx",
    "src/app/admin/requests/page.tsx",
    "src/app/admin/users/page.tsx",
  ]) {
    const page = source(relativePath);
    assert.match(page, /\{!readError && \(\s*<section className="mt-6">/);
    assert.doesNotMatch(page, /\{error && \(\s*<div className="mt-6 rounded-2xl/);
  }

  const analytics = source("src/app/admin/analytics/page.tsx");
  assert.match(analytics, /\{!error && <>/);
});

test("partial admin editors do not open with missing source data", () => {
  const seedCatalogue = source("src/app/admin/seed-catalogue/page.tsx");
  const sports = source("src/app/admin/sports/page.tsx");
  const welcome = source("src/app/admin/welcome-message/page.tsx");

  assert.match(seedCatalogue, /const readError = firstAdminReadError/);
  assert.match(seedCatalogue, /\{readError \? \(/);
  assert.match(seedCatalogue, /getAdminArrayReadError\(\s*seedTypesResponse\.data/);
  assert.match(sports, /getAdminRecordReadError\(\s*hierarchyData/);
  assert.match(sports, /\{!readError && \(/);
  assert.match(welcome, /readError \? \(/);
  assert.match(welcome, /<WelcomeMessageManager initialSettings=\{settings\} \/>/);
});

test("admin user read failures are not reported as missing users", () => {
  for (const relativePath of [
    "src/app/admin/users/[userId]/page.tsx",
    "src/app/admin/users/[userId]/edit/page.tsx",
  ]) {
    const page = source(relativePath);
    const guard = page.indexOf("if (profileReadError)") >= 0
      ? page.indexOf("if (profileReadError)")
      : page.indexOf("if (readError)");
    const throwIndex = page.indexOf("throw new Error", guard);

    assert.ok(guard >= 0, `${relativePath} must validate the detail payload`);
    assert.ok(throwIndex > guard, `${relativePath} must surface read failures`);
  }
});
