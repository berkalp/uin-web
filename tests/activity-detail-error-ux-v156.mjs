import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/app/activities/[resourceId]/page.tsx", import.meta.url),
  "utf8",
);

test("activity detail distinguishes read failures from unavailable records", () => {
  const errorBranch = source.indexOf("if (error) {");
  const missingBranch = source.indexOf("if (!data) {", errorBranch);

  assert.ok(errorBranch >= 0, "main RPC errors need a dedicated branch");
  assert.ok(missingBranch > errorBranch, "missing data must remain a separate state");
  assert.match(
    source.slice(errorBranch, missingBranch),
    /Etkinlik şu anda yüklenemedi[\s\S]*Eksik veya yanlış bilgi göstermemek[\s\S]*Yeniden dene/,
  );
  assert.match(
    source.slice(missingBranch, source.indexOf("const page = data", missingBranch)),
    /Bu etkinliği görüntüleyemezsin/,
  );
});

test("failed participant reads never render a host-only list as complete", () => {
  assert.match(source, /const peopleUnavailable = Boolean\([\s\S]*peopleResult\.error[\s\S]*\);/);
  assert.match(source, /if \(!peopleUnavailable\) \{[\s\S]*peopleById\.set\(activity\.host_user_id/);
  assert.match(source, /const visiblePeopleCount = peopleUnavailable[\s\S]*\? null[\s\S]*: participants\.length/);
  assert.match(
    source,
    /peopleUnavailable \? \([\s\S]*Katılımcı listesi şu anda yüklenemedi\.[\s\S]*Katılımcıları yeniden yükle/,
  );
});
