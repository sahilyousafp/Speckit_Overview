import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, beforeEach, test } from 'node:test';
import { ARCHIVE_NAMES, MANIFEST_FILE } from '../lib/archives.mjs';
import { loadVerifiedArchives } from '../lib/integrity.mjs';
import { build } from '../scripts/build.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'speckit-overview-integrity-'));
const dist = join(tmp, 'dist');
after(() => rmSync(tmp, { recursive: true, force: true }));
beforeEach(() => build({ outDir: dist }));

test('loads archives whose checksums match', () => {
  const { version, archives } = loadVerifiedArchives(dist);
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual([...archives.keys()], ARCHIVE_NAMES);
  for (const name of ARCHIVE_NAMES) assert.deepEqual(archives.get(name), readFileSync(join(dist, name)));
});

test('refuses an archive that was modified after the build', () => {
  const file = join(dist, ARCHIVE_NAMES[1]);
  const data = readFileSync(file);
  data[data.length >> 1] ^= 0xff;
  writeFileSync(file, data);
  assert.throws(() => loadVerifiedArchives(dist), /Integrity check failed for overview-extension\.zip/);
});

test('refuses a manifest that lists unexpected files or bad checksums', () => {
  const manifestPath = join(dist, MANIFEST_FILE);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  writeFileSync(manifestPath, JSON.stringify({ ...manifest, files: { ...manifest.files, 'evil.zip': 'a'.repeat(64) } }));
  assert.throws(() => loadVerifiedArchives(dist), /does not list the expected archives/);

  writeFileSync(manifestPath, JSON.stringify({ ...manifest, files: { ...manifest.files, [ARCHIVE_NAMES[0]]: 'nope' } }));
  assert.throws(() => loadVerifiedArchives(dist), /invalid checksum/);
});

test('reports a missing archive or manifest clearly', () => {
  unlinkSync(join(dist, ARCHIVE_NAMES[0]));
  assert.throws(() => loadVerifiedArchives(dist), /Package is incomplete: cannot read overview-preset\.zip/);
  unlinkSync(join(dist, MANIFEST_FILE));
  assert.throws(() => loadVerifiedArchives(dist), /cannot read manifest\.json/);
});
