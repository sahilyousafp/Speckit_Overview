# Project Overview preset

Provides `/speckit-overview`, wraps `/speckit-constitution` so it derives rules from the overview
docs, and ships the four page templates (`mission-template`, `roadmap-template`,
`tech-stack-template`, `implementation-template`).

| Artifact | Type | Strategy |
|---|---|---|
| `speckit.overview` | command | new |
| `speckit.constitution` | command | wrap (core command plus a "Project Overview Sources" section) |
| `mission-template`, `roadmap-template`, `tech-stack-template`, `implementation-template` | template | new |

Install: `specify preset add overview --from <zip url> --priority 5` (see the repository README).
Pairs with the `overview` extension, which supplies the `after_implement` roadmap-sync hook.
