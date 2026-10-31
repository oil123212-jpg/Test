import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../scripts/serve.mjs';
let temp, root, server, address;
before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'momo-server-')); root = join(temp, 'dist'); await mkdir(root);
  await writeFile(join(root, 'index.html'), '<h1>Momo</h1>');
  await writeFile(join(root, 'capture-worklet.js'), '/* worklet */');
  await writeFile(join(temp, 'outside.txt'), 'private');
  await symlink(join(temp, 'outside.txt'), join(root, 'outside.txt'));
  server = createAppServer(root); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  address = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } await rm(temp, { recursive:true, force:true }); });
test('serves the entrypoint with production security headers', async () => {
  const res = await fetch(address); assert.equal(res.status, 200); assert.equal(await res.text(), '<h1>Momo</h1>');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.equal(res.headers.get('permissions-policy'), 'microphone=(self), camera=()');
});
test('healthcheck responds without authentication or caching', async () => {
  const res = await fetch(address+'/health'); assert.equal(res.status, 200); assert.deepEqual(await res.json(), {status:'ok'});
  assert.equal(res.headers.get('cache-control'), 'no-store');
});
test('worklet has an executable MIME type and is revalidated', async () => {
  const res = await fetch(address+'/capture-worklet.js'); assert.match(res.headers.get('content-type'), /javascript/); assert.equal(res.headers.get('cache-control'), 'no-cache');
});
test('HEAD serves metadata without a response body', async () => {
  const res = await fetch(address, {method:'HEAD'}); assert.equal(res.status, 200); assert.equal(await res.text(), ''); assert.ok(Number(res.headers.get('content-length'))>0);
});
test('rejects upload methods', async () => { assert.equal((await fetch(address, {method:'POST',body:'synthetic'})).status, 405); });
test('does not expose missing, hidden or symlinked files', async () => {
  for (const path of ['/not-found','/.env','/outside.txt','/%2e%2e%2foutside.txt']) assert.equal((await fetch(address+path)).status, 404);
});
test('handles invalid URL encoding', async () => { assert.equal((await fetch(address+'/%ZZ')).status, 400); });
