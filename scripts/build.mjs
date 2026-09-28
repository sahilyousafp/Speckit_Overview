// Builds dist/: reproducible add-on zips, SHA256SUMS.txt for the GitHub release, and
// manifest.json, which the installer checks before handing the zips to `specify`.
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTENSION_ARCHIVE, MANIFEST_FILE, PRESET_ARCHIVE } from '../lib/archives.mjs';
import { createZip } from './zip.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = [
  { archive: PRESET_ARCHIVE, dir: 'preset', manifest: 'preset.yml' },
  { archive: EXTENSION_ARCHIVE, dir: 'extension', manifest: 'extension.yml' },
];
const TEXT_EXTENSIONS = new Set(['.md', '.yml', '.yaml', '.txt', '.json']);

function collectFiles(baseDir, dir = baseDir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = lstatSync(full);
    const rel = relative(baseDir, full).split(sep).join('/');
    if (stat.isSymbolicLink()) throw new Error(`Refusing to package symlink: ${rel}`);
    if (stat.isDirectory()) files.push(...collectFiles(baseDir, full));
    else if (stat.isFile()) files.push({ name: rel, path: full });
    else throw new Error(`Refusing to package non-regular file: ${rel}`);
  }
  return files;
}

function normalizedContent(file) {
  const data = readFileSync(file.path);
  const dot = file.name.lastIndexOf('.');
  const ext = dot === -1 ? '' : file.name.slice(dot).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return data;
  return Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
}

export function manifestVersion(yamlPath) {
  const match = readFileSync(yamlPath, 'utf8').match(/^ {2}version: *"?([^"\s]+)"?\s*$/m);
  if (!match) throw new Error(`No version found in ${yamlPath}`);
  return match[1];
}

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export function build({ root = ROOT, outDir = join(root, 'dist') } = {}) {
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  for (const { dir, manifest } of SOURCES) {
    const found = manifestVersion(join(root, dir, manifest));
    if (found !== version) {
      throw new Error(`${dir}/${manifest} version ${found} does not match package.json version ${version}`);
    }
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const hashes = {};
  for (const { archive, dir } of SOURCES) {
    const files = collectFiles(join(root, dir)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const zip = createZip(files.map((file) => ({ name: file.name, data: normalizedContent(file) })));
    writeFileSync(join(outDir, archive), zip);
    hashes[archive] = sha256(zip);
  }

  const sums = Object.entries(hashes).map(([name, hash]) => `${hash}  ${name}\n`).join('');
  writeFileSync(join(outDir, 'SHA256SUMS.txt'), sums);
  writeFileSync(join(outDir, MANIFEST_FILE), `${JSON.stringify({ version, files: hashes }, null, 2)}\n`);
  return { version, hashes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { version, hashes } = build();
  console.log(`Built speckit-overview ${version}`);
  for (const [name, hash] of Object.entries(hashes)) console.log(`  ${hash}  ${name}`);
}
