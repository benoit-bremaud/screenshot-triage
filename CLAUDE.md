# screenshot-triage — project instructions

Pipeline that turns phone screenshots of Instagram dev and design posts into Claude Code skill knowledge. Decisions live in the ADRs under `docs/architecture/adr/`; read [ADR-0001](docs/architecture/adr/0001-pipeline-decisions.md) before changing anything.

## Invariants

- **Deletion only on a final status.** A capture is deleted locally and trashed in Immich only after its extraction sheet exists, or after the owner answered personal / delete. Never after triage alone. Every destructive command supports `--dry-run`.
- **Doubt stops the pipeline.** The triage model never invents a domain. A capture that does not look like dev or design veille is marked doubtful and the owner is asked: personal / work / delete. Personal captures are never read, never summarised, and are moved to the Immich album `Personnel`, which the tool never reads again.
- **No third-party images in Git.** `data/` (inbox, domain folders, thumbnails) is git-ignored. Sheets hold derived text and the author's handle only.
- **Tags are reused before created.** The triage prompt receives the current tag list. Tags are kebab-case English.
- **Immich API key** is scoped (asset read, download, update, delete; album read and update), named and dated per the credential rule, and never has the trash-empty permission. It lives in `.env`, never in the repository.
- **Dependency rule**: `src/triage/`, `src/index/` and `src/extract/` never import the Immich SDK; only `src/sources/` does.

## Conventions

- TypeScript strict, named exports, no `any`. Tests with vitest, Immich mocked at the boundary.
- Branch, commit, PR and issue names follow the global rules (`<type>/<N>-<slug>`, Conventional Commits, `Closes #N`).
- `PROJECT_LOG.md` updated after every merge.

## Status

Brick 0 done: repository and decisions. Next: brick 2 (triage CLI, local-directory source) here; brick 1 (Immich) in `bb-homelab`.
