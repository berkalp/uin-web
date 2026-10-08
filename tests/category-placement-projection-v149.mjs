import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("category cards fetch only metadata fields used for sorting and badges", () => {
  const route = fs.readFileSync("src/app/api/ideas/category-cards/route.ts", "utf8");

  assert.match(route, /const CATEGORY_PLACEMENT_SELECT=/);
  for (const projection of [
    "content_type_id:metadata->>content_type_id",
    "imdb_top_250_rank:metadata->>imdb_top_250_rank",
    "book_lists:metadata->book_lists",
    "book_list_ranks:metadata->book_list_ranks",
    "book_awards:metadata->book_awards",
    "series_lists:metadata->series_lists",
    "series_list_ranks:metadata->series_list_ranks",
    "series_awards:metadata->series_awards",
  ]) assert.ok(route.includes(projection), `missing projection: ${projection}`);
  assert.match(route, /readImdbMetadata\(item\)/);
  assert.match(route, /readBookListMetadata\(item\)/);
  assert.match(route, /readSeriesListMetadata\(item\)/);
  assert.doesNotMatch(route, /select\([^\n]*creator_name,cover_url,metadata["`]\)/);
  assert.doesNotMatch(route, /item\?\.metadata/);
  assert.doesNotMatch(route, /parentItem\.metadata/);
});
