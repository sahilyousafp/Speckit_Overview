import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArgs } from '../lib/args.mjs';

test('defaults to install', () => {
  assert.deepEqual(parseArgs([]), { command: 'install', yes: false, debug: false });
  assert.deepEqual(parseArgs(['-y']), { command: 'install', yes: true, debug: false });
});

test('parses init with integration', () => {
  assert.deepEqual(parseArgs(['init', 'my-app', '--integration', 'claude', '--yes']), {
    command: 'init',
    name: 'my-app',
    integration: 'claude',
    yes: true,
    debug: false,
  });
  assert.equal(parseArgs(['init', '.']).name, '.');
});

test('rejects project names that could be read as paths, flags or shell syntax', () => {
  for (const name of ['a;b', '../x', '/abs', 'a b', '-rf', '$(x)', 'a&b', '..', 'C:\\x', 'a"b', 'x'.repeat(129)]) {
    assert.throws(() => parseArgs(['init', '--', name]), { name: 'UserError' }, name);
  }
});

test('rejects unsafe integration ids', () => {
  for (const id of ['Claude', 'a;b', '--x', 'a b', '']) {
    assert.throws(() => parseArgs(['init', 'app', `--integration=${id}`]), { name: 'UserError' }, id);
  }
});

test('rejects unknown commands, options and stray arguments', () => {
  assert.throws(() => parseArgs(['deploy']), { exitCode: 2 });
  assert.throws(() => parseArgs(['--force']), { exitCode: 2 });
  assert.throws(() => parseArgs(['install', 'extra']), { exitCode: 2 });
  assert.throws(() => parseArgs(['init']), { exitCode: 2 });
  assert.throws(() => parseArgs(['init', 'a', 'b']), { exitCode: 2 });
  assert.throws(() => parseArgs(['--integration', 'claude']), { exitCode: 2 });
});

test('help and version win over commands', () => {
  assert.equal(parseArgs(['init', 'x', '--help']).command, 'help');
  assert.equal(parseArgs(['-v']).command, 'version');
});
