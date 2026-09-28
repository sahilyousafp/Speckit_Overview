import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { planFor } from '../lib/main.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'speckit-overview-plan-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

function project(name, { preset, extension }) {
  const root = join(tmp, name);
  mkdirSync(join(root, '.specify', 'presets'), { recursive: true });
  mkdirSync(join(root, '.specify', 'extensions'), { recursive: true });
  if (preset) writeFileSync(join(root, '.specify', 'presets', '.registry'), JSON.stringify({ presets: { overview: { version: preset } } }));
  if (extension) {
    writeFileSync(join(root, '.specify', 'extensions', '.registry'), JSON.stringify({ extensions: { overview: { version: extension } } }));
  }
  return root;
}

test('plans a fresh install, a partial install and an upgrade', () => {
  assert.deepEqual(planFor(project('fresh', {}), '1.1.0'), {
    installed: { preset: null, extension: null },
    preset: 'install',
    extension: 'install',
  });
  const partial = planFor(project('partial', { preset: '1.1.0' }), '1.1.0');
  assert.equal(partial.preset, 'current');
  assert.equal(partial.extension, 'install');
  const upgrade = planFor(project('upgrade', { preset: '1.0.0', extension: '1.0.0' }), '1.1.0');
  assert.equal(upgrade.preset, 'upgrade');
  assert.equal(upgrade.extension, 'upgrade');
});

test('refuses to downgrade a newer install', () => {
  assert.throws(() => planFor(project('newer', { preset: '1.1.0', extension: '1.2.0' }), '1.1.0'), {
    name: 'UserError',
    message: /already has speckit-overview v1\.2\.0, newer than this installer \(v1\.1\.0\)/,
  });
});
