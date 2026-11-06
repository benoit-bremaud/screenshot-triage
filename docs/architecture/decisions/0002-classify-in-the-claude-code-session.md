# ADR-0002 — Classify captures in the Claude Code session and log every filing decision

Status: accepted · Date: 2026-11-06 · Deciders: Benoît Bremaud, with Claude Code (MCDA matrices, scores /500).
Settles who calls the vision model left open by ADR-0001 decision 5, fixes where the index and the decision log live, and amends ADR-0001 § Bricks: bricks 2 to 6 are built in this repository (decision 12), only the `/screenshots` skill lives in `~/.claude`.

## Context

ADR-0001 chose vision triage on Sonnet but not where the model call lives. The CLI is TypeScript; the `/screenshots` skill runs inside a Claude Code session that can already read images. The owner also wants, later, a local model that imitates Claude's triage (distillation, brick 6), which needs every filing decision recorded with its reasoning. The repository is public (ADR-0005 of the global rules), so anything versioned is published.

## Decision 1 — who classifies

Drivers: cost (no extra key or per-token billing) 30, simplicity 25, testability 20, autonomy for a future scheduler 15, secrets to manage 10.

| Criterion (weight) | A — CLI calls the Anthropic API | B — Claude Code session classifies, CLI does the rest | C — `Classifier` port in the CLI, session adapter now, API adapter later |
|---|---|---|---|
| Cost (30) | 2 — paid API key per token | 5 — subscription, no key | 5 — same as B today |
| Simplicity (25) | 3 — HTTP client, retries, prompt in code | 4 — CLI is pure files and index, prompt in the skill | 2 — an abstraction with one adapter |
| Testability (20) | 4 — API mocked at the boundary | 4 — CLI fully deterministic | 4 — same seam as A |
| Autonomy (15) | 5 — runs without a session | 1 — needs an open session | 4 — API adapter would run unattended |
| Secrets (10) | 3 — one more key in `.env` | 5 — none | 4 — none until the API adapter |
| **Total /500** | **320** | **395** | **380** |

Sensitivity: the margin is 15 points. C overtakes B as soon as autonomy weighs about 20 (weight taken from cost or simplicity); at autonomy 30 with cost 15, A and C tie at 365 and B comes last. B holds because no scheduler is planned (ADR-0001 decision 1); revisit when brick 6 or a scheduled job makes unattended runs a need.

**Outcome: B.** The skill presents each inbox capture to the session with the domain list and the current tags, and records the answer through the CLI (`file`, `doubt`, `resolve`). The CLI never calls a model and needs no model credential.

## Decision 2 — where the index and the decision log live

Drivers: privacy 35, usefulness for brick 6 25, simplicity 20, history and backup in Git 20.

| Criterion (weight) | A — both versioned, doubt logs a category only | B — index private in `data/`, versioned log of filing decisions only | C — both private, nothing versioned |
|---|---|---|---|
| Privacy (35) | 3 — source filenames still public | 5 — only derived text of work captures leaves | 5 — nothing leaves |
| Brick 6 (25) | 5 — full log | 5 — same log | 3 — no shared history |
| Simplicity (20) | 3 — two regimes in one file | 4 — one file per regime | 5 — one folder |
| History (20) | 5 | 4 — the index is rebuilt by `scan` | 1 — no backup |
| **Total /500** | **390** | **460** | **370** |

Sensitivity: B stays first unless privacy drops below 15, which the public-repository rule excludes.

**Outcome: B.** `data/index.jsonl` (git-ignored) holds every capture row: ref, filename, content hash, status, doubt category and reasoning, owner answers. `knowledge/decisions.jsonl` (versioned) receives one line per `file` decision only: content hash, timestamp, prompt version, model, domain, tags, considered tags, confidence, reasoning, and `answer` (`work` after a doubt, `correction` after a re-file, absent otherwise). A doubt writes nothing to the versioned log; a personal answer clears the reasoning from the index row.

## Consequences

- The CLI interface (`scan`, `file`, `doubt`, `resolve`, `status`, `tags`) is the contract between skill and code; adding an API classifier later is a new caller of the same commands, not a change to them.
- Free text never travels through argv: `file` and `doubt` read one JSON decision object on stdin, validated against one schema in `src/triage/`. Model-written reasoning is untrusted input (it may echo a prompt injection in a screenshot) and is stored, never interpreted.
- Triage requires an open Claude Code session; no cron in brick 2.
- The prompt lives in the skill (`~/.claude`), the facts (domains, tags, statuses, schema) in the CLI; the skill reads them from `tags` to avoid drift.
- The decision log is public: the owner answers `delete`, never `work`, on confidential work content; reasoning follows the sheet rule "author's handle only".
