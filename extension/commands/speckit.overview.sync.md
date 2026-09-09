---
description: "Check off the specs/roadmap.md phase for the current feature once every task in its tasks.md is complete"
---

# Roadmap Sync

Runs automatically after `__SPECKIT_COMMAND_IMPLEMENT__` through the `after_implement` hook, and can also be run by hand. It records a finished phase in `specs/roadmap.md` and changes nothing else.

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Steps

1. **Find the feature directory.** Read `.specify/feature.json` and take `feature_directory`. If the file is missing or has no such key, use the `SPECIFY_FEATURE_DIRECTORY` environment variable. If neither is available, report "No active feature; nothing to sync" and stop.
2. **Check the task list.** Read `<feature_directory>/tasks.md`. If it does not exist, report "No tasks.md; nothing to sync" and stop. Count task lines outside fenced code blocks: a task line is a checkbox followed by a `T###` id; `- [ ]` is open, `- [x]` or `- [X]` is done. If any task is still open, report "Roadmap unchanged: N of M tasks still open" and stop. A partial implementation must never be recorded as a shipped phase.
3. **Find the roadmap.** Read `specs/roadmap.md`. If it does not exist, report "No specs/roadmap.md; nothing to sync" and stop.
4. **Match the phase.** Let `<dirname>` be the last path segment of the feature directory (for example `007-dcpr-signoff-hardening`).
   - First choice: the phase whose `Detail:` line references `specs/<dirname>/`.
   - Otherwise: strip the numeric prefix to get the slug (`dcpr-signoff-hardening`), normalize the slug and each `## Phase` title (lowercase, non-alphanumerics to spaces), and pick the single phase whose title shares the most words with the slug, provided that phase still has at least one `- [ ]` item.
   - If no phase matches, or more than one matches equally, list the candidates and ask the user which phase shipped. Do not guess.
5. **Update that phase only.** Within its section (from its `## Phase` heading to the next `## ` heading): change every `- [ ]` to `- [x]`, and set its `Detail:` line to reference `` `specs/<dirname>/` `` (add the line directly under the heading if it is missing; if it holds a placeholder such as "set once the feature directory exists", replace it). Change nothing else: no reformatting, no edits to other phases, and no edits to `specs/mission.md`, `specs/tech-stack.md`, or `specs/implementation.md`.
6. **Report.** State the phase heading that was checked off, the number of items ticked, and the `Detail:` value written. If every phase in the roadmap is now checked, say so and suggest `__SPECKIT_COMMAND_OVERVIEW__` to plan the next phases.

## Constraints

- Only the one phase tied to the just-implemented feature is touched; never sweep or re-check unrelated phases.
- Never create branches, feature directories, or commits (the git extension's own hook offers a commit separately).
- Missing inputs are reported and skipped, never treated as errors that fail the `__SPECKIT_COMMAND_IMPLEMENT__` run.
