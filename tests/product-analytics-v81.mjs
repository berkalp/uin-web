import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260928140000_product_analytics_v81.sql");
const expectedEvents = [
  "common_card_viewed",
  "intent_created",
  "collaboration_requested",
  "social_plan_created",
  "social_plan_completed",
  "experience_created",
];

for (const event of expectedEvents) assert.match(migration, new RegExp(`'${event}'`));
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on public\.product_analytics_events_v81 from public, anon, authenticated/i);
assert.match(migration, /entry\.key in \('source', 'flow', 'content_type', 'action_type'\)/);
for (const forbidden of ["message_content", "notes", "search_query", "ip_address", "device_id"]) {
  assert.doesNotMatch(migration, new RegExp(`\\b${forbidden}\\b`, "i"));
}

const sources = new Map([
  ["src/components/analytics/ProductAnalyticsView.tsx", "common_card_viewed"],
  ["src/components/intentions/CommonPersonalIntentForm.tsx", "intent_created"],
  ["src/components/seeds/CollaborationProposal.tsx", "collaboration_requested"],
  ["src/components/intentions/CommonTargetEventForm.tsx", "social_plan_created"],
  ["src/components/plans/PlanCompletionReview.tsx", "social_plan_completed"],
  ["src/components/seeds/SeedExperienceEditor.tsx", "experience_created"],
  ["src/app/api/ideas/actions/route.ts", "experience_created"],
]);
for (const [path, event] of sources) assert.match(read(path), new RegExp(`"${event}"`), `${event} missing from ${path}`);
const completionSource = read("src/components/plans/PlanCompletionReview.tsx");
assert.equal((completionSource.match(/"social_plan_completed"/g) || []).length, 1, "completion event must only be emitted once");
console.log("product analytics v81 source checks passed");