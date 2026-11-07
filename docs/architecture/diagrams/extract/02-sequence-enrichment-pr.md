# Sequence diagram — extract — the enrichment PR (SEQ-enrichment-pr)

> **Feature**: epic #1, brick #4
> **Source specs**: `docs/architecture/specs/extract-requirements.md` (REQ-15, NFR-4)
> **Related ADRs**: ADR-0001 (decision 8), ADR-0003 (decision 3)
> **Realises**: UC6 · **See also**: `01-use-case.md`, `02-sequence-extract-batch.md`

## Context

UC6: the skill turns the uncited rules into one PR of `~/.claude` (a private repository). The CLI only reads and renders; the session writes the rendered items verbatim, after the owner's approval, under the PR and shared-tree procedures of that repository (`branch-scope.sh`).

## Diagram

```mermaid
sequenceDiagram
  title sd — UC6 Enrich the skills from new sheets
  actor Owner
  participant Skill as Skill /screenshots
  participant CLI as CLI
  participant Claude as ~/.claude (git, GitHub)
  Owner->>Skill: enrich the skills
  Skill->>Claude: any open PR titled docs(field-notes):?
  alt a field-notes PR is open
    Claude-->>Skill: yes
    Skill-->>Owner: merge or close it first, end
  else none
    Skill->>CLI: notes --skills-dir ~/.claude/skills
    CLI->>Claude: git show main:skills/SKILL/references/field-notes.md
    CLI->>CLI: read knowledge/*/*.md, keep the rules whose ID#N is not cited, render them escaped
    CLI-->>Skill: per skill: adopted and to-confirm items (rendered Markdown), candidates
    alt nothing uncited
      Skill-->>Owner: nothing to propose, end
    else rules to propose
      Skill-->>Owner: draft of each field-notes.md change and the candidates
      Owner->>Skill: approve (rules may be dropped)
      Skill->>Claude: branch, append the items verbatim to skills/SKILL/references/field-notes.md, commit, PR docs(field-notes): …
      Claude-->>Skill: PR URL
      Skill-->>Owner: PR URL
    end
  end
```

## Notes

- A field-notes item cites `<id>#<n>` with the URL of `knowledge/<domain>/<id>.md` on `main` of the public repository, which is how `notes` detects it (ADR-0003 decision 3); the sheets are merged before UC6 runs.
- A target skill without `references/field-notes.md` is created by the PR, with the opening line of ADR-0003 (observations, not instructions).
- The PR is drafted on Opus (ADR-0001 § Models) and approved by the owner; the session never merges it.
