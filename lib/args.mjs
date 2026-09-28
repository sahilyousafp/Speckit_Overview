import { parseArgs as nodeParseArgs } from 'node:util';
import { UserError } from './errors.mjs';

export const USAGE = `Usage:
  npx speckit-overview [install] [--yes]      Install into the Spec Kit project in this directory
  npx speckit-overview init <name> [--integration <agent>] [--yes]
                                              Create a Spec Kit project (with the git extension), then install
  npx speckit-overview init . [...]           Same, in the current directory
  npx speckit-overview uninstall [--yes]      Remove the preset and extension from this project

Options:
  -y, --yes                 Do not ask for confirmation
      --integration <agent> Coding agent for init, e.g. claude, copilot, gemini (see \`specify check\`)
      --debug               Show stack traces on errors
  -h, --help                Show this help
  -v, --version             Show the package version`;

const COMMANDS = new Set(['install', 'init', 'uninstall']);
const PROJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const INTEGRATION = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function parseArgs(argv) {
  let parsed;
  try {
    parsed = nodeParseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        yes: { type: 'boolean', short: 'y' },
        integration: { type: 'string' },
        debug: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (error) {
    throw new UserError(`${error.message}\n\n${USAGE}`, 2);
  }

  const { values, positionals } = parsed;
  const [command = 'install', ...rest] = positionals;
  const options = { yes: Boolean(values.yes), debug: Boolean(values.debug) };
  if (values.help) return { command: 'help', ...options };
  if (values.version) return { command: 'version', ...options };

  if (!COMMANDS.has(command)) throw new UserError(`Unknown command: ${command}\n\n${USAGE}`, 2);
  if (command !== 'init' && values.integration !== undefined) {
    throw new UserError('--integration is only valid with init.', 2);
  }

  if (command === 'init') {
    const [name, ...extra] = rest;
    if (!name) throw new UserError(`init needs a project name (or . for the current directory).\n\n${USAGE}`, 2);
    if (extra.length) throw new UserError(`Unexpected arguments: ${extra.join(' ')}`, 2);
    if (name !== '.' && !PROJECT_NAME.test(name)) {
      throw new UserError(
        `Invalid project name "${name}". Use letters, digits, ".", "_" or "-", starting with a letter or digit.`,
        2,
      );
    }
    if (values.integration !== undefined && !INTEGRATION.test(values.integration)) {
      throw new UserError(`Invalid integration "${values.integration}". Use lowercase letters, digits and "-".`, 2);
    }
    return { command, name, integration: values.integration, ...options };
  }

  if (rest.length) throw new UserError(`Unexpected arguments: ${rest.join(' ')}`, 2);
  return { command, ...options };
}
