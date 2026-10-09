import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/202610090006_personal_wish_row_precedence_v154.sql", import.meta.url),
  "utf8",
);

test("personal wishes win the final per-user card row over social attendance", () => {
  assert.match(migration, /create or replace function public\.get_uin_card_people_v81/);
  assert.match(migration, /partition by projection\.user_id/);
  assert.match(
    migration,
    /case projection\.source_kind\s+when 'seed' then 0\s+when 'personal' then 1\s+else 2\s+end/,
  );
  assert.match(migration, /projection\.target_date desc nulls last/);
  assert.match(migration, /'source_target_id',selected\.source_target_id/);
});

test("the precedence repair preserves the bounded reader contract", () => {
  assert.match(migration, /get_uin_card_people_projection_v143\(array\[p_target_id\]\)/);
  assert.match(migration, /limit greatest\(1,least\(coalesce\(p_limit,50\),100\)\)/);
  assert.match(migration, /offset greatest\(coalesce\(p_offset,0\),0\)/);
  assert.match(migration, /grant execute on function public\.get_uin_card_people_v81\(uuid,text,integer,integer\) to anon,authenticated/);
});
