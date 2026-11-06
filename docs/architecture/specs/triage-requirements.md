# Triage — requirements

Requirements of the triage step (brick #2), numbered per repository and cited by the use cases, diagrams and matrix.

## Functional

| ID | Requirement | Source |
|---|---|---|
| REQ-1 | A capture is filed into exactly one of the fixed domains `frontend`, `design`, `backend`, `devops`, `ai-tooling`, `product`, `career`, `other`; the model never invents a domain. | ADR-0001 decision 6 |
| REQ-2 | Tags are kebab-case English, reused before created: the classification request carries the current tag list and a new tag names the existing tags considered. | ADR-0001 decision 6 |
| REQ-3 | Triage never deletes: a file is removed only by an owner answer (personal, delete) or after its extraction sheet exists (brick 4). | ADR-0001 decision 7, CLAUDE.md |
| REQ-4 | Every classification, doubt and owner answer is appended to `knowledge/decisions.jsonl` with prompt version, domain, tags, confidence and reasoning. | ADR-0002 |
| REQ-5 | A capture answered personal is never read or summarised again; only its id and source ref leave the tool. | CLAUDE.md |
| REQ-6 | Every command with a destructive effect accepts `--dry-run` and then prints its effects without applying them. | CLAUDE.md |
| REQ-7 | `status` lists the doubtful captures, the tag counts with new-skill candidates (five captures, no covering skill) and the `other` captures older than 90 days. | ADR-0001 § Taxonomy and § Lifecycle |
| REQ-8 | Illegal status transitions are rejected with the current status and a non-zero exit code. | `05-state-capture.md` |

## Non-functional

| ID | Requirement | Source |
|---|---|---|
| NFR-1 | No third-party image in Git: `data/` is git-ignored; `knowledge/` holds derived text only. | ADR-0001 decision 12 |
| NFR-2 | `src/triage/` and `src/index/` import no source SDK; only `src/sources/` does. | CLAUDE.md |
| NFR-3 | Unit tests cover every transition and rejected event of `05-state-capture.md` (T-1 to T-10). | global testing rule |
