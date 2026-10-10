import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);

function transpile(file) {
  return ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
}

function loadCommonJs(file, mocks, globals = {}) {
  const cjsModule = { exports: {} };
  vm.runInNewContext(transpile(file), {
    Date,
    Intl,
    URLSearchParams,
    exports: cjsModule.exports,
    module: cjsModule,
    require: (name) => mocks[name] ?? require(name),
    ...globals,
  });
  return cjsModule.exports;
}

const countUtils = loadCommonJs("src/utils/communityCounts.ts", {});

function renderCounter({ stateValues, props, fetchImpl }) {
  let stateIndex = 0;
  let effect = null;
  const stateUpdates = [];
  const component = loadCommonJs("src/components/seeds/CanonicalTargetPeople.tsx", {
    react: {
      ...React,
      useEffect: (callback) => {
        effect = callback;
      },
      useState: (initial) => {
        const index = stateIndex++;
        const value = index < stateValues.length ? stateValues[index] : initial;
        return [value, (next) => stateUpdates.push({ index, next })];
      },
    },
    "@/components/cards/PersonalWishSummary": {
      wishWords: () => ({
        action: "YAP",
        doers: "Yapanlar",
        done: "Yaptım",
        event: "Etkinlik düzenle",
        want: "Yapmak istiyorum",
        wanting: "Yapmak isteyenler",
      }),
    },
    "@/components/ideas/TopicCardModal": {
      __esModule: true,
      default: ({ selected }) =>
        React.createElement("aside", { "data-view": selected.initialView }),
    },
    "@/utils/communityCounts": countUtils,
    "@/utils/supabase/client": {
      supabase: {
        rpc: async () => {
          throw new Error("Target kimliği varken seed çözümleme çağrılmamalı");
        },
      },
    },
    "@/utils/targetLanguage": {
      targetLanguage: () => ({
        action: "YAP",
        done: "Yapanlar",
        icon: "✨",
        want: "Yapmak isteyenler",
      }),
    },
  }, { fetch: fetchImpl }).default;

  const tree = component(props);
  const html = renderToStaticMarkup(tree);
  return { effect, html, stateUpdates, tree };
}

test("authoritative counters preserve zero and reject incomplete values", () => {
  assert.deepEqual(
    Array.from(countUtils.parseCommunityCounts(0, "12", 3)),
    [0, 12, 3]
  );
  for (const values of [
    [null, 2, 3],
    [1, undefined, 3],
    [1, 2, ""],
    [1, -2, 3],
    [1, 2.5, 3],
    [1, 2, Number.NaN],
  ]) {
    assert.equal(countUtils.parseCommunityCounts(...values), null);
  }
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(countUtils.initialCommunityCountProps("4", 5, 0))
    ),
    { initialCounts: [4, 5], socialCount: 0 }
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(countUtils.initialCommunityCountProps(null, 5, 0))
    ),
    {}
  );
});

test("authoritative counters render immediately without a mount request", () => {
  let fetchCalls = 0;
  const rendered = renderCounter({
    stateValues: [null, "target-1", false, 0, null],
    props: {
      initialCounts: [12, 34],
      socialCount: 5,
      targetId: "target-1",
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("Mount request yapılmamalı");
    },
  });

  assert.match(rendered.html, />12</);
  assert.match(rendered.html, />34</);
  assert.match(rendered.html, />5</);
  assert.doesNotMatch(rendered.html, />…</);
  rendered.effect?.();
  assert.equal(fetchCalls, 0);
});

test("a metric click requests detail lazily so the modal can open", async () => {
  let fetchCalls = 0;
  const detail = {
    card: { catalog_item_id: "catalog-1", cover_url: null, subtitle: null, title: "Kart" },
    communityCounts: [12, 34, 5],
    events: [],
    people: [],
    reviews: [],
  };
  const rendered = renderCounter({
    stateValues: [null, "target-1", false, 0, "want"],
    props: {
      initialCounts: [12, 34],
      socialCount: 5,
      targetId: "target-1",
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        json: async () => detail,
        ok: true,
      };
    },
  });

  rendered.effect?.();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCalls, 1);
  assert.ok(
    rendered.stateUpdates.some(
      (update) => update.index === 0 && update.next === detail
    ),
    "lazy detail response should populate the modal payload"
  );

  const opened = renderCounter({
    stateValues: [
      detail,
      { sourceKey: "target:target-1", targetId: "target-1" },
      false,
      0,
      "want",
    ],
    props: {
      initialCounts: [12, 34],
      socialCount: 5,
      targetId: "target-1",
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("Loaded detail must be reused");
    },
  });
  opened.effect?.();
  assert.match(opened.html, /data-view="want"/);
  assert.equal(fetchCalls, 1);
});

test("cards without initial counters wait for an explicit metric click", async () => {
  let fetchCalls = 0;
  const rendered = renderCounter({
    stateValues: [null, "target-1", false, 0, null],
    props: { targetId: "target-1" },
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        json: async () => ({
          card: { catalog_item_id: "catalog-1", cover_url: null, subtitle: null, title: "Kart" },
          communityCounts: [1, 2, 3],
          events: [],
          people: [],
          reviews: [],
        }),
        ok: true,
      };
    },
  });

  rendered.effect?.();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCalls, 0);
  assert.match(rendered.html, /Göster/);
  assert.doesNotMatch(rendered.html, />0</);
});

test("a malformed detail response cannot turn missing counters into zeros", async () => {
  let fetchCalls = 0;
  const rendered = renderCounter({
    stateValues: [null, "target-1", false, 0, "want"],
    props: { targetId: "target-1" },
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        json: async () => ({
          card: { catalog_item_id: "catalog-1", cover_url: null, subtitle: null, title: "Kart" },
          events: [],
          people: [],
          reviews: [],
        }),
        ok: true,
      };
    },
  });

  rendered.effect?.();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCalls, 1);
  assert.ok(
    rendered.stateUpdates.some(
      (update) => update.index === 2 && update.next === "target:target-1"
    ),
    "missing counters should put the component in an explicit error state"
  );
  assert.equal(
    rendered.stateUpdates.some((update) => update.index === 0),
    false,
    "malformed detail must not be accepted as an authoritative zero payload"
  );
});

test("a failed lazy detail request waits for an explicit retry", async () => {
  let fetchCalls = 0;
  const props = {
    initialCounts: [2, 1],
    socialCount: 0,
    targetId: "target-1",
  };
  const fetchImpl = async () => {
    fetchCalls += 1;
    throw new Error("temporary failure");
  };
  const first = renderCounter({
    stateValues: [null, "target-1", false, 0, "want"],
    props,
    fetchImpl,
  });
  first.effect?.();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCalls, 1);
  assert.ok(
    first.stateUpdates.some(
      (update) => update.index === 2 && update.next === "target:target-1"
    )
  );

  const failedRender = renderCounter({
    stateValues: [null, "target-1", "target:target-1", 0, "want"],
    props,
    fetchImpl,
  });
  failedRender.effect?.();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCalls, 1, "failure must not start an automatic retry loop");
});

test("a successful card mutation refreshes parent counters without refetching on every close", () => {
  const source = fs.readFileSync("src/components/seeds/CanonicalTargetPeople.tsx", "utf8");
  assert.match(source, /onChanged=\{\(\) => setRetry\(\(current\) => current \+ 1\)\}/);
  assert.doesNotMatch(source, /onClose=\{\(\) => \{\s*setView\(null\);\s*setRetry/);
});
