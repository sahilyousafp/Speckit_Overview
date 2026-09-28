// Renders the diagrams in this folder to docs/images/ with a headless Chromium browser (Chrome or
// Edge): the detailed README diagrams in landscape, the minimal LinkedIn cards in 4:5 portrait.
// Usage: node docs/diagrams/render.mjs [name...]   (set BROWSER=/path/to/chrome to override)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'images');
const README = { width: 1600, height: 1000 };
const LINKEDIN = { width: 1080, height: 1350 };
const DIAGRAMS = {
  'use-cases': README,
  workflow: README,
  plugin: README,
  'linkedin-1-sdd': LINKEDIN,
  'linkedin-2-use-cases': LINKEDIN,
  'linkedin-3-workflow': LINKEDIN,
  'linkedin-4-plugin': LINKEDIN,
};
const SCALE = 2;

const CANDIDATES = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const browser = CANDIDATES.find((path) => existsSync(path));
if (!browser) {
  console.error('No Chrome or Edge found. Set BROWSER to a Chromium-based browser executable.');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const names = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(DIAGRAMS);

for (const name of names) {
  if (!DIAGRAMS[name]) {
    console.error(`Unknown diagram: ${name}. Known: ${Object.keys(DIAGRAMS).join(', ')}`);
    process.exit(1);
  }
  const { width, height } = DIAGRAMS[name];
  const out = join(OUT, `${name}.png`);
  const profile = mkdtempSync(join(tmpdir(), 'diagram-render-'));
  const result = spawnSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profile}`,
      `--force-device-scale-factor=${SCALE}`,
      `--window-size=${width},${height}`,
      '--virtual-time-budget=10000',
      `--screenshot=${out}`,
      pathToFileURL(join(HERE, `${name}.html`)).href,
    ],
    { encoding: 'utf8', timeout: 120_000 },
  );
  rmSync(profile, { recursive: true, force: true });
  if (result.status !== 0 || !existsSync(out)) {
    console.error(`Failed to render ${name}:\n${result.stderr}`);
    process.exit(1);
  }
  console.log(`${out}  (${width * SCALE}x${height * SCALE})`);
}
