// Everything the installer needs to know about the local Spec Kit: where `specify` is, its
// version, and which versions of this add-on a project already has.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADDON_ID } from './archives.mjs';
import { UserError } from './errors.mjs';
import { findExecutable, run } from './exec.mjs';

export const MIN_SPECIFY_VERSION = '1.0.4';
export const SPECIFY_INSTALL_HINT = 'uv tool install specify-cli --from git+https://github.com/github/spec-kit.git';

/** Compares dotted numeric versions; pre-release suffixes such as `.dev0` are ignored. */
export function compareVersions(a, b) {
  const parse = (v) => v.split('.').slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0) ? -1 : 1;
  }
  return 0;
}

export function parseSpecifyVersion(output) {
  const match = output.match(/CLI Version\D{0,40}?(\d+\.\d+\.\d+)/) ?? output.match(/Spec Kit CLI:\s*(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

export async function locateSpecify() {
  const exe = findExecutable('specify');
  if (!exe) {
    throw new UserError(`The Spec Kit CLI (specify) was not found on PATH. Install it with:\n  ${SPECIFY_INSTALL_HINT}`);
  }
  const { code, stdout, stderr } = await run(exe, ['version'], {
    capture: true,
    input: '',
    env: { NO_COLOR: '1', COLUMNS: '200', TERM: 'dumb' },
    timeoutMs: 60_000,
  });
  const version = code === 0 ? parseSpecifyVersion(stdout + stderr) : null;
  if (version && compareVersions(version, MIN_SPECIFY_VERSION) < 0) {
    throw new UserError(
      `speckit-overview needs Spec Kit ${MIN_SPECIFY_VERSION} or newer; found ${version}. Upgrade with:\n  ${SPECIFY_INSTALL_HINT} --force`,
    );
  }
  return { exe, version };
}

function registryVersion(file, key) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  const version = data?.[key]?.[ADDON_ID]?.version;
  return typeof version === 'string' ? version : null;
}

/** Installed add-on versions, read from Spec Kit's own registries (null when absent). */
export function installedVersions(projectRoot) {
  return {
    preset: registryVersion(join(projectRoot, '.specify', 'presets', '.registry'), 'presets'),
    extension: registryVersion(join(projectRoot, '.specify', 'extensions', '.registry'), 'extensions'),
  };
}
