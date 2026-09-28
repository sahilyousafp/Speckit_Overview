import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from '../scripts/build.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'speckit-overview-cli-'));
const pkg = join(tmp, 'pkg');
after(() => rmSync(tmp, { recursive: true, force: true }));

// Run the CLI from a copy laid out like the published package.
before(() => {
  for (const part of ['bin', 'lib', 'package.json']) cpSync(join(ROOT, part), join(pkg, part), { recursive: true });
  build({ outDir: join(pkg, 'dist') });
});

function cli(args, env = {}) {
  return spawnSync(process.execPath, [join(pkg, 'bin', 'cli.mjs'), ...args], {
    cwd: tmp,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    input: '',
  });
}

test('prints help and version', () => {
  const help = cli(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /npx speckit-overview init <name>/);
  const version = cli(['--version']);
  assert.equal(version.stdout.trim(), JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version);
});

test('usage errors exit 2', () => {
  const result = cli(['init', '../escape']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Invalid project name/);
});

test('explains how to install Spec Kit when specify is missing', () => {
  const result = cli([], { PATH: '', Path: '' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /specify\) was not found on PATH/);
  assert.match(result.stderr, /uv tool install specify-cli/);
});

test('aborts before doing anything when a bundled archive was tampered with', () => {
  const file = join(pkg, 'dist', 'overview-preset.zip');
  const original = readFileSync(file);
  const tampered = Buffer.from(original);
  tampered[40] ^= 0x01;
  writeFileSync(file, tampered);
  try {
    const result = cli([], { PATH: '', Path: '' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Integrity check failed for overview-preset\.zip/);
    assert.doesNotMatch(result.stderr, /not found on PATH/);
  } finally {
    writeFileSync(file, original);
  }
});
