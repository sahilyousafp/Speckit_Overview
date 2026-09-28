// Locates executables and runs them without a shell, so no argument is ever interpreted by one.
import { spawn } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, extname, isAbsolute, join } from 'node:path';
import { UserError } from './errors.mjs';

/**
 * Finds `name` on PATH. Relative PATH entries (such as `.`) are skipped so a file planted in
 * the current project can never shadow the real tool.
 */
export function findExecutable(name, { env = process.env, platform = process.platform } = {}) {
  const pathValue = env.PATH ?? env.Path ?? '';
  const dirs = pathValue.split(platform === 'win32' ? ';' : delimiter).filter((dir) => dir && isAbsolute(dir));
  const exts =
    platform === 'win32'
      ? (env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean).map((ext) => ext.toLowerCase())
      : [''];

  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, name + ext);
      try {
        if (!statSync(candidate).isFile()) continue;
        if (platform !== 'win32') accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Not here; keep looking.
      }
    }
  }
  return null;
}

// Characters that are inert inside a double-quoted cmd.exe argument.
const CMD_SAFE_ARG = /^[A-Za-z0-9 ._:\/\\=+~()-]*$/;

function spawnArgs(file, args, platform) {
  const ext = extname(file).toLowerCase();
  if (platform !== 'win32' || (ext !== '.cmd' && ext !== '.bat')) {
    return { command: file, argv: args, options: {} };
  }
  // Batch shims can only run through cmd.exe. Allow only a strict character set so nothing
  // in the command line can be read as a cmd.exe metacharacter.
  for (const part of [file, ...args]) {
    if (!CMD_SAFE_ARG.test(part)) throw new UserError(`Refusing to pass an unsafe argument to ${file}: ${part}`);
  }
  const line = [file, ...args].map((part) => `"${part}"`).join(' ');
  return {
    command: process.env.ComSpec || 'cmd.exe',
    argv: ['/d', '/s', '/c', `"${line}"`],
    options: { windowsVerbatimArguments: true },
  };
}

/**
 * Runs a program and resolves with its exit code. `capture` collects stdout/stderr instead
 * of streaming them; `input` is written to stdin, which is otherwise inherited.
 */
function startError(file, error, platform) {
  const blocked = platform === 'win32' && ['UNKNOWN', 'EACCES', 'EPERM'].includes(error.code);
  return new UserError(
    `Could not start ${file} (${error.code ?? error.message}).` +
      (blocked ? ' Windows may be blocking it, for example Smart App Control or an Application Control policy.' : ''),
  );
}

export function run(file, args, { cwd, input, capture = false, env, platform = process.platform, timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const { command, argv, options } = spawnArgs(file, args, platform);
    let child;
    try {
      child = spawn(command, argv, {
        ...options,
        cwd,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...env },
        shell: false,
        windowsHide: true,
        timeout: timeoutMs,
        stdio: [input === undefined ? 'inherit' : 'pipe', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'],
      });
    } catch (error) {
      // Some failures, such as a policy-blocked executable on Windows, throw instead of emitting.
      reject(startError(file, error, platform));
      return;
    }
    let stdout = '';
    let stderr = '';
    if (capture) {
      child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
      child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
    }
    if (input !== undefined) {
      child.stdin.on('error', () => {}); // the child may exit without reading stdin
      child.stdin.end(input);
    }
    child.once('error', (error) => reject(startError(file, error, platform)));
    child.once('close', (code, signal) => resolve({ code: code ?? (signal ? 1 : 0), stdout, stderr }));
  });
}
