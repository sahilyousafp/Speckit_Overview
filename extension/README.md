# Overview Roadmap Sync extension

Keeps `specs/roadmap.md` honest: after `/speckit-implement`, the hook checks off the phase whose
feature `tasks.md` is fully complete and points its `Detail:` line at the feature directory. A
partial task list leaves the roadmap untouched.

## Commands

| Command | Description |
|---|---|
| `speckit.overview.sync` | Check off the roadmap phase for the current feature once every task in its `tasks.md` is complete |

## Hooks

| Event | Command | Optional | Description |
|---|---|---|---|
| `after_implement` | `speckit.overview.sync` | No | Sync `specs/roadmap.md` after implementation |

Install: `specify extension add overview --from <zip url>` (see the repository README). Pairs with
the `overview` preset, which provides `/speckit-overview` and the templates.
