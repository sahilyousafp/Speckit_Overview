import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { findExecutable, run } from '../lib/exec.mjs';
import { compareVersions, installedVersions, parseSpecifyVersion } from '../lib/specify.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'speckit-overview-specify-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

test('compares versions numerically and ignores dev suffixes', () => {
  assert.equal(compareVersions('1.0.4', '1.0.4'), 0);
  assert.equal(compareVersions('1.0.10', '1.0.4'), 1);
  assert.equal(compareVersions('0.15.2', '1.0.4'), -1);
  assert.equal(compareVersions('1.0.7.dev0', '1.0.4'), 1);
});

test('parses the version from `specify version` output', () => {
  const panel = '╭── Specify CLI Information ──╮\n│   CLI Version  1.0.7.dev0   │\n│        Python  3.13.1       │\n';
  assert.equal(parseSpecifyVersion(panel), '1.0.7');
  assert.equal(parseSpecifyVersion('Spec Kit CLI: 1.2.3\n'), '1.2.3');
  assert.equal(parseSpecifyVersion('garbage'), null);
});

test('reads installed versions from the Spec Kit registries', () => {
  const project = join(tmp, 'project');
  assert.deepEqual(installedVersions(project), { preset: null, extension: null });

  mkdirSync(join(project, '.specify', 'presets'), { recursive: true });
  mkdirSync(join(project, '.specify', 'extensions'), { recursive: true });
  writeFileSync(join(project, '.specify', 'presets', '.registry'), JSON.stringify({ presets: { overview: { version: '1.0.0' } } }));
  writeFileSync(join(project, '.specify', 'extensions', '.registry'), '{not json');
  assert.deepEqual(installedVersions(project), { preset: '1.0.0', extension: null });
});

test('finds executables only in absolute PATH entries', () => {
  const bin = join(tmp, 'bin');
  mkdirSync(bin, { recursive: true });
  const isWin = process.platform === 'win32';
  const file = join(bin, isWin ? 'fake-tool.exe' : 'fake-tool');
  writeFileSync(file, '');
  chmodSync(file, 0o755);

  const env = { PATH: bin, PATHEXT: '.EXE;.CMD' };
  assert.equal(findExecutable('fake-tool', { env }), file);
  assert.equal(findExecutable('missing-tool', { env }), null);
  // A relative entry such as "." must never be searched, even when it holds the tool.
  const cwd = process.cwd();
  process.chdir(bin);
  try {
    assert.equal(findExecutable('fake-tool', { env: { PATH: '.', PATHEXT: '.EXE;.CMD' } }), null);
  } finally {
    process.chdir(cwd);
  }
});

test('refuses cmd.exe metacharacters when a batch shim is involved', async () => {
  await assert.rejects(run('C:\\tools\\specify.cmd', ['init', 'a&calc'], { platform: 'win32' }), /unsafe argument/);
  await assert.rejects(run('C:\\tools\\specify.cmd', ['x', '%PATH%'], { platform: 'win32' }), /unsafe argument/);
});

test('reports a program that cannot start as a user-facing error', async () => {
  await assert.rejects(run(join(tmp, 'does-not-exist'), [], { capture: true, input: '' }), {
    name: 'UserError',
    message: /^Could not start .*does-not-exist \(ENOENT\)\.$/,
  });
});

test('passes arguments to the child verbatim, without a shell', async () => {
  const tricky = ['$(echo hi)', 'a;b', '"quoted"', '*'];
  const { code, stdout } = await run(process.execPath, ['-e', 'console.log(JSON.stringify(process.argv.slice(1)))', ...tricky], {
    capture: true,
    input: '',
  });
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout), tricky);
});
