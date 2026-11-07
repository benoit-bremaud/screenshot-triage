# Sequence diagram — extract — one extraction batch and its purge (SEQ-extract-batch)

> **Feature**: epic #1, brick #4
> **Source specs**: `docs/architecture/specs/extract-requirements.md` (REQ-10 to REQ-14, REQ-17)
> **Related ADRs**: ADR-0001 (decisions 7, 9), ADR-0003 (decisions 1, 2)
> **Realises**: UC4, UC5 · **See also**: `01-use-case.md`, `03-component.md`, `../triage/05-state-capture.md`

## Context

UC4 then UC5 in one conversation. The skill runs in the Claude Code session, which is also the vision model and the verifier (self-messages of the Skill lifeline); Context7 is reached through the session's MCP tools.

## Diagram

```mermaid
sequenceDiagram
  title sd — UC4 Extract triaged captures, UC5 Purge
  actor Owner
  participant Skill as Skill /screenshots
  participant Docs as Context7
  participant CLI as CLI
  participant Store as Store
  participant Source as Capture source
  Owner->>Skill: extract my triaged screenshots
  Skill->>CLI: status
  CLI-->>Skill: triaged captures (id, path, domain, tags)
  loop for each triaged capture whose domain is not other
    Skill->>Skill: read image, draft title, summary, rules, target skill, handle
    loop for each rule
      alt technical rule
        Skill->>Docs: query the library docs
        Docs-->>Skill: excerpt and URL
        Skill->>Skill: verified, contradicted or not-found
      else design rule
        Skill->>Skill: read the target skill, consistent or in-tension
      end
    end
    Skill->>CLI: extract ID, stdin sheet payload
    alt payload invalid
      CLI-->>Skill: rejected with the reason, nothing written
    else valid
      CLI->>CLI: render and write knowledge/DOMAIN/ID.md
      alt design gem in png, jpg or webp
        CLI->>CLI: write data/thumbnails/ID.jpg (800 px)
      else no gem
        CLI->>CLI: remove data/thumbnails/ID.jpg if present
      end
      CLI->>Store: upsert(status = extracted)
      CLI-->>Skill: ok, sheet path
    end
  end
  Skill-->>Owner: sheets written, rules to confirm
  Skill->>CLI: purge --dry-run
  CLI-->>Skill: planned effects in order
  Skill-->>Owner: purge plan, confirm?
  Owner->>Skill: yes
  Skill->>CLI: purge
  loop for each extracted capture
    loop for each of its duplicates
      CLI->>Source: trash(duplicate ref, target)
      CLI->>Store: upsert(duplicate, status = deleted)
    end
    CLI->>CLI: delete data/DOMAIN/ID.EXT
    CLI->>Source: trash(ref, target)
    CLI->>Store: upsert(status = deleted)
  end
  CLI-->>Skill: purged count
  Skill-->>Owner: batch done, sheets to commit
  Note over Owner,Skill: the sheets go to main through this repository's PR gate before UC6
```

## Notes

- **Effect order of `extract`**: sheet file, thumbnail, index row; a crash before the row leaves `triaged` and a re-run rewrites the same files (idempotent); `--dry-run` prints them.
- **Effect order of `purge`** per original: its duplicates (source trash, row), then local delete, source trash, the original's row last; a crash leaves the original `extracted`, so the re-run finds its remaining duplicates and treats a missing local file and a ref already gone as done (REQ-14, UC5 ext. 3a; same order as `resolve`, `src/triage/transition.ts`).
- `status` lists the triaged captures (REQ-17).
- The skill never writes into `knowledge/` itself and never passes free text on argv (ADR-0002, ADR-0003).
- Bound of the loops: the triaged captures of the index; the skill may stop after any capture, the rest stays `triaged`.
