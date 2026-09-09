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

New project:

```bash
specify init my-project --integration claude --extension git
cd my-project
specify preset add overview --from https://github.com/sahilyousafp/speckit-overview/releases/download/v1.0.0/overview-preset.zip --priority 5
specify extension add overview --from https://github.com/sahilyousafp/speckit-overview/releases/download/v1.0.0/overview-extension.zip
```

Existing Spec Kit project: run the last two commands from the project root, plus
`specify extension add git` if you want the branch hook.

Notes:

- Each `--from` shows a one-time "untrusted source" prompt; answer `y`.
- Presets make Spec Kit's template resolver parse `preset.yml`, which needs Python 3 with PyYAML
  on PATH (`python -m pip install pyyaml`). Without it, `/speckit-plan`, `/speckit-tasks` and
  `/speckit-constitution` report "PyYAML is required" on that machine.
- The preset installs the command, the constitution wrap and the templates. The roadmap hook only
  appears in `.specify/extensions.yml` once the extension is installed too, so run both.
- To always get the newest release, `releases/latest/download/<asset>` also works (GitHub redirects to the current asset); the tagged form above pins a version.
- `specify init --extension` needs Spec Kit 0.15.2+; on older versions run
  `specify extension add git` after init. Everything else needs 0.10.0+.
- On Spec Kit 1.0.4 the extension installer prints "Configuration may be required" for every
  extension that has no config file. There is nothing to configure; newer releases drop the notice.

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
specify preset remove overview
specify extension remove overview
```

## Development

```bash
specify init demo --integration claude --extension git
cd demo
specify preset add --dev ../speckit-overview/preset --priority 5
specify extension add ../speckit-overview/extension --dev
```

Releases: bump `version` in `preset/preset.yml` and `extension/extension.yml`, tag `vX.Y.Z`, push
the tag. The release workflow checks the versions match the tag, zips `preset/` and `extension/`,
and attaches `overview-preset.zip`, `overview-extension.zip` and `SHA256SUMS.txt` to the release.
