import assert from 'node:assert/strict';
import { request } from 'node:http';
import { test } from 'node:test';
import { serveArchives } from '../lib/serve.mjs';

const files = new Map([['overview-preset.zip', Buffer.from('preset-bytes')]]);

function get(port, path, { method = 'GET', host = `127.0.0.1:${port}` } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: { host } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves only the known archives under the random token, on loopback', async (t) => {
  const server = await serveArchives(files);
  t.after(() => server.close());
  const url = new URL(server.url('overview-preset.zip'));
  assert.equal(url.hostname, '127.0.0.1');
  const token = url.pathname.split('/')[1];
  assert.match(token, /^[0-9a-f]{64}$/);

  const ok = await get(server.port, url.pathname);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['content-type'], 'application/zip');
  assert.equal(ok.body.toString(), 'preset-bytes');

  assert.equal((await get(server.port, `/${'0'.repeat(64)}/overview-preset.zip`)).status, 404);
  assert.equal((await get(server.port, '/overview-preset.zip')).status, 404);
  assert.equal((await get(server.port, `/${token}/other.zip`)).status, 404);
  assert.equal((await get(server.port, `/${token}/../${token}/overview-preset.zip`)).status, 404);
  assert.equal((await get(server.port, url.pathname, { method: 'POST' })).status, 405);
  assert.equal((await get(server.port, url.pathname, { host: `evil.example:${server.port}` })).status, 400);
  assert.equal((await get(server.port, url.pathname, { host: `localhost:${server.port}` })).status, 400);
});

test('each run gets a different token', async () => {
  const a = await serveArchives(files);
  const b = await serveArchives(files);
  assert.notEqual(a.url('x'), b.url('x'));
  await Promise.all([a.close(), b.close()]);
});

test('stops accepting connections once closed', async () => {
  const server = await serveArchives(files);
  await server.close();
  await assert.rejects(get(server.port, new URL(server.url('overview-preset.zip')).pathname), { code: 'ECONNREFUSED' });
});

test('shuts itself down after the timeout', async () => {
  const server = await serveArchives(files, { timeoutMs: 50 });
  await new Promise((resolve) => setTimeout(resolve, 200));
  await assert.rejects(get(server.port, '/'), { code: 'ECONNREFUSED' });
});
