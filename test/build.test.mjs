import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { ARCHIVE_NAMES } from '../lib/archives.mjs';
import { build } from '../scripts/build.mjs';
import { crc32 } from '../scripts/zip.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'speckit-overview-build-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** Reads a zip produced by createZip back into { name: content }, checking every CRC. */
function readZip(buf) {
  const files = {};
  const endOffset = buf.length - 22;
  assert.equal(buf.readUInt32LE(endOffset), 0x06054b50);
  let offset = buf.readUInt32LE(endOffset + 16);
  for (let i = 0; i < buf.readUInt16LE(endOffset + 10); i++) {
    assert.equal(buf.readUInt32LE(offset), 0x02014b50);
    const crc = buf.readUInt32LE(offset + 16);
    const size = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const local = buf.readUInt32LE(offset + 42);
    const name = buf.subarray(offset + 46, offset + 46 + nameLen).toString('utf8');
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = inflateRawSync(buf.subarray(dataStart, dataStart + size));
    assert.equal(crc32(data), crc, name);
    files[name] = data.toString('utf8');
    offset += 46 + nameLen;
  }
  return files;
}

test('builds byte-identical archives on every run', () => {
  const first = build({ outDir: join(tmp, 'a') });
  const second = build({ outDir: join(tmp, 'b') });
  assert.deepEqual(first, second);
  for (const name of ARCHIVE_NAMES) {
    assert.deepEqual(readFileSync(join(tmp, 'a', name)), readFileSync(join(tmp, 'b', name)));
  }
});

test('archives hold the add-on files at the root with LF line endings', () => {
  build({ outDir: join(tmp, 'c') });
  const preset = readZip(readFileSync(join(tmp, 'c', 'overview-preset.zip')));
  const extension = readZip(readFileSync(join(tmp, 'c', 'overview-extension.zip')));
  assert.ok(preset['preset.yml'].includes('id: "overview"'));
  assert.ok('commands/speckit.overview.md' in preset);
  assert.ok(extension['extension.yml'].includes('id: overview'));
  assert.ok('commands/speckit.overview.sync.md' in extension);
  for (const content of [...Object.values(preset), ...Object.values(extension)]) assert.ok(!content.includes('\r'));
});

test('writes SHA256SUMS.txt in sha256sum format', () => {
  const { hashes } = build({ outDir: join(tmp, 'd') });
  const sums = readFileSync(join(tmp, 'd', 'SHA256SUMS.txt'), 'utf8');
  for (const [name, hash] of Object.entries(hashes)) assert.ok(sums.includes(`${hash}  ${name}\n`));
});

test('fails when a manifest version differs from package.json', () => {
  const root = join(tmp, 'mismatch');
  for (const part of ['package.json', 'preset', 'extension']) cpSync(join(ROOT, part), join(root, part), { recursive: true });
  const yml = join(root, 'extension', 'extension.yml');
  writeFileSync(yml, readFileSync(yml, 'utf8').replace(/^ {2}version: .*$/m, '  version: "0.0.1"'));
  assert.throws(() => build({ root, outDir: join(root, 'dist') }), /extension\/extension\.yml version 0\.0\.1 does not match/);
});
