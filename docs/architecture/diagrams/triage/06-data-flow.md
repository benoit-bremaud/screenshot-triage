# Data flow diagram — triage — where the captures and their derived text go

> **Feature**: epic #1, brick #2, archive #15 (ADR-0004)
> **Related ADRs**: ADR-0002, ADR-0005 (global: public repositories)
> **Realises**: REQ-5, NFR-1 · **See also**: `02-sequence-resolve-doubt.md`, `05-state-capture.md`

## Context

Screenshots are personal data by nature (a phone screen) and this repository is public. The diagram shows the one process of the triage step, every store it writes, the two external entities, and the trust boundaries: the PC, the public repository, and the model provider behind the Claude Code session. Flows are labelled with data nouns; `PII:` marks the flows that may carry personal data. Not native UML; drawn as a flowchart.

## Diagram

```mermaid
---
title: DFD — Triage (level 1)
---
flowchart LR
  Source[/"Capture source<br/>(external entity)"/]
  subgraph PC ["Trust zone: owner's PC"]
    P1(("1 Triage captures<br/>(CLI)"))
    Inbox[("D1 data/inbox, data/DOMAIN<br/>images")]
    Index[("D2 data/index.jsonl<br/>ref, status, domain, tags, reasoning, category, answers")]
  end
  subgraph Provider ["Trust zone: Claude Code session and model provider"]
    Session[/"Vision model<br/>(external entity)"/]
  end
  subgraph Git ["Trust zone: public repository"]
    Log[("D3 knowledge/decisions.jsonl<br/>content hash, domain, tags, confidence, model: labels only")]
  end
  Source -->|"PII: screenshot bytes, OCR text, ref, takenAt"| P1
  P1 -->|"PII: image, named by id"| Inbox
  Inbox -->|"PII: image to classify"| P1
  Index -->|"PII: doubtful rows for UC2"| P1
  P1 -->|"PII: ref, filename, hash, status"| Index
  P1 -->|"PII: inbox image, OCR text, doubt reasoning"| Session
  Session -->|"decision payload: domain, tags, confidence, reasoning or doubt category"| P1
  P1 -->|"PII: filing or doubt reasoning, category, owner answer"| Index
  P1 -->|"labels of work captures only, keyed by content hash, no free text"| Log
  P1 -->|"ref and action: markPersonal, trash or archive"| Source
```

## Notes

- **Processor**: the model provider receives every inbox image, its OCR text and, in UC2, the doubt reasoning it wrote itself; it never receives a capture after a personal answer. Retention there follows the provider's consumer terms for the Claude Code subscription; a capture is sent again only after a `work` answer or a failed move. Legal basis: the owner's own data, processed on the owner's request.
- **Only D3 is published**: it never holds a ref, a filename, an image, or any free text, the model's reasoning included, so a `work` filing that was a false negative on a personal screenshot publishes a domain and tags at most (REQ-5, NFR-1). Its key is the content hash, and commands address captures by the 12-character id derived from it, so no filename reaches Git or a shell command.
- **D1 and D2 are git-ignored and unbacked**: losing them loses statuses and doubt answers, never a personal capture, because the source records personal, deleted and archived captures durably (ADR-0002, T-14).
- **What reaches the source**: a ref and an action; no derived text. `archive` moves a work or `other` capture into the source's private archive (`.archive/`, Immich private album), which stays in the owner's trust zone and is never published (ADR-0004).
- Residual risk: a tag could name a person or a product; tags are kebab-case topic words reviewed in the batch report. The brick 4 sheet is where derived text is published, under the rule "author's handle only", and the owner answers `delete` on confidential work content.
