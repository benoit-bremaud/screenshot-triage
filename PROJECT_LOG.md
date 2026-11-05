# Project log — screenshot-triage

Chronological logbook of decisions and events, complementing `git log`. Newest entry first.

## 2026-11-05 — Project created

- Brainstorm closed in Claude Code: 13 MCDA decisions recorded in [ADR-0001](docs/architecture/adr/0001-pipeline-decisions.md).
- Repository created locally and on GitHub (public, ADR-0005 of the global rules: public by default). Screenshots and thumbnails are git-ignored because they reproduce third-party content.
- Stack: TypeScript, `@immich/sdk` (official), `sharp`, vitest. The `/screenshots` skill in `~/.claude` drives the conversation and calls this CLI.
- Bricks: 1 Immich on the homelab (`bb-homelab` issue) in parallel with 2 triage CLI on a local-directory source; then 3 Immich adapter, 4 extraction and enrichment PR, 5 Google Photos backlog.
