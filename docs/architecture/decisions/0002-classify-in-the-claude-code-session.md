# ADR-0002 — Classify captures in the Claude Code session and log every filing decision

Status: accepted · Date: 2026-11-06 · Deciders: Benoît Bremaud, with Claude Code (MCDA matrices, scores /500).
Settles who calls the vision model left open by ADR-0001 decision 5, fixes where the index and the decision log live, and amends ADR-0001 on three points: § Bricks, bricks 2 to 6 are built in this repository (decision 12) and only the `/screenshots` skill lives in `~/.claude`; decision 8, the sheets live in `knowledge/` of this repository; decision 7, a doubtful capture is held and the owner is asked after the batch, the batch is not stopped.

## Context

ADR-0001 chose vision triage on Sonnet but not where the model call lives. The CLI is TypeScript; the `/screenshots` skill runs inside a Claude Code session that can already read images. The owner also wants, later, a local model that imitates Claude's triage (distillation, brick 6), which needs every filing decision recorded with its reasoning; brick 6 runs on the owner's PC, so it can read the private index. The repository is public (ADR-0005 of the global rules), so anything versioned is published.

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
| Privacy (35) | 3 — source filenames still public | 5 — only labels of work captures leave, never free text | 5 — nothing leaves |
| Brick 6 (25) | 5 — full log | 5 — same log | 3 — no shared history |
| Simplicity (20) | 3 — two regimes in one file | 4 — one file per regime | 5 — one folder |
| History (20) | 5 | 3 — statuses and answers are lost with `data/`; personal and deleted captures stay out because the source records them (below) | 1 — no backup |
| **Total /500** | **390** | **440** | **370** |

Sensitivity: A overtakes B once about 13 points move from privacy to history (privacy ≈ 22, history ≈ 33: A 416, B 414), which the public-repository rule excludes; C needs brick 6 to weigh near zero.

**Outcome: B.** `data/index.jsonl` (git-ignored) holds every capture row: ref, filename, content hash, status, domain, tags, the model's reasoning (filing or doubt), doubt category, owner answers. `knowledge/decisions.jsonl` (versioned) receives one line per `file` decision only: content hash, timestamp, prompt version, model (`owner` for a correction), domain, tags, considered tags, confidence, and `answer` (`work` after a doubt, `correction` after a re-file, absent otherwise). The model's reasoning never enters the versioned log (decision 3). A doubt writes nothing to the versioned log; a personal answer clears the reasoning from the index row.

**The source, not the index, is the durable record of personal and deleted captures.** Losing `data/` must never resurface a personal capture, so `markPersonal` and `trash` are real on every source: on the local directory they move the file into `Personnel/` and `.trash/` subfolders that `listCaptures` skips, renamed `<id>.<ext>`, mirroring the Immich album and trash. A personal or delete answer gives every `duplicate` or `archived` row with the same content hash (ADR-0004) the same final status and the same source action, in the same effect list; a duplicate whose target name already exists on the local source is removed instead of moved, the bytes being identical. A copy that reaches the source after that answer (a phone re-sync) is settled by `scan` itself (a restored Immich asset keeps its ref, so `scan` also revisits the refs whose row is `deleted` or `personal` (a re-synced copy under the same name) and replaces that row with a fresh one from the initial pseudostate): the row takes the original's final status and the source receives the same action; the personal guard reads the index or the ids present in `Personnel/` (Immich: album membership; content never read), so it holds without the index, while the deleted guard reads only `.trash/`, so a file the owner restored is triaged again as new; `scan --dry-run` changes nothing and prints every effect (REQ-6). A fresh `scan` after losing the index therefore lists work captures only (test T-14, with a duplicate).

## Decision 3 — where the model's reasoning lives

Raised by the Codex review of PR #7: a `work` filing can be a false negative on a personal or confidential screenshot, and the model's reasoning may echo the screenshot's text, so a public log that carries it publishes private text without owner review. Drivers: privacy 35, simplicity 25, value for brick 6 20, owner effort 20.

| Criterion (weight) | A — owner's commit as the gate: the batch report ends with the diff of the log, `resolve personal/delete` on a triaged capture drops its uncommitted lines | B — reasoning in the private index only; the log holds labels | C — two-step log: `file` writes `data/pending.jsonl`, a `publish` command after the batch review |
|---|---|---|---|
| Privacy (35) | 3 — one human reading is the only barrier | 5 — no free text leaves | 5 — no unreviewed text leaves |
| Simplicity (25) | 4 — one extra transition | 4 — one field less in the log | 2 — a second store and a command |
| Brick 6 (20) | 5 — reasoning versioned | 3 — reasoning lost with `data/` unless backed up | 5 — reasoning versioned after review |
| Owner effort (20) | 3 — read a diff every batch | 5 — nothing | 3 — a publish step every batch |
| **Total /500** | 365 | **435** | 385 |

Sensitivity: C overtakes B when about 13 points move from simplicity or owner effort to brick 6 (brick 6 ≈ 33); A overtakes B when about 18 points move from owner effort or privacy to brick 6. Both shifts rank the training history above the owner's privacy or time, which the public-repository rule and the one-person team exclude. Brick 6 runs on the owner's PC and reads the index directly, so the lost value is the versioned history of the reasoning, which a backup of `data/` keeps.

**Outcome: B.** `knowledge/decisions.jsonl` holds labels only: content hash, timestamp, prompt version, model, domain, tags, considered tags, confidence, answer. The reasoning of a filing or a doubt stays in the index row; brick 6 reads the log for labels and the index for reasoning.

## Consequences

- The CLI interface (`scan`, `file`, `doubt`, `resolve`, `status`, `tags`) is the contract between skill and code; adding an API classifier later is a new caller of the same commands, not a change to them.
- Free text never travels through argv: `file` and `doubt` read one JSON decision object on stdin, validated against one schema in `src/triage/`. Model-written reasoning is untrusted input (it may echo a prompt injection in a screenshot) and is stored, never interpreted.
- Filenames never travel through argv or paths: commands address a capture by its `id`, the first 12 hex characters of the content hash (`[0-9a-f]{12}`), never by its ref, which on the local source is an attacker-controlled filename; local copies are named `data/inbox/<id>.<ext>` and `data/<domain>/<id>.<ext>`, so the `path` returned by `scan` and `status` carries no source name either. `<ext>` comes from the file's magic bytes against a whitelist (`png`, `jpg`, `webp`, `heic`), never from the source filename; `scan` rejects any other content. Duplicates receive no command, so the id is unique among addressable rows.
- Effect order inside `file`: move the file, append the log line (skipped only on an identical log line, glossary), then write the index row. A crash leaves the row `inbox`; `scan` finds the file by `<id>.<ext>` in `data/inbox/` then in every domain folder; re-running `file` with the same payload hits the skipped append and completes the index write; when the second run's labels differ in any field, the log holds two lines for the hash, and brick 6 reads the last one. A correction is a `file` on a row already `triaged` in the index, which a half-done `file` never produces.
- Triage requires an open Claude Code session; no cron in brick 2.
- The prompt lives in the skill (`~/.claude`), the facts (domains, tags, statuses, schema) in the CLI; the skill reads them from `tags` to avoid drift.
- The decision log is public but holds labels only (hash, domain, tags, considered tags, confidence, model, prompt version, answer): no free text. The owner still answers `delete`, never `work`, on confidential work content, because the brick 4 sheet publishes derived text.
