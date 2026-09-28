import test from "node:test";
import assert from "node:assert/strict";

const baseUrl = process.env.UIN_BASE_URL || "https://uin.onl";
const targets = [
  { id: "9b6a9ca9-5c57-42a5-a0bb-ac68c829cf20", title: "Finding The Mother Tree", minPeople: 2 },
  { id: "244ca65b-0c40-44b8-81db-bc7f5358c395", title: "Eskişehir", minPeople: 2 },
];

async function cardDetail(id) {
  const response = await fetch(`${baseUrl}/api/ideas/${id}`);
  assert.equal(response.status, 200, `card API failed for ${id}`);
  return response.json();
}

test("common-card counters use the same visible rows as their detail lists", async () => {
  for (const target of targets) {
    const detail = await cardDetail(target.id);
    assert.equal(detail.card.title, target.title);
    assert.equal(Number(detail.card.intent_people_count), detail.people.length);
    assert.equal(Number(detail.card.experience_people_count), detail.reviews.length);
    assert.equal(Number(detail.card.social_intent_count), detail.events.filter((event) => event.event_state === "active").length);
    assert.ok(detail.people.length >= target.minPeople, `${target.title} should expose multiple user scenarios`);
    assert.equal(new Set(detail.people.map((person) => person.user_id)).size, detail.people.length);
    assert.ok(detail.people.every((person) => person.source_kind === "seed" || person.source_kind === "personal"));
  }
});

test("collaboration inbox requires an authenticated web session", async () => {
  const response = await fetch(`${baseUrl}/collaboration-suggestions`, { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(response.status));
  const location = response.headers.get("location") || "";
  assert.ok(location === "/" || location.endsWith("/"));
});
