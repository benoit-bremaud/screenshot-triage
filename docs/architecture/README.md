# Architecture

Index of the conception documents. Every implementation brick follows a validated study here; code conforms to the conception, not the reverse. Method: a light Unified Process, use case driven, Mermaid diagrams named per the owner's `conception-naming` convention.

## Scope and context

One container: a Node CLI in this repository, driven by the `/screenshots` skill of the owner's Claude Code configuration. External systems: the capture source (a local directory, then the Immich server on the homelab) and the Claude Code session acting as vision model. The repository is public, so the data-flow diagram says what is published.

## ADRs

| ID | Title | Status |
|---|---|---|
| [ADR-0001](decisions/0001-pipeline-decisions.md) | Screenshot triage pipeline decisions (13 MCDA choices) | accepted, § Bricks amended by ADR-0002 |
| [ADR-0002](decisions/0002-classify-in-the-claude-code-session.md) | Classify captures in the Claude Code session and log every filing decision | accepted |

## Diagrams

| Feature | Files |
|---|---|
| triage (brick #2) | [01-use-case](diagrams/triage/01-use-case.md), [02-sequence-triage-batch](diagrams/triage/02-sequence-triage-batch.md), [02-sequence-resolve-doubt](diagrams/triage/02-sequence-resolve-doubt.md), [03-component](diagrams/triage/03-component.md), [05-state-capture](diagrams/triage/05-state-capture.md), [06-data-flow](diagrams/triage/06-data-flow.md) |

Skipped for triage, and why: class diagram (two records, `Capture` and `Decision`, described in the state machine and ADR-0002), activity (the sequences carry the branching), deployment (one machine, one process until brick 3).

## Specs, glossary, matrix

- [triage-requirements](specs/triage-requirements.md) — REQ-1 to REQ-9, NFR-1 to NFR-3.
- [glossary](glossary.md) — every term used in the diagrams.
- [traceability-matrix](traceability-matrix.md) — use cases → requirements → realisations → components → tests.
- [review-local](review-local.md) — the latest local review report.
