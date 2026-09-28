# speckit-overview

An add-on for [GitHub Spec Kit](https://github.com/github/spec-kit) that gives a project a durable
"why" before any feature gets specified. Works with the stock `specify` CLI (no fork), on any Spec
Kit 1.0.4 or newer install.

It adds:

- **`/speckit-overview`** - interviews you and writes four project-level docs under `specs/`:
  `mission.md` (purpose, audience, core loop, non-goals, why-this-approach), `roadmap.md` (ordered
  phases, one Spec Kit feature each), `tech-stack.md`, and `implementation.md` (which model or
  effort tier to use per task type). A new mission is shown in full and needs your explicit approval
  before it is written. Later runs maintain the docs: check off shipped phases, add phases, record
  dependencies.
- **A smarter `/speckit-constitution`** - the core command is wrapped so it derives principles,
  constraints and workflow rules from those four docs instead of guessing from the README.
- **Automatic roadmap sync** - an `after_implement` hook (`/speckit-overview-sync`) checks off the
  roadmap phase whose feature `tasks.md` is fully complete, right after `/speckit-implement`.

Branch creation before `/speckit-specify` is not part of this add-on: Spec Kit already bundles a
`git` extension that does it (`specify init --extension git`).

## Install

You need [Spec Kit](https://github.com/github/spec-kit) 1.0.4 or newer (the `specify` CLI) and
Node.js 20 or newer.

New project, in one command:

```bash
npx speckit-overview init my-project --integration claude
```

This runs `specify init my-project --integration claude --extension git`, then installs the preset
and the extension. Use `init .` to set up the current directory instead (with `--yes` in a
non-empty directory, Spec Kit merges its files in without asking).

Existing Spec Kit project, from its root:

```bash
npx speckit-overview
```

Running it again is safe: when this version is already installed it does nothing, an older
version is upgraded in place, and a newer one is left alone (it will not downgrade). `npx speckit-overview uninstall` removes both pieces and leaves your
`specs/` documents alone. Add `--yes` to skip the confirmation (needed in CI and other
non-interactive shells), and `--help` for everything else.

Notes:

- The installer checks that PyYAML is available and prints the fix if it is not. Presets make Spec
  Kit's template resolver parse `preset.yml`, which needs PyYAML in the Python its scripts pick:
  `python3` if that name exists on PATH, else `python` (`python3 -m pip install pyyaml`, or
  `python -m pip install pyyaml`). Without it, `/speckit-plan`, `/speckit-tasks` and
  `/speckit-constitution` report "PyYAML is required" on that machine.
- `specify` prints an "Untrusted Source" notice while the extension installs, with a
  `http://127.0.0.1:...` address. That address is the installer handing over its own verified
  archive (see [Security](#security)); it answers the prompt for you after you confirm.
- Some Spec Kit versions print "Configuration may be required" for every extension that has no
  config file. There is nothing to configure.

### Security

- **Nothing runs at install time.** The package has no `preinstall`/`postinstall` scripts and zero
  runtime dependencies; it only uses Node.js built-ins.
- **Published from CI with provenance.** Releases are published by GitHub Actions through npm
  trusted publishing (OIDC, no stored npm token), with a signed provenance statement linking the
  package to the exact commit and workflow run. Check it with `npm audit signatures` after
  installing, or on the package page on npmjs.com.
- **Verified content.** The preset and extension ship inside the package as reproducible zips.
  Before using them the installer checks each one against the SHA-256 recorded at build time, and
  stops without changing anything if they differ. `npm run build` recreates the same bytes from
  this repository, and the release's `SHA256SUMS.txt` lists the same hashes.
- **Spec Kit does the installing.** The installer never writes into `.specify/` itself. It serves the
  verified zips to `specify preset add --from` / `specify extension add --from` from a temporary
  server bound to `127.0.0.1` on a random port, under a random 256-bit path, and shuts it down as
  soon as the install finishes. Spec Kit's own archive checks (path traversal, symlinks, size limits)
  still apply.
- **No shell.** `specify` is found on absolute `PATH` entries only and is run with an argument list,
  never through a shell. Project and integration names are validated before use.
- **No network at run time.** Everything the installer needs is in the package npx downloads.

### Manual install

Without Node.js, install straight from the GitHub release:

```bash
specify init my-project --integration claude --extension git
cd my-project
specify preset add overview --from https://github.com/sahilyousafp/Speckit_Overview/releases/latest/download/overview-preset.zip --priority 5
specify extension add overview --from https://github.com/sahilyousafp/Speckit_Overview/releases/latest/download/overview-extension.zip
```

For an existing Spec Kit project, run the last two commands from the project root, plus
`specify extension add git` if you want the branch hook. Each `--from` shows a one-time "untrusted
source" prompt; answer `y`. `releases/latest/download/` always gets the newest release; replace
`latest/download` with `download/vX.Y.Z` to pin a version. The preset installs the command, the
constitution wrap and the templates; the roadmap hook only appears in `.specify/extensions.yml`
once the extension is installed too, so run both.

## The workflow

1. `/speckit-overview` - mission interview, approve the draft, then roadmap, tech stack and
   implementation notes.
2. `/speckit-constitution` - derives the project's rules from those docs.
3. `/speckit-specify` - takes the next unchecked roadmap phase; the git hook creates its branch.
4. `/speckit-plan`, `/speckit-tasks`, `/speckit-implement` - the roadmap phase is checked off
   automatically when every task is done.
5. Merge, then back to step 3. Run `/speckit-overview` again whenever the plan changes.

## What gets installed where

| Piece | Lands in | Provides |
|---|---|---|
| preset `overview` | `.specify/presets/overview/` | `/speckit-overview`, wrapped `/speckit-constitution`, `mission-template`, `roadmap-template`, `tech-stack-template`, `implementation-template` |
| extension `overview` | `.specify/extensions/overview/` | `/speckit-overview-sync` and the `after_implement` hook |
| bundled extension `git` | `.specify/extensions/git/` | `/speckit-git-feature` and the `before_specify` branch hook (ships with Spec Kit) |

Commands render as `.claude/skills/speckit-*/SKILL.md` for Claude Code, or your agent's equivalent
command files.

## Uninstall

```bash
npx speckit-overview uninstall
```

Or by hand: `specify extension remove overview` and `specify preset remove overview`.

## Development

```bash
npm test                # unit tests; no dependencies to install
npm run build           # dist/: reproducible zips, SHA256SUMS.txt, manifest.json
npm pack                # the exact tarball npm will publish (builds and tests first)
```

Try the packed installer against a scratch project with `npx ./speckit-overview-X.Y.Z.tgz init demo`.
To iterate on the add-on itself without packaging:

```bash
specify init demo --integration claude --extension git
cd demo
specify preset add --dev ../Speckit_Overview/preset --priority 5
specify extension add ../Speckit_Overview/extension --dev
```

CI runs the tests on Linux and Windows, and installs the packed tarball end to end against the
oldest supported and the latest tested Spec Kit.

Releases: bump the version in `package.json`, `preset/preset.yml` and `extension/extension.yml`
(the build fails if they differ), tag `vX.Y.Z`, push the tag. The release workflow checks the tag
matches, attaches `overview-preset.zip`, `overview-extension.zip` and `SHA256SUMS.txt` to a GitHub
release, then publishes the npm package through trusted publishing.

One-time npm setup: trusted publishing is configured in the package's settings on npmjs.com, so
the package has to exist first. Publish the first version by hand (`npm publish` from a clean
checkout of the tag, with 2FA). Then, under Settings > Trusted publishing, add GitHub Actions with
repository `sahilyousafp/Speckit_Overview` and workflow `release.yml`. Finally, under Settings >
Publishing access, choose "Require two-factor authentication and disallow tokens". After that only
the release workflow can publish, and it needs no npm token.
