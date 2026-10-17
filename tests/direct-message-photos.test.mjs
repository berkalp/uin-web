import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/services/directMessagePhotoService.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
function setup() {
  const state = { uploads: [], rpcs: [], uploadError: null, rpcError: null, user: { id: 'sender' } };
  const bucket = { upload: async (...args) => { state.uploads.push(args); return { error: state.uploadError }; }, remove: async () => ({ error: null }) };
  const client = { auth: { getUser: async () => ({ data: { user: state.user }, error: null }) }, storage: { from: name => { assert.equal(name, 'direct-message-photos'); return bucket; } }, rpc: async (...args) => { state.rpcs.push(args); return { data: 'message', error: state.rpcError }; } };
  const exports = {};
  vm.runInNewContext(source, { exports, Uint8Array, URL: { createObjectURL: () => 'blob:local-preview' }, crypto: { randomUUID: () => 'photo-id' }, require: name => {
    if (name === '@/utils/supabase/client') return { supabase: client };
    throw new Error(name);
  } });
  return { api: exports, state };
}
const screenshot = () => new File([png], 'screen.png', { type: 'image/png' });

test('prepare previews locally and identifies actual PNG content', async () => {
  const { api, state } = setup();
  const photo = await api.prepareDirectPhoto(screenshot());
  assert.equal(photo.preview, 'blob:local-preview');
  assert.equal(photo.mime, 'image/png');
  assert.equal(state.uploads.length, 0);
});

test('unsupported disguised files and files over 10 MB are rejected', async () => {
  const { api } = setup();
  await assert.rejects(api.prepareDirectPhoto(new File(['<svg/>'], 'fake.png', { type: 'image/png' })), /JPEG, PNG/);
  await assert.rejects(api.prepareDirectPhoto(new File([new Uint8Array(10485761)], 'huge.png')), /10 MB/);
});

test('photo-only send preserves private upload path and retry does not upload again', async () => {
  const { api, state } = setup();
  const photo = await api.prepareDirectPhoto(screenshot());
  state.rpcError = { message: 'connection lost' };
  await assert.rejects(api.sendDirectPhoto('conversation', '', photo), /connection lost/);
  state.rpcError = null;
  await api.sendDirectPhoto('conversation', '', photo);
  assert.equal(state.uploads.length, 1);
  assert.equal(state.uploads[0][2].upsert, false);
  assert.equal(state.rpcs[1][1].p_storage_path, 'conversation/sender/photo-id.png');
  assert.equal(state.rpcs[1][1].p_body, '');
});

test('lost upload response accepts only duplicate-object responses on retry', async () => {
  const { api, state } = setup();
  const photo = await api.prepareDirectPhoto(screenshot());
  state.uploadError = { statusCode: '403' };
  await assert.rejects(api.sendDirectPhoto('conversation', '', photo), /yüklenemedi/);
  assert.equal(state.rpcs.length, 0);
  state.uploadError = { statusCode: '400', code: 'ResourceAlreadyExists' };
  await api.sendDirectPhoto('conversation', '', photo);
  assert.equal(state.uploads[0][0], state.uploads[1][0]);
  assert.equal(state.rpcs.length, 1);
});

test('no session means no upload', async () => {
  const { api, state } = setup();
  const photo = await api.prepareDirectPhoto(screenshot());
  state.user = null;
  await assert.rejects(api.sendDirectPhoto('conversation', '', photo), /Giriş/);
  assert.equal(state.uploads.length, 0);
});
