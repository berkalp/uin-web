import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadComponent(file) {
  const source = fs.readFileSync(file, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const cjsModule = { exports: {} };
  vm.runInNewContext(output, {
    exports: cjsModule.exports,
    module: cjsModule,
    require,
  });
  return { component: cjsModule.exports.default, source };
}

test("rating badges are presentational and do not issue one detail request per card", () => {
  const { component: CardRatingBadge, source } = loadComponent(
    "src/components/cards/CardRatingBadge.tsx"
  );

  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /\/api\/ideas\//);
  assert.doesNotMatch(source, /useEffect|useState/);

  const unknown = renderToStaticMarkup(
    React.createElement(CardRatingBadge, { targetId: "target-1" })
  );
  assert.match(unknown, /Puan · —/);
  assert.doesNotMatch(unknown, /Henüz puan yok/);
  assert.doesNotMatch(unknown, />0(?:<|\/10)/);

  const unrated = renderToStaticMarkup(
    React.createElement(CardRatingBadge, {
      averageRating: null,
      ratingCount: 0,
    })
  );
  assert.match(unrated, /Henüz puan yok/);
  assert.doesNotMatch(unrated, /Puan · —/);

  const rated = renderToStaticMarkup(
    React.createElement(CardRatingBadge, {
      averageRating: 8.4,
      ratingCount: 7,
    })
  );
  assert.match(rated, /8,4\/10 · 7/);
  assert.doesNotMatch(rated, /Puan · —|Henüz puan yok/);

  const personalOnly = renderToStaticMarkup(
    React.createElement(CardRatingBadge, {
      personalRating: 9,
      targetId: "target-1",
    })
  );
  assert.match(personalOnly, /Puanım 9\/10/);
  assert.match(personalOnly, /Ortalama · —/);
  assert.doesNotMatch(personalOnly, /Henüz puan yok/);
});

test("community counters only request detail after an explicit view selection", () => {
  const source = fs.readFileSync(
    "src/components/seeds/CanonicalTargetPeople.tsx",
    "utf8"
  );

  assert.match(
    source,
    /!hasError\s*&&\s*!currentDetail\s*&&\s*view\s*!==\s*null/
  );
  assert.doesNotMatch(source, /!hasInitial\s*\|\|\s*view\s*!==\s*null/);
  assert.doesNotMatch(source, /people\.filter[\s\S]*\.length/);
  assert.doesNotMatch(source, /reviews\.length/);
  assert.match(source, /"Göster"/);
});
