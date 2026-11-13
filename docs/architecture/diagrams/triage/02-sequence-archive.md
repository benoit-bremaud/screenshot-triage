# Sequence diagram — triage — archive the triaged captures (SEQ-archive)

> **Feature**: epic #1, issue #15
> **Source specs**: `docs/architecture/specs/triage-requirements.md` (REQ-3, REQ-6, REQ-18)
> **Related ADRs**: ADR-0004
> **Realises**: UC7 · **See also**: `01-use-case.md`, `02-sequence-triage-batch.md`, `05-state-capture.md`

## Context

After the filings of a batch, the skill empties the camera roll of the work and `other` captures with one `archive` call (ADR-0004 decision 2). Each triaged capture and its duplicates move into the private `.archive/` of the source; the local copy stays under `data/<domain>/` for a later extraction. Doubts are answered after it with `resolve` (`02-sequence-resolve-doubt.md`), from one grouped table.

## Diagram

```mermaid
sequenceDiagram
  title sd — UC7 Archive the triaged captures
  actor Owner
  participant Skill as Skill /screenshots
  participant CLI as CLI
  participant Source as Capture source
  participant Store as Store
  Skill->>CLI: archive --source DIR [--dry-run]
  CLI->>Store: load index
  Store-->>CLI: triaged rows
  loop for each triaged capture, one at a time
    opt a sheet or thumbnail left by a crashed extract
      CLI->>CLI: remove sheet and thumbnail
    end
    alt every source call succeeds
      loop for each duplicate of it
        CLI->>Source: archive(ref, target) — an existing .archive/ID.EXT removes the copy
        CLI->>Store: upsert(duplicate, status = archived)
      end
      CLI->>Source: archive(ref, target), target = ID.EXT + contentHash + size + takenAt
      CLI->>Store: upsert(status = archived), local copy kept
    else a source call fails (duplicate or original)
      CLI->>Store: upsert(status = triaged, error = archive failed)
    end
  end
  CLI-->>Skill: {archived, failed, dryRun}
  Skill-->>Owner: roll emptied of N work and other captures; grouped doubt table next
```

## Notes

- **Nothing is deleted**: the file moves into `.archive/` (Immich, brick 3: a private album). Duplicates first and the original's row last, so a crash leaves the original `triaged` and a re-run finds its duplicates again (REQ-18).
- `--dry-run` prints every effect in order and changes nothing (REQ-6); no decision line is appended (archiving is not a label).
- A failed capture keeps `triaged` with an error flag, the run goes on, the command exits 3.
