# Triage — requirements

Requirements of the triage step (brick #2), numbered per repository and cited by the use cases, diagrams and matrix.

## Functional

| ID | Requirement | Source |
|---|---|---|
| REQ-1 | A capture is filed into exactly one of the fixed domains `frontend`, `design`, `backend`, `devops`, `ai-tooling`, `product`, `career`, `other`; the CLI rejects any other value. | ADR-0001 decision 6 |
| REQ-2 | Tags are kebab-case English, reused before created: the classification request carries the current tag list; a new tag comes with the existing tags the model considered; the CLI checks format and non-existence only. | ADR-0001 decision 6, this study |
| REQ-3 | Triage never deletes: a file is removed only by an owner answer (personal, delete), after its extraction sheet exists (brick 4), or for a duplicate, with its original's answer or purge (also when the copy appears after that answer). | ADR-0001 decision 7, CLAUDE.md |
| REQ-4 | Every `file` decision is appended to `knowledge/decisions.jsonl` with content hash, timestamp, prompt version, model, domain, tags, considered tags, confidence and answer (`work`, `correction` or none); the reasoning stays in the private index. | ADR-0002 |
| REQ-5 | A capture answered personal is never read or summarised again, even after the index is lost: the source records it durably (local `Personnel/` subfolder skipped by `listCaptures`, Immich album); no ref, filename or free text about any capture reaches the versioned log; the only data sent outside is its ref, to the source. | CLAUDE.md, ADR-0002 |
| REQ-6 | Every command with a destructive effect accepts `--dry-run` and then prints its effects, in execution order, without applying them. | CLAUDE.md |
| REQ-7 | `status` lists counts per status and domain, the doubtful captures awaiting an answer, the tags with their capture counts (five or more flagged as new-skill candidates) and the `other` captures whose `takenAt` is older than 90 days. | ADR-0001 § Taxonomy and § Lifecycle |
| REQ-8 | Illegal status transitions are rejected with the current status and a non-zero exit code. | `05-state-capture.md` |
| REQ-9 | Commands address a capture by its id (`[0-9a-f]{12}`), never by its ref or filename; a filename never reaches argv. | ADR-0002 |

## Non-functional

| ID | Requirement | Source |
|---|---|---|
| NFR-1 | No third-party image or private text in Git: `data/` (images, index) is git-ignored; `knowledge/` holds derived text of work captures only. | ADR-0001 decision 12, ADR-0002 |
| NFR-2 | The dependency rule of `CLAUDE.md`: only `src/sources/` imports a source SDK, enforced by a `no-restricted-imports` lint rule. | CLAUDE.md |
| NFR-3 | Unit tests cover every transition and one rejected event per state of `05-state-capture.md` (T-1 to T-8, T-10), the UC3 and tag rules (T-9, T-11 to T-13), the durability of final statuses at the source (T-14) and the id-only addressing (T-15). | global testing rule |
