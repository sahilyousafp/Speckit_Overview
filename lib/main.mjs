import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { ADDON_ID, EXTENSION_ARCHIVE, PRESET_ARCHIVE, PRESET_PRIORITY } from './archives.mjs';
import { USAGE, parseArgs } from './args.mjs';
import { UserError } from './errors.mjs';
import { run } from './exec.mjs';
import { loadVerifiedArchives } from './integrity.mjs';
import { checkPyYaml } from './prereqs.mjs';
import { serveArchives } from './serve.mjs';
import { compareVersions, installedVersions, locateSpecify } from './specify.mjs';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const log = (message = '') => console.log(message);

function packageVersion() {
  return JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;
}

async function confirm(question, { yes }) {
  if (yes) return;
  if (!process.stdin.isTTY) {
    throw new UserError('Not running in an interactive terminal. Re-run with --yes to confirm.', 2);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    if (answer !== 'y' && answer !== 'yes') throw new UserError('Cancelled. Nothing was changed.', 0);
  } finally {
    rl.close();
  }
}

// Steps get an empty stdin by default, so an unexpected prompt fails fast instead of hanging.
async function specifyStep(specify, args, { cwd, input = '' }) {
  const { code } = await run(specify.exe, args, { cwd, input });
  if (code !== 0) {
    throw new UserError(`\`specify ${args.join(' ')}\` failed (exit ${code}). Fix the error above and re-run speckit-overview.`);
  }
}

function requireProject(root) {
  if (!existsSync(join(root, '.specify'))) {
    throw new UserError(
      `No Spec Kit project here (${root} has no .specify/ folder). Either:\n` +
        '  cd into your Spec Kit project and run: npx speckit-overview\n' +
        '  or create one with:                     npx speckit-overview init <name> --integration <agent>',
    );
  }
}

export function planFor(root, version) {
  const installed = installedVersions(root);
  for (const current of [installed.preset, installed.extension]) {
    if (current && compareVersions(current, version) > 0) {
      throw new UserError(
        `${root} already has speckit-overview v${current}, newer than this installer (v${version}). ` +
          'Nothing was changed. Run `npx speckit-overview@latest` instead.',
      );
    }
  }
  const action = (current) => (current === version ? 'current' : current ? 'upgrade' : 'install');
  return { installed, preset: action(installed.preset), extension: action(installed.extension) };
}

function describe(kind, action, installed, version) {
  if (action === 'current') return `  ${kind}: v${version} already installed`;
  if (action === 'upgrade') return `  ${kind}: v${installed} -> v${version}`;
  return `  ${kind}: install v${version}`;
}

async function installInto(root, plan, { specify, archives, version }) {
  const server = await serveArchives(archives);
  try {
    if (plan.preset !== 'current') {
      if (plan.preset === 'upgrade') await specifyStep(specify, ['preset', 'remove', ADDON_ID], { cwd: root });
      await specifyStep(
        specify,
        ['preset', 'add', ADDON_ID, '--from', server.url(PRESET_ARCHIVE), '--priority', String(PRESET_PRIORITY)],
        { cwd: root },
      );
    }
    if (plan.extension !== 'current') {
      const args = ['extension', 'add', ADDON_ID, '--from', server.url(EXTENSION_ARCHIVE)];
      if (plan.extension === 'upgrade') args.push('--force');
      // specify asks to confirm any --from install. The user already confirmed above, and the
      // URL serves only this package's checksum-verified archive, so answer for them.
      log();
      log('Note: specify shows an "Untrusted Source" notice for any --from install. The 127.0.0.1 address');
      log('below is this installer serving its own checksum-verified archive; it is answered with "y".');
      await specifyStep(specify, args, { cwd: root, input: 'y\n' });
    }
  } finally {
    await server.close();
  }

  log();
  log(`speckit-overview v${version} is installed in ${root}`);
  const pyyaml = await checkPyYaml();
  if (!pyyaml.ok) {
    log();
    log(`Warning: ${pyyaml.message}`);
  }
  log();
  log('Next, in your coding agent:');
  log('  /speckit-overview       write mission, roadmap, tech stack and implementation notes');
  log('  /speckit-constitution   derive the project rules from them');
}

async function install(options, context) {
  const root = process.cwd();
  requireProject(root);
  const plan = planFor(root, context.version);
  if (plan.preset === 'current' && plan.extension === 'current') {
    log(`speckit-overview v${context.version} is already installed in ${root}. Nothing to do.`);
    return;
  }
  log(`Installing speckit-overview into ${root}`);
  log(describe('preset overview', plan.preset, plan.installed.preset, context.version));
  log(describe('extension overview', plan.extension, plan.installed.extension, context.version));
  await confirm('Continue?', options);
  await installInto(root, plan, context);
}

async function init(options, context) {
  const cwd = process.cwd();
  const here = options.name === '.';
  const root = here ? cwd : resolve(cwd, options.name);
  if (existsSync(join(root, '.specify'))) {
    throw new UserError(`${root} is already a Spec Kit project. Run \`npx speckit-overview\` inside it to install.`);
  }
  if (!here && existsSync(root) && (!statSync(root).isDirectory() || readdirSync(root).length > 0)) {
    throw new UserError(`${root} already exists and is not empty. Choose a new name, or run init . inside it.`);
  }

  // In a non-empty current directory specify asks before merging its files in. With --yes the
  // user has already agreed to exactly this command, so pass --force rather than fail on EOF.
  const initArgs = ['init', ...(here ? ['--here', ...(options.yes ? ['--force'] : [])] : [options.name]), '--extension', 'git'];
  if (options.integration) initArgs.push('--integration', options.integration);

  log(`Creating a Spec Kit project in ${root}`);
  log(`  specify ${initArgs.join(' ')}`);
  log(`  then install speckit-overview v${context.version} (preset + extension)`);
  await confirm('Continue?', options);

  // Interactive runs keep the terminal so specify can ask its own questions; with --yes it
  // takes its defaults instead.
  await specifyStep(context.specify, initArgs, { cwd, input: options.yes ? '' : undefined });
  requireProject(root);
  await installInto(root, planFor(root, context.version), context);
}

async function uninstall(options, context) {
  const root = process.cwd();
  requireProject(root);
  const { preset, extension } = installedVersions(root);
  if (!preset && !extension) {
    log(`speckit-overview is not installed in ${root}. Nothing to do.`);
    return;
  }
  log(`Removing speckit-overview from ${root}`);
  if (extension) log(`  extension overview v${extension}`);
  if (preset) log(`  preset overview v${preset}`);
  await confirm('Continue?', options);
  if (extension) await specifyStep(context.specify, ['extension', 'remove', ADDON_ID, '--force'], { cwd: root });
  if (preset) await specifyStep(context.specify, ['preset', 'remove', ADDON_ID], { cwd: root });
  log('speckit-overview was removed. Your specs/ documents were left untouched.');
}

export async function main(argv) {
  const options = parseArgs(argv);
  if (options.command === 'help') return log(USAGE);
  if (options.command === 'version') return log(packageVersion());

  // Verify the bundled archives before touching anything else.
  const { version, archives } = loadVerifiedArchives(join(PACKAGE_ROOT, 'dist'));
  const specify = await locateSpecify();
  const context = { specify, archives, version };

  if (options.command === 'init') return init(options, context);
  if (options.command === 'uninstall') return uninstall(options, context);
  return install(options, context);
}
