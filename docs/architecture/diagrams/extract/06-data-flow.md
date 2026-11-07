# Data flow diagram — extract — what the sheets and field notes publish

> **Feature**: epic #1, brick #4
> **Related ADRs**: ADR-0003, ADR-0005 (global: public repositories)
> **Realises**: REQ-12, NFR-1, NFR-4 · **See also**: `../triage/06-data-flow.md`

## Context

Brick 4 is where derived text leaves the PC: into the public sheets of this repository, then into the public `~/.claude` repository as field notes read by later sessions. Not native UML; drawn as a flowchart.

## Diagram

```mermaid
---
title: DFD — Extract (level 1)
---
flowchart LR
  subgraph PC ["Trust zone: owner's PC"]
    P2(("2 Extract (CLI)"))
    P3(("3 Purge (CLI)"))
    P4(("4 Notes (CLI)"))
    Images[("D1 data/DOMAIN images")]
    Index[("D2 data/index.jsonl")]
    Thumbs[("D4 data/thumbnails")]
  end
  subgraph Provider ["Trust zone: Claude Code session and model provider"]
    Session[/"Vision model and verifier"/]
  end
  Docs[/"Context7 / official docs"/]
  Source[/"Capture source"/]
  subgraph Git ["Trust zone: public repositories"]
    Sheets[("D5 knowledge/DOMAIN/ID.md<br/>id, derived text, handle")]
    Field[("D6 ~/.claude field-notes.md")]
  end
  Images -->|"PII: triaged image"| Session
  Session -->|"library and topic names only"| Docs
  Docs -->|"excerpt, URL"| Session
  Session -->|"sheet payload: derived text, handle, statuses"| P2
  P2 -->|"escaped Markdown"| Sheets
  Images -->|"PII: design gem image"| P2
  P2 -->|"PII: 800 px thumbnail"| Thumbs
  P2 -->|"status"| Index
  Index -->|"extracted rows"| P3
  P3 -->|"ref and trash"| Source
  P3 -->|"delete"| Images
  Sheets -->|"rules, statuses"| P4
  Field -->|"cited ids"| P4
  P4 -->|"uncited rules"| Session
  Session -->|"owner-approved PR"| Field
```

## Notes

- **D5 and D6 are published**: derived text and the author's handle only, escaped (NFR-4); no ref, filename, asset id or OCR dump (REQ-12). The owner reads every sheet before the purge (UC5) and every PR before the merge (UC6).
- **To Context7** go library and topic names, never screenshot text beyond the rule being checked.
- **D4 thumbnails** stay git-ignored like D1: third-party images.
- Residual risk: an injected instruction in a screenshot reaching a skill as a rule; mitigated by escaping, length limits, the opening line of field-notes files and owner review (ADR-0003).
