# screenshot-triage — project instructions

Pipeline that turns phone screenshots of Instagram dev and design posts into Claude Code skill knowledge. Decisions live in the ADRs under `docs/architecture/decisions/`; read [ADR-0001](docs/architecture/decisions/0001-pipeline-decisions.md) and [ADR-0002](docs/architecture/decisions/0002-classify-in-the-claude-code-session.md) before changing anything. The conception under `docs/architecture/` is the contract the code must satisfy.

## Invariants

- **Deletion only after a sheet, an owner answer, or a final original.** A capture is deleted locally and trashed in Immich only after its extraction sheet exists, after the owner answered personal / delete, or, for a duplicate, with its original's answer or purge (a copy found after the answer is settled by `scan`: personal when the index row or `Personnel/` says so, re-trashed only while `.trash/` still holds the id, so a file the owner restores from the trash is triaged again as new). Never after triage alone. Every destructive command supports `--dry-run`.
- **Doubt holds the capture.** The triage model never invents a domain. A capture that does not look like dev or design watch is marked doubtful with a category, the batch continues, and the owner is asked after the batch: work / personal / delete. Personal captures are never read, never summarised, and are moved to the Immich album `Personnel`, whose content the tool never reads again: only the ids or membership of `Personnel/` and `.trash/` are listed, never their bytes.
- **Nothing private in Git.** `data/` (inbox, domain folders, thumbnails, `index.jsonl`) is git-ignored. `knowledge/decisions.jsonl` is versioned and public: it holds `file` decisions only (labels only, ADR-0002 decision 3: hash, domain, tags, considered tags, confidence, model, prompt version, answer), never a ref, a filename or any free text, the model's reasoning included, which stays in the private index. Sheets hold derived text and the author's handle only.
- **Neither free text nor filenames travel through argv.** Model-written reasoning reaches the CLI as a JSON object on stdin, validated by one schema, stored and never interpreted. Commands address a capture by its id (12 hex characters of the content hash), never by its ref or filename.
- **The source is the durable record of final statuses.** `markPersonal` and `trash` are real on every source (local `Personnel/` and `.trash/` subfolders skipped by `listCaptures`, Immich album and trash), so losing `data/` never resurfaces a personal capture.
- **Tags are reused before created.** The triage prompt receives the current tag list from `tags`. Tags are kebab-case English.
- **Immich API key** is scoped (asset read, download, update, delete; album read and update), named and dated per the credential rule, and never has the trash-empty permission. It lives in `.env`, never in the repository.
- **Dependency rule**: `src/triage/`, `src/store/`, `src/effects.ts` and `src/extract/` never import the Immich SDK; only `src/sources/` does (lint rule `no-restricted-imports`).

## Conventions

- TypeScript strict, named exports, no `any`. Tests with vitest, Immich mocked at the boundary; the local-directory source over a temporary directory is the test double of choice.
- Branch, commit, PR and issue names follow the global rules (`<type>/<N>-<slug>`, Conventional Commits, `Closes #N`).
- `PROJECT_LOG.md` updated after every merge.

## Status

Brick 0 done: repository and decisions. Brick 2 done (#2): conception under `docs/architecture/diagrams/triage/`, CLI in `src/`, tests T-1 to T-15 in `tests/`, CI (typecheck, lint, vitest with coverage ≥ 80 %, gitleaks). `npm run check` plus `gitleaks git` (8.30.1) mirror the four CI jobs. Brick 1 (Immich) runs in `bb-homelab`. Brick 6 (#6, local model in shadow mode) waits for the decision log.
