import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/utils/eventSubmission.ts", 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { module, exports: module.exports });
const { EventSubmission, duplicateCardEventError, DuplicateCardEventError } = module.exports;
test('synchronous double submission is rejected; failed attempts can retry with the same key', () => {
  let next = 0;
  const submission = new EventSubmission(() => String(++next));
  assert.equal(submission.begin(), true);
  assert.equal(submission.begin(), false);
  const first = submission.requestId({ card: 'a', date: '2026-10-26' });
  submission.end();
  assert.equal(submission.begin(), true);
  assert.equal(submission.requestId({ card: 'a', date: '2026-10-26' }), first);
  assert.notEqual(submission.requestId({ card: 'a', date: '2026-10-27' }), first);
  const independent = new EventSubmission(() => String(++next));
  assert.notEqual(independent.requestId({ card: 'a', date: '2026-10-26' }), first);
});
test('duplicate details expose only validated resource identifiers', () => {
  const id = '01a7878f-7c8e-4509-859a-c0b79fc6b9e1';
  const duplicate = duplicateCardEventError({ details: JSON.stringify({ kind: 'duplicate_card_event', intent_id: id, plan_id: id }) });
  assert.ok(duplicate instanceof DuplicateCardEventError);
  assert.equal(duplicate.intentId, id);
  assert.equal(duplicate.planId, id);
  for (const details of ['broken', '{}', JSON.stringify({ kind: 'duplicate_card_event', intent_id: '../other' })]) {
    assert.equal(duplicateCardEventError({ details }), null);
  }
  assert.equal(duplicateCardEventError(new Error('Network failed')), null);
});
