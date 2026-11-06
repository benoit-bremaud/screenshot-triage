# Use case diagram — triage — who wants what from the triage step

> **Feature**: epic #1 — [Screenshot triage pipeline](https://github.com/benoit-bremaud/screenshot-triage/issues/1), brick #2
> **Source specs**: `docs/architecture/specs/triage-requirements.md`
> **Related ADRs**: ADR-0001 (decisions 1, 5, 6, 7), ADR-0002 (classification by the Claude Code session, decision log)
> **See also**: `02-sequence-triage-batch.md` (SEQ-triage-batch), `02-sequence-resolve-doubt.md` (SEQ-resolve-doubt), `03-component.md`, `05-state-capture.md`, `06-data-flow.md`

## Context

Phase 0 of brick 2: the goals the owner reaches through the triage step, before any extraction (brick 4). The subject is the whole product, CLI and `/screenshots` skill together; the vision model is the Claude Code session itself (ADR-0002), drawn as a supporting actor because the subject does not control it. Extraction, enrichment and the Immich adapter are out of scope here.

## Diagram

```mermaid
---
title: uc — Triage
---
flowchart LR
  Owner["👤 Owner"]
  Source["«actor» Capture source"]
  Model["«actor» Vision model"]
  subgraph SUBJECT ["screenshot-triage"]
    subgraph Triage ["Triage domain"]
      UC1(["UC1 Triage new captures"])
      UC2(["UC2 Decide the fate of a doubtful capture"])
    end
    subgraph Review ["Review domain"]
      UC3(["UC3 Review the triage status"])
    end
  end
  Owner --- UC1
  Owner --- UC2
  Owner --- UC3
  UC1 --- Source
  UC1 --- Model
  UC2 --- Source
  UC2 --- Model
  UC2 -.->|"«extend» [capture held as doubtful] at Doubt"| UC1
```

## Actors

| Id | Label | Kind | Goals |
|---|---|---|---|
| `Owner` | Owner — the person whose phone takes the screenshots | primary, human | UC1, UC2, UC3 |
| `Source` | Capture source — a local directory in brick 2, the Immich server from brick 3 | supporting, system | provides the captures and, from brick 3, their OCR text; receives the personal mark and trash requests |
| `Model` | Vision model — the Claude Code session running `/screenshots` (ADR-0002) | supporting, system | classifies a capture into a domain and tags, or declares a doubt category, with its reasoning |

## Use cases

### UC1 — Triage new captures (status: planned)

- **Level**: user goal
- **Primary actor**: Owner
- **Stakeholders & interests**: Owner — every new capture lands in the right domain folder with reusable tags, nothing is deleted at this step, nothing about a possibly personal capture leaves the PC; future skills (brick 4) — tags and domains are consistent; brick 6 — every filing decision is logged with its reasoning.
- **Preconditions**: the source is reachable; the data folder and the index exist or are created on first run.
- **Minimal guarantee**: no capture is lost or deleted; a capture that could not be classified stays in the inbox with status `inbox` or `doubtful`; no free text about a doubtful capture is written outside the git-ignored `data/`.
- **Success guarantee**: every new capture has a row in the index with status `triaged`, `doubtful` or `duplicate`; triaged files sit under `data/<domain>/`; every filing is appended to the decision log.
- **Trigger**: the owner runs `/screenshots` (or the CLI `scan` then `file` commands).

**Main success scenario**

1. Owner asks for a triage.
2. System lists the captures of the source whose ref is not yet in the index, reads each one, computes its content hash and copies it into the inbox.
3. System presents each inbox capture (image, OCR text when the source has it) with the domain list and the current tag list (from `tags`).
4. Vision model returns a domain, tags (reused before created, with the existing tags it considered), a confidence and a two-to-three-sentence reasoning.
5. System moves the file into the domain folder, records the row with status `triaged` and appends the decision (keyed by content hash, never by ref) to the decision log.
6. Steps 3–5 repeat for every inbox capture.
7. System reports the batch: counts per domain, new tags, number of doubtful captures held.

**Extensions**

- 2a. The content hash is already in the index: system records the capture as `duplicate` with a pointer to the original, copies nothing; resumes at 6.
- 4a. The vision model declares a doubt (category `personal-suspected`, `unreadable` or `off-topic`): system records the row as `doubtful` with the category and keeps the model's reasoning in the index only (git-ignored); the batch continues; **extension point "Doubt"** → UC2 after the batch.
- 4b. The vision model proposes a tag absent from the list: system accepts it if it is kebab-case English and not already present; the model names the existing tags it considered (the semantic judgement stays with the model); the new tag is listed in the report.
- 5a. The file move fails: the row stays `inbox` with the error; the batch continues and the next `scan` presents the capture again.
- 5b. Owner corrects the domain of a triaged capture later (`file` again): system moves the file to the new domain folder and logs the decision with `answer: correction`, `model: owner` and no confidence, a valuable label for brick 6.

**Relationships**: extended by UC2 at "Doubt".
**Business rules**: REQ-1 (fixed domains), REQ-2 (tags reused before created), REQ-3 (no deletion on triage), REQ-4 (decision log), REQ-5 (nothing about a personal capture leaves the tool), NFR-1 (no image or private text in Git).

### UC2 — Decide the fate of a doubtful capture (status: planned)

- **Level**: user goal
- **Primary actor**: Owner
- **Stakeholders & interests**: Owner — personal captures are never read or summarised; a wrong "delete" is recoverable while the source trash keeps the asset; a confidential work capture is answered `delete`, never `work`, because a `work` filing is published as derived text.
- **Preconditions**: at least one capture has status `doubtful`.
- **Minimal guarantee**: nothing changes until the owner answers; with `--dry-run` nothing changes at all and the planned effects are printed.
- **Success guarantee**: the capture has a status consistent with the answer, the local file reflects it, the source has been told (brick 3), the answer is recorded.
- **Trigger**: the owner answers the questions asked after a triage batch, or runs the CLI `resolve` command.

**Main success scenario**

1. System presents one doubtful capture with the doubt category and reasoning and the three answers: work, personal, delete.
2. Owner answers.
3. System applies the answer (extensions 3a–3c) and records it.
4. Steps 1–3 repeat for every doubtful capture.

**Extensions**

- 3a. Answer is **work** (keep as dev or design watch): system records `resolve --as work` in the index row and returns the capture to `inbox`; the vision model classifies it with doubt disallowed (`other` stays available); UC1 step 5 follows and the decision log entry carries `answer: work`.
- 3b. Answer is **personal**: system deletes the local file without reading it further, asks the source to mark the asset personal (local directory: moved to its `Personnel/` subfolder; Immich: the `Personnel` album), records status `personal` in the index only.
- 3c. Answer is **delete**: system deletes the local file, asks the source to trash the asset (local directory: moved to its `.trash/` subfolder; Immich: the trash), records status `deleted` in the index only.
- 3d. `--dry-run` is set on a personal or delete answer: system prints the effects and changes nothing.
- *a. Owner postpones: the capture stays `doubtful` and is listed by UC3.

**Relationships**: extends UC1 at "Doubt".
**Business rules**: REQ-3, REQ-4, REQ-5 (durable at the source, so a lost index never resurfaces a personal capture), REQ-6 (`--dry-run` on every destructive command), REQ-9 (commands take an id, never a filename).

### UC3 — Review the triage status (status: planned)

- **Level**: user goal, brief: the owner runs `status` and reads counts per status and domain, the doubtful captures awaiting an answer (the list UC2 iterates), the tags with their capture counts (a tag at five captures is flagged as a new-skill candidate; whether a skill already covers it is the owner's call with the skill list of `~/.claude`), and the `other` captures whose `takenAt` is older than 90 days.
- **Business rules**: REQ-7.

## Notes

- Deletion never appears in UC1: it is a UC2 effect (owner answer) or a brick 4 effect (final status after the sheet, or a duplicate whose original is final). Reviewers should check that no step of UC1 removes a file.
- "Receive the doubt question" is not a use case; the owner's goal is UC2.
- Open question for brick 3: whether a personal answer also removes the asset from the Screenshots album (the album move may suffice).
