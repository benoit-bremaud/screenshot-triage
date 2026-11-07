# Component diagram — extract — where brick 4 plugs into the CLI

> **Feature**: epic #1, brick #4
> **Related ADRs**: ADR-0002, ADR-0003
> **Realises**: UC4, UC5, UC6 · **See also**: `../triage/03-component.md` (the rest of the CLI)

## Context

Brick 4 adds one package, `src/extract/`, and three commands; it reuses the store, the effect runner and the `CaptureSource` port of brick 2. Only the new and the touched components are drawn.

## Diagram

```mermaid
---
title: cmp — Extract (component level)
---
flowchart LR
  subgraph Claude ["Claude Code (owner configuration)"]
    Skill["/screenshots skill"]
    Notes[("skills/SKILL/references/field-notes.md (main)")]
  end
  subgraph Repo ["screenshot-triage (Node CLI)"]
    Cmd["src/commands/extract.ts<br/>extract · purge · notes"]
    Extract["src/extract/<br/>sheet payload schema, render(sheet) → Markdown,<br/>parse(Markdown) → rules, uncited(rules, notes), render items"]
    Thumb["src/thumbnail.ts<br/>(sharp)"]
    Triage["src/triage/<br/>transition: extract, purge"]
    Effects["src/effects.ts"]
    Store["src/store/"]
    Port(("CaptureSource port"))
    Cmd --> Extract
    Cmd --> Triage
    Cmd --> Effects
    Cmd --> Store
    Effects --> Thumb
    Effects --> Port
  end
  Skill -.->|"runtime: child process, JSON on stdin and stdout"| Cmd
  Cmd -.->|"runtime: git show main:, read only"| Notes
  Effects -.->|"runtime: write"| Sheets[("knowledge/DOMAIN/ID.md")]
  Thumb -.->|"runtime: write"| Thumbs[("data/thumbnails/ID.jpg")]
```

## Notes

- `src/extract/` is pure (schema, renderer, parser, uncited filter) and imports neither `src/sources/`, `src/store/`, `node:fs` nor `sharp`, enforced by a `no-restricted-imports` block (NFR-6); the thumbnail is an effect run by `src/effects.ts` through `src/thumbnail.ts`, so tests of the renderer need no image library.
- The new transitions (`triaged → extracted`, `extracted → extracted`, `extracted → deleted`, `duplicate → deleted` in the original's purge, `triaged → personal` and `triaged → deleted` on `resolve`) become new events (`extract`, `purge`) and new cases of `resolve` in `src/triage/transition.ts`, with new `Effect` kinds (`write-sheet`, `write-thumbnail`, `remove-thumbnail`) in `src/triage/effects.ts`.
- `notes` is the only brick 4 code that reads outside the repository and `data/`; it reads one fixed path per skill from `main` and never writes there.
