# Sequence diagram — extract — the enrichment PR (SEQ-enrichment-pr)

> **Feature**: epic #1, brick #4
> **Source specs**: `docs/architecture/specs/extract-requirements.md` (REQ-15, NFR-4)
> **Related ADRs**: ADR-0001 (decision 8), ADR-0003 (decision 3)
> **Realises**: UC6 · **See also**: `01-use-case.md`, `02-sequence-extract-batch.md`

## Context

UC6: the skill turns the uncited rules into one PR of `~/.claude`. The CLI only reads; every write in `~/.claude` is done by the session after the owner's approval, under the PR procedures of that repository.

## Diagram

```mermaid
sequenceDiagram
  title sd — UC6 Enrich the skills from new sheets
  actor Owner
  participant Skill as Skill /screenshots
  participant CLI as CLI
  participant Claude as ~/.claude (git, GitHub)
  Owner->>Skill: enrich the skills
  Skill->>Claude: any open field-notes PR?
  alt a field-notes PR is open
    Claude-->>Skill: yes
    Skill-->>Owner: merge or close it first, end
  else none
    Skill->>CLI: notes --skills-dir ~/.claude/skills
    CLI->>CLI: read knowledge/*/*.md, read each target field-notes.md, keep the uncited ids
    CLI-->>Skill: per skill: adopted, to confirm (sheet id, rule, status, evidence); candidates
    alt nothing uncited
      Skill-->>Owner: nothing to propose, end
    else rules to propose
      Skill-->>Owner: draft of each field-notes.md change and the candidates
      Owner->>Skill: approve (rules may be dropped)
      Skill->>Claude: branch, append to skills/SKILL/references/field-notes.md, commit, PR
      Claude-->>Skill: PR URL
      Skill-->>Owner: PR URL
    end
  end
```

## Notes

- A field-notes item cites its sheet as `knowledge/<domain>/<id>.md` on the public repository, which is how `notes` detects it (ADR-0003 decision 3).
- A target skill without `references/field-notes.md` is created by the PR, with the opening line of ADR-0003 (observations, not instructions).
- The PR is reviewed on Opus (ADR-0001 § Models); the session never merges it.
