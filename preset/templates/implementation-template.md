# Implementation Pipeline: Model Distribution

A working heuristic for which model or effort tier to reach for on this project, by task type.
Revisit it as the project and the model lineup evolve; it is guidance, not a rigid rule.

Models available: [MODEL_LINEUP, e.g. **Opus**, **Sonnet**, **Haiku**].

## Mapping

| Task category | Examples in this repo | Model | Why |
|---|---|---|---|
| [HIGHEST_STAKES_CATEGORY] | [PATHS_OR_MODULES] | **[STRONGEST_MODEL]** | [WHY: correctness surface, cost of a subtle mistake, how it is verified] |
| [STANDARD_FEATURE_WORK] | [PATHS_OR_MODULES] | **[BALANCED_MODEL]** | [WHY: well-specified, existing patterns to follow] |
| [DOCS_AND_STATUS_UPDATES] | [FILES] | **[BALANCED_MODEL]** or **[FAST_MODEL]** | [WHY: split by novelty] |
| [MECHANICAL_EDITS_AND_LOOKUPS] | [EXAMPLES: lint fixes, version bumps] | **[FAST_MODEL]** | [WHY: low ambiguity, no reasoning budget needed] |

<!-- Rows are the recurring task categories this project actually has. Keep the Why column: it is
     what lets a future contributor re-evaluate the mapping when the lineup changes. -->

## How to invoke in a session

- [HOW_TO_PICK_A_MODEL_FOR_A_DELEGATED_TASK, e.g. the agent tool's model parameter]
- [DEFAULT_RULE, e.g. stay on the session's model unless a row clearly applies]
