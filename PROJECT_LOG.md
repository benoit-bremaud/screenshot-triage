# Project log — screenshot-triage

Chronological logbook of decisions and events, complementing `git log`. Newest entry first.

## 2026-11-06 — Triage UML study and ADR-0002

- Brick 2 (#2) starts with its conception: use case, two sequences, component, capture state machine and data flow under `docs/architecture/diagrams/triage/`, requirements REQ-1 to REQ-8, glossary and traceability matrix.
- [ADR-0002](docs/architecture/decisions/0002-classify-in-the-claude-code-session.md): the Claude Code session classifies the captures (MCDA 395 vs 380 for a classifier port and 320 for an API call from the CLI); the index stays private in `data/` and `knowledge/decisions.jsonl` (versioned, public) logs filing decisions only, keyed by content hash (MCDA 440 vs 390 and 370).
- Local review (adversarial, design, docs) before the push found eight Must: a doubt's reasoning would have been published before the owner's answer, the content hash as row key overwrote originals on duplicates, the `work` answer was modelled two ways; all fixed in the same PR. The doubt now holds the capture instead of stopping the batch; a duplicate follows its original's answer or purge.
- New brick 6 (#6): a local model learns the triage from the decision log and runs in shadow mode, OCR text first.
- `docs/architecture/adr/` renamed `decisions/` to follow the conception naming convention.

## 2026-11-05 — Project created

- Brainstorm closed in Claude Code: 13 MCDA decisions recorded in [ADR-0001](docs/architecture/decisions/0001-pipeline-decisions.md).
- Repository created locally and on GitHub (public, ADR-0005 of the global rules: public by default). Screenshots and thumbnails are git-ignored because they reproduce third-party content.
- Stack: TypeScript, `@immich/sdk` (official), `sharp`, vitest. The `/screenshots` skill in `~/.claude` drives the conversation and calls this CLI.
- Bricks: 1 Immich on the homelab (`bb-homelab` issue) in parallel with 2 triage CLI on a local-directory source; then 3 Immich adapter, 4 extraction and enrichment PR, 5 Google Photos backlog.
