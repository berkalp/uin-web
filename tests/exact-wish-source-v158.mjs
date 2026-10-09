import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/ideas/InlineTopicSearch.tsx", import.meta.url),
  "utf8",
);

test("library cancellation resolves the viewer's exact active wish source", () => {
  const start = source.indexOf("async function cancelWish");
  const end = source.indexOf("function openCard", start);
  const cancelWish = source.slice(start, end);

  assert.ok(start >= 0 && end > start, "cancelWish must remain present");
  assert.match(cancelWish, /get_uin_card_people_v81/);
  assert.match(cancelWish, /p_group:\s*["']intent["']/);
  assert.match(cancelWish, /row\.user_id===viewerId/);
  assert.match(cancelWish, /row\.source_kind===["']personal["']\|\|row\.source_kind===["']seed["']/);
  assert.match(cancelWish, /ownRow\?\.source_target_id/);
  assert.match(cancelWish, /archive_my_common_wish_v73/);
  assert.match(cancelWish, /p_target_id:wishTargetId/);
  assert.doesNotMatch(
    cancelWish,
    /archive_my_common_wish_v73[\s\S]{0,100}p_target_id:item\.canonical_target_id/,
  );
});

test("cancellation fails closed when an exact source cannot be verified", () => {
  const start = source.indexOf("async function cancelWish");
  const end = source.indexOf("function openCard", start);
  const cancelWish = source.slice(start, end);

  assert.match(cancelWish, /if\(!wishTargetId\)throw new Error/);
  assert.ok(
    cancelWish.indexOf("if(!wishTargetId)throw new Error") <
      cancelWish.indexOf('archive_my_common_wish_v73'),
  );
});
