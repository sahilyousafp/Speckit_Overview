// Loads the bundled archives into memory and refuses to continue unless each one matches the
// SHA-256 recorded at build time. Only the verified in-memory bytes are ever served.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARCHIVE_NAMES, MANIFEST_FILE } from './archives.mjs';
import { UserError } from './errors.mjs';

const HEX_SHA256 = /^[0-9a-f]{64}$/;

export function loadVerifiedArchives(distDir) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(distDir, MANIFEST_FILE), 'utf8'));
  } catch (error) {
    throw new UserError(`Package is incomplete: cannot read ${MANIFEST_FILE} (${error.message}). Reinstall speckit-overview.`);
  }
  const listed = manifest && typeof manifest.files === 'object' ? Object.keys(manifest.files).sort() : [];
  if (typeof manifest?.version !== 'string' || listed.join() !== [...ARCHIVE_NAMES].sort().join()) {
    throw new UserError(`Package is corrupt: ${MANIFEST_FILE} does not list the expected archives. Reinstall speckit-overview.`);
  }

  const archives = new Map();
  for (const name of ARCHIVE_NAMES) {
    const expected = manifest.files[name];
    if (typeof expected !== 'string' || !HEX_SHA256.test(expected)) {
      throw new UserError(`Package is corrupt: invalid checksum for ${name}. Reinstall speckit-overview.`);
    }
    let data;
    try {
      data = readFileSync(join(distDir, name));
    } catch (error) {
      throw new UserError(`Package is incomplete: cannot read ${name} (${error.message}). Reinstall speckit-overview.`);
    }
    const actual = createHash('sha256').update(data).digest('hex');
    if (actual !== expected) {
      throw new UserError(
        `Integrity check failed for ${name}: expected sha256 ${expected}, got ${actual}. ` +
          'The package was modified after it was built. Nothing was installed.',
      );
    }
    archives.set(name, data);
  }
  return { version: manifest.version, archives };
}
