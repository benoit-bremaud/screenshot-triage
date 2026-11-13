# ADR-0004 — Archive work and other captures out of the camera roll

Status: accepted · Date: 2026-11-13 · Deciders: Benoît Bremaud, with Claude Code (MCDA matrices, scores /500).
Amends the CLAUDE.md invariant "deletion only after a sheet, an owner answer, or a final original" and ADR-0003 decision 2 (the purge is no longer the only way a triaged capture leaves the source); issue #15.

## Context

On 2026-11-13 the owner reframed the project: the main goal is to empty the camera roll in one `/screenshots` pass with minimal interaction; knowledge extraction is secondary and runs later. The decisions taken in the #14 session (MCDA top scores accepted) are:

- Q1 (C 455 vs full sheet 300, light sheet 280): a work capture is **archived** into a private archive and leaves the camera roll; extraction runs later from the archive.
- Q2 (C 465 vs A 400, B 340): `other` is archived like work; an off-topic doubt joins the end-of-batch delete list.
- Q3 (B 470 vs A 330, C 265): doubts are answered in one grouped table with a default per category (`personal-suspected` → personal, `unreadable` and `off-topic` → delete); the owner validates or overrides lines once.
- Q4 (B 385 vs C 365, A 350, estimate): the local folder source first, Immich (#3) after.

Until now a triaged capture left the source only through `purge`, after its sheet. This ADR settles how archiving fits the capture state machine and the CLI.

## Decision 1 — where archiving sits in the state machine

Drivers: simplicity 30, consistency with the existing final statuses 25, robustness after losing `data/` 25, later extraction 20.

| Criterion (weight) | A — `archived` is a final status, like `personal`; `scan` settles a returning copy whose id sits in `Archive/` | B — `archived` is not final; Archived → Extracted, `purge` spares the archive | C — a flag on the row, status unchanged |
|---|---|---|---|
| Simplicity (30) | 5 — one state, one `scan` guard | 3 — `extract` and `purge` branch on it | 3 — every guard reads the flag |
| Consistency (25) | 5 — the `Personnel/` model | 3 | 2 — the status lies about where the capture is |
| Robustness (25) | 5 — `Archive/` is the durable record | 4 | 3 |
| Later extraction (20) | 3 — a later brick models it | 5 — available at once | 4 |
| **Total /500** | **460** | 365 | 290 |

Sensitivity: B overtakes A only when later extraction weighs about 55 or more, which contradicts the reframe (extraction is secondary). **Outcome: A.**

- `Archived` is the third final status. `archive` takes a `triaged` capture (any domain, `other` included) to `Archived`: it first removes a sheet and thumbnail a crashed `extract` may have left (a final capture never stays published), then archives each `duplicate` row of it at the source and writes its row `archived`, then archives the original at the source and writes its row last; a crash leaves the original `triaged`, so a re-run finds its duplicates again (the order of `resolve` and `purge`).
- The local copy `data/<domain>/<id>.<ext>` is kept: it is private (git-ignored) and is what a later extraction reads. Nothing is appended to the decision log: archiving is not a label.
- On the local source, `CaptureSource.archive` moves the file to `Archive/<id>.<ext>` with the collision rule of `markPersonal` and `trash` (a duplicate whose target already exists is removed after a size check). `listCaptures` skips `Archive/` like `Personnel/` and `.trash/`; `finalIds()` also lists the ids in `Archive/` (names only). On Immich (#3) the archive is a private album.
- `scan` gains a guard after Personal and Deleted, before Duplicate: an id still in `Archive/` makes a returning copy `archived` at once (row with `duplicateOf`, `source.archive`, which removes the copy). Like Deleted, the source is the only witness: a file the owner moved back out of `Archive/` is triaged again as new.
- Unlike `Personnel/`, the archive holds work content, which a later extraction may read; that brick will amend this machine (a transition out of `Archived`, or a scan of the archive as a source).

## Decision 2 — the shape of the command

Drivers: minimal interaction 40, consistency with the CLI 30, fine control 30.

| Criterion (weight) | A — `archive --source <dir> [--dry-run]` over every `triaged` row, like `purge` | B — `archive <id> --source <dir>` per capture | C — both |
|---|---|---|---|
| Interaction (40) | 5 — one call per batch | 2 — one call per capture | 5 |
| Consistency (30) | 5 — the `purge` contract | 4 | 3 — two forms to test |
| Fine control (30) | 3 | 5 | 5 |
| **Total /500** | **440** | 380 | 440 |

A and C tie; A wins by YAGNI (C adds code no caller needs: the owner corrects a filing with `file` or answers `resolve` before the archive runs). Sensitivity: B leads only with fine control at about 70. **Outcome: A.** `archive` prints `{archived, failed, dryRun}`: `archived` the number of originals archived, `failed` their ids; a failed capture keeps `triaged` with an error flag, the run goes on and exits 3; a re-run completes it.

## Grouped doubt answers

The grouped table of Q3 needs no CLI change: the skill shows the table, takes the owner's validated or overridden answer per line and calls `resolve <id> --as <answer>` for each. The answer stays the owner's (CLAUDE.md "Doubt holds the capture").

## Consequences

- The CLAUDE.md invariant reads: a capture leaves the camera roll only after its extraction sheet exists, after the owner answered personal or delete, after its triage by `archive` (moved into the private archive, never deleted), or, for a duplicate, with its original.
- REQ-3 and the glossary ("Final status", "Archive", "Status") follow; REQ-18 specifies `archive`.
- `purge` is unchanged and still applies to `extracted` rows; the one-pass flow of `/screenshots` becomes `scan` → `file` / `doubt` → `archive` → grouped `resolve`.
- The `/screenshots` skill (agents-skills #422) is rewritten on this contract by the #14 session.
