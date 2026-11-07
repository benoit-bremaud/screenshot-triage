# Project log — screenshot-triage

Chronological logbook of decisions and events, complementing `git log`. Newest entry first.

## 2026-11-06 — Brick 2 code: triage CLI on a local-directory source (#2)

- The CLI of the validated conception lands in `src/`: `scan · file · doubt · resolve · status · tags`, the pure `transition(capture, event)` of `05-state-capture.md` in `src/triage/`, the effect runner with `--dry-run`, the private index and the labels-only decision log in `src/store/`, the `CaptureSource` port and the local-directory adapter (`Personnel/`, `.trash/`, copies named `<id>.<ext>` from the magic bytes).
- Dependencies (MCDA, 465 vs 400 zero-dependency and 335 commander + zod + file-type): `zod` for the one stdin schema, `node:util` parseArgs, magic bytes in-house. TypeScript 6 because typescript-eslint does not accept TypeScript 7 yet.
- Tests T-1 to T-15 of the traceability matrix on vitest, driving the CLI in process over a temporary directory, plus one spawn of the entry point; coverage 97 %. Local CI (GitHub Actions dropped on 2026-11-07, billed): typecheck, eslint (the `no-restricted-imports` dependency rule, probed with forbidden imports), vitest with an 80 % threshold, gitleaks.
- Port refinement recorded in `03-component.md`: `markPersonal` and `trash` take a target (`<id>.<ext>`, size, time), `finalIds()` lists the ids in `Personnel/` and `.trash/` for the two `scan` guards.
- Local review before the push (adversarial round 1 closed on four Must): free text could reach the public log through `model` or `promptVersion` (now tokens), a source call re-run after a crash failed and the primary row was written before its duplicates, a file changed after the scan could be moved under a stale name (size and time now checked), and `--dry-run` was ignored by `file` and `doubt`. Fixed with a table-driven transition matrix, adapter tests, exit code 3 for unexpected errors, an atomic index write, and CI actions pinned by SHA (workflow later dropped, 2026-11-07).

## 2026-11-06 — Triage UML study and ADR-0002

- Brick 2 (#2) starts with its conception: use case, two sequences, component, capture state machine and data flow under `docs/architecture/diagrams/triage/`, requirements REQ-1 to REQ-8, glossary and traceability matrix.
- [ADR-0002](docs/architecture/decisions/0002-classify-in-the-claude-code-session.md): the Claude Code session classifies the captures (MCDA 395 vs 380 for a classifier port and 320 for an API call from the CLI); the index stays private in `data/` and `knowledge/decisions.jsonl` (versioned, public) logs filing decisions only, keyed by content hash (MCDA 440 vs 390 and 370).
- Local review (adversarial, design, docs) before the push found eight Must: a doubt's reasoning would have been published before the owner's answer, the content hash as row key overwrote originals on duplicates, the `work` answer was modelled two ways; all fixed in the same PR. The doubt now holds the capture instead of stopping the batch; a duplicate follows its original's answer or purge.
- PR #7 opens the study for review. Copilot code review is not available on this repository; the owner waived it for this docs-only PR after 11 adversarial rounds (gate open on `fd4c512`).
- Codex review on PR #7 (three findings, all applied): the model's reasoning leaves the versioned log and stays in the private index (ADR-0002 decision 3: MCDA B 435 vs C 385 and A 365), `scan` revisits refs whose row is `deleted` so a restored Immich asset is triaged again, and the log append is skipped only on an identical payload.
- New brick 6 (#6): a local model learns the triage from the decision log and runs in shadow mode, OCR text first.
- `docs/architecture/adr/` renamed `decisions/` to follow the conception naming convention.

## 2026-11-05 — Project created

- Brainstorm closed in Claude Code: 13 MCDA decisions recorded in [ADR-0001](docs/architecture/decisions/0001-pipeline-decisions.md).
- Repository created locally and on GitHub (public, ADR-0005 of the global rules: public by default). Screenshots and thumbnails are git-ignored because they reproduce third-party content.
- Stack: TypeScript, `@immich/sdk` (official), `sharp`, vitest. The `/screenshots` skill in `~/.claude` drives the conversation and calls this CLI.
- Bricks: 1 Immich on the homelab (`bb-homelab` issue) in parallel with 2 triage CLI on a local-directory source; then 3 Immich adapter, 4 extraction and enrichment PR, 5 Google Photos backlog.
