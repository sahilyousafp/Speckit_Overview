---
description: Interview the user to author and maintain the project-level docs under specs/ (mission.md, roadmap.md, tech-stack.md, implementation.md).
handoffs:
  - label: Establish Constitution
    agent: speckit.constitution
    prompt: Derive the project constitution from specs/mission.md, specs/roadmap.md, specs/tech-stack.md and specs/implementation.md
  - label: Specify First Feature
    agent: speckit.specify
    prompt: Create the specification for the first unchecked phase in specs/roadmap.md
scripts:
  sh: scripts/bash/resolve-template.sh mission-template --json
  ps: scripts/powershell/resolve-template.ps1 mission-template -Json
  py: scripts/python/resolve_template.py mission-template --json
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Scope Guard

This command owns exactly four files, all under `specs/` at the repository root:

- `specs/mission.md` - the project's one-paragraph purpose, who it is for, its core loop, what it deliberately is not, and why the core approach beats the obvious alternative
- `specs/roadmap.md` - the ordered phase list; each phase is one Spec Kit feature with a `[ ]` checklist
- `specs/tech-stack.md` - the technology inventory by layer
- `specs/implementation.md` - which model or effort tier to use per task category, and why

It does **not**:

- create, rename, or write into any per-feature `specs/NNN-slug/` directory (that belongs to `__SPECKIT_COMMAND_SPECIFY__` and the commands that follow it)
- create git branches
- run the per-feature scope interview
- write application source code

If the user asks to "start the next feature", "start the next phase", or "make a spec", tell them that role belongs to `__SPECKIT_COMMAND_SPECIFY__` (which reads the next unchecked phase from `specs/roadmap.md`) and stop.

## Pre-Execution Checks

**Check for extension hooks (before overview)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_overview` key
- If the YAML cannot be parsed or is invalid, skip hook checking silently and continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- For each executable hook, output the following based on its `optional` flag:
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

1. **Resolve the templates.** Run `{SCRIPT}` from the repository root and parse `TEMPLATE_CONTENT` as the mission template. Then run the same command three more times, replacing `mission-template` with `roadmap-template`, `tech-stack-template`, and `implementation-template`, keeping each `TEMPLATE_CONTENT`. If the resolver fails with "PyYAML is required", the machine's default Python lacks the `yaml` module: tell the user to run `python -m pip install pyyaml` (Spec Kit needs it for any preset), then fall back to reading the templates directly: `.specify/templates/overrides/<name>.md` if it exists, else `.specify/presets/overview/templates/<name>.md`. If a template cannot be found either way, stop and report it: the preset that provides this command also provides all four templates, so a missing one means the install is incomplete.

2. **Read the current state.** Check which of the four files already exist. **IF EXISTS**, read `.specify/memory/constitution.md` for principles that already constrain the project. Read every existing overview doc in full before touching it.

3. **Choose the mode.**
   - **Mission authoring** when `specs/mission.md` does not exist, or the user explicitly asks to define or redefine the mission ("what am I building", "set the mission", "redefine the mission").
   - **Incremental maintenance** otherwise: the user wants a phase checked off, a phase added, a dependency recorded, or the model-routing table adjusted. Parse the user input for that intent; if it is unclear, ask one question.

4. **Mission authoring** (interview, draft, approval, write):
   1. Ask **one question at a time**. Lead each with `**Question:**` followed by a full interrogative ending in `?`, then one plain-language "Why it matters" sentence, then a `**Suggested:**` answer the user can accept by replying "yes". Cover, at minimum:
      - the one-line pitch: what the tool does, for whom, framed as an outcome, not a tech stack
      - who it is for: the primary user(s) and any secondary users (for example an AI co-worker)
      - the core loop: the few steps a user goes through, in order, every time
      - what it deliberately is not: explicit non-goals and scope boundaries, stated as plainly as the goals
      - why this approach, not the obvious alternative: the one paragraph that stops a future contributor from "fixing" the central design decision back to the default
   2. Draft `specs/mission.md` from the mission template, filling every `[PLACEHOLDER]` and removing the HTML guidance comments. Keep it terse and concrete; no filler.
   3. Show the complete draft and ask for explicit approval. Silence, or a general "looks good" given before the user has seen the full text, is not approval. Revise and re-show on request.
   4. Only after approval, create `specs/` if needed and write `specs/mission.md`. Never overwrite an existing `specs/mission.md` unless the user explicitly asked to redefine it and approved the new draft.
   5. Continue to roadmap authoring unless the user asks to stop.

5. **Roadmap authoring** (right after a new mission, or when `specs/roadmap.md` is missing):
   1. Interview one phase at a time, in delivery order: what the phase delivers, and its checklist items. Keep each phase small enough to be one Spec Kit feature (one `__SPECKIT_COMMAND_SPECIFY__` run).
   2. Draft `specs/roadmap.md` from the roadmap template: one `## Phase N - <title>` section per phase, each with `- [ ]` items and a `Detail:` line left as `_(set once the feature directory exists)_`.
   3. Show the draft, apply corrections, then write it.

6. **Tech stack and implementation** (right after a new roadmap, or when either file is missing):
   1. Derive `specs/tech-stack.md` from the interview answers plus what is visible in the repository (package manifests, lockfiles, CI config, test runners). Terse and fact-dense: one line per dependency or tool, grouped under the template's layer headings; drop layers the project does not have.
   2. Derive `specs/implementation.md` from the roadmap's recurring task categories: fill the mapping table with the categories this project actually has, the model or effort tier for each, and the reason. Keep the "Why" column.
   3. Show both drafts, apply corrections, then write them.

7. **Incremental maintenance** (existing project):
   - Always read the file first and preserve its structure (headings, checkbox format, `Detail:`/`Source:` lines). Do not reformat.
   - **Check off a phase** when its feature's `tasks.md` (under `specs/NNN-slug/`) is fully checked, or the user says the phase shipped. Tick that phase's items and make sure its `Detail:` line points at the right `specs/NNN-slug/` directory.
   - **Add a phase**: append it in delivery order with a `[ ]` checklist. Add its `Detail:` line once the matching `specs/NNN-slug/` directory exists.
   - **Record a dependency, generated folder, or tooling command**: add it under the existing layer heading in `specs/tech-stack.md`, matching the file's terse style.
   - **Adjust model routing**: update the mapping table in `specs/implementation.md` when a new recurring task category appears or the model lineup changes; keep the table format and the "Why" column.
   - Never redraft `specs/mission.md` in this mode. If the request needs a mission change, switch to mission authoring and go through approval again.

## Mandatory Post-Execution Hooks

**You MUST complete this section before reporting completion to the user.**

Check if `.specify/extensions.yml` exists in the project root.
- If it does not exist, or no hooks are registered under `hooks.after_overview`, skip to the Completion Report.
- If it exists, read it and look for entries under the `hooks.after_overview` key.
- If the YAML cannot be parsed or is invalid, skip hook checking silently and continue to the Completion Report.
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- For each executable hook, output the following based on its `optional` flag:
  - **Mandatory hook** (`optional: false`) - **You MUST emit `EXECUTE_COMMAND:` for each mandatory hook**:
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```

## Completion Report

Report:

- which of the four files were created or updated (full paths)
- for roadmap changes, which phases were added or checked off
- the suggested next command: `__SPECKIT_COMMAND_CONSTITUTION__` if this run created or redefined the mission (the constitution should be derived from it), otherwise `__SPECKIT_COMMAND_SPECIFY__` for the next unchecked phase

## Done When

- [ ] Every file this run touched is listed in the Completion Report
- [ ] A new or redefined `specs/mission.md` was shown in full and explicitly approved before being written
- [ ] No per-feature `specs/NNN-slug/` directory, branch, or source file was created or modified
- [ ] Extension hooks were dispatched or skipped according to the rules above
