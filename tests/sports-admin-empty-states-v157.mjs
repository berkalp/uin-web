import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("sports pages explain successful empty catalogue results without extra reads", () => {
  const pages = [
    {
      path: "src/app/sports/page.tsx",
      rpc: "get_sport_branches_v47",
      emptyMessage: "Henüz gösterilecek spor branşı yok",
    },
    {
      path: "src/app/sports/[sportSlug]/page.tsx",
      rpc: "get_sport_leagues_v47",
      emptyMessage: "Gösterilecek aktif lig bulunamadı",
    },
    {
      path: "src/app/sports/[sportSlug]/[leagueSlug]/page.tsx",
      rpc: "get_sport_teams_v47",
      emptyMessage: "Gösterilecek aktif takım bulunamadı",
    },
  ];

  for (const { path, rpc, emptyMessage } of pages) {
    const page = source(path);
    assert.match(page, /items\.length===0/);
    assert.match(page, new RegExp(emptyMessage));
    assert.equal((page.match(/\.rpc\(/g) ?? []).length, 1, `${path} must keep one RPC`);
    assert.match(page, new RegExp(rpc));
  }

  assert.doesNotMatch(pages.slice(1).map(({ path }) => source(path)).join("\n"), /notFound\(/);
});

test("league team cards open their club profile", () => {
  const page = source("src/app/sports/[sportSlug]/[leagueSlug]/page.tsx");

  assert.match(page, /Array\.isArray\(data\)&&data\.every\(isSportTeamCard\)/);
  assert.match(page, /readFailed\?[^:]*Takımlar şu anda yüklenemedi/s);
  assert.match(page, /`\/clubs\/\$\{encodeURIComponent\(item\.canonical_target_id\)\}`/);
  assert.doesNotMatch(page, /`\/intentions\/\$\{encodeURIComponent\(item\.canonical_target_id\)\}`/);
});

test("admin dashboard hides summary counters after a failed summary read", () => {
  const page = source("src/app/admin/page.tsx");
  const overviewStart = page.indexOf('{!summaryUnavailable && <section className="mt-8">');
  const usersCard = page.indexOf('label="Users"', overviewStart);

  assert.match(page, /const summaryReadError = getAdminArrayReadError\([\s\S]*summaryError/);
  assert.match(page, /const summaryUnavailable = Boolean\([\s\S]*summaryReadError \|\| !summary/);
  assert.match(page, /\{summaryUnavailable && \(/);
  assert.ok(overviewStart >= 0, "summary cards need an error guard");
  assert.ok(usersCard > overviewStart, "summary cards must remain inside the guard");
  assert.doesNotMatch(page, /waiting Â·/);
  assert.match(page, /waiting ·/);
});
