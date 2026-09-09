---
description: Create or update the project constitution, deriving principles, constraints and workflow rules from the project overview docs (specs/mission.md, roadmap.md, tech-stack.md, implementation.md) when they exist.
strategy: wrap
handoffs:
  - label: Build Specification
    agent: speckit.specify
    prompt: Implement the feature specification based on the updated constitution. I want to build...
---

{CORE_TEMPLATE}

## Project Overview Sources

> This section extends Outline step 2 ("Collect/derive values for placeholders") above. It adds
> sources; it does not lift any Scope Guard restriction. The overview docs are read-only here.

Before inferring placeholder values from generic repo context (README, docs), check for the project
overview docs written by `__SPECKIT_COMMAND_OVERVIEW__`, and **IF EXISTS** read each of them in full:

- `specs/mission.md` - derive Core Principles from "What it deliberately is not" (each stated
  boundary becomes a scope-discipline rule) and from "Why ..., not ..." (the central design decision
  becomes a principle with its rationale). Use the one-line mission and "Who it's for" to name the
  project and frame the preamble.
- `specs/tech-stack.md` - derive the Additional Constraints section: pinned tools, required
  runtimes, generated-not-tracked folders, and anything the inventory marks as deliberate (for
  example a dependency that must stay pinned, or a command that must never be run a certain way).
- `specs/roadmap.md` - derive Development Workflow rules: phases are worked in delivery order, a
  phase counts as "next" only when every earlier phase is checked, and each phase is one feature
  specified with `__SPECKIT_COMMAND_SPECIFY__`.
- `specs/implementation.md` - derive any model or effort-routing guidance worth making a rule (for
  example "compliance-rule changes require the highest-reasoning tier"); otherwise leave routing as
  guidance, not law.

Rules for using these sources:

- Values supplied by the user in this conversation still win over anything derived here.
- Do not copy the docs verbatim into the constitution; distil them into declarative, testable
  MUST/SHOULD statements with a one-line rationale, and cite the source file in the rationale.
- Never modify the four overview docs from this command. If they contradict each other or the
  user's input, surface the conflict and ask rather than silently picking one.
- If none of the four files exist, note once that `__SPECKIT_COMMAND_OVERVIEW__` can create them
  and continue with the generic sources; do not block.
- Record in the Sync Impact Report which overview docs were used as sources.
- If the resolver in Outline step 1 fails with "PyYAML is required", the machine's default Python
  lacks the `yaml` module; tell the user to run `python -m pip install pyyaml` and rerun.
