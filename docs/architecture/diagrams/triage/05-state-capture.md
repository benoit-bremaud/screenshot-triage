# State machine diagram — triage — Capture

> **Feature**: epic #1, brick #2 (brick 4 transitions drawn so the enum is final, implemented in brick 4)
> **Related ADRs**: ADR-0001 (decision 7 and § Lifecycle), ADR-0002
> **Realises**: UC1, UC2 · **See also**: `02-sequence-triage-batch.md`, `02-sequence-resolve-doubt.md`

## Context

The lifecycle of one capture as recorded in `data/index.jsonl`. The state names, lowercased, are the values of the `status` enum in `src/triage/`; the diagram is the source of truth for the legal transitions and the code must refuse the others. Deletion is an effect of exactly four events: two owner answers (applied to the capture and its duplicates), the purge after a sheet, and `scan` meeting a copy of a capture already personal (index row or id in `Personnel/`) or still in `.trash/`, whose new copy follows that status at once.

## Diagram

```mermaid
---
title: stm — Capture
---
stateDiagram-v2
  direction LR
  [*] --> Inbox: scan [else, i.e. no other scan guard holds] / copy to data/inbox
  [*] --> Duplicate: scan [hash known, original not final] / index row with duplicateOf
  [*] --> Personal: scan [hash of a personal capture, or id in Personnel/] / index row with duplicateOf, source.markPersonal
  [*] --> Deleted: scan [id still in .trash/] / index row with duplicateOf, source.trash
  Inbox --> Triaged: file(decision) / move to data/domain, append decision
  Inbox --> Doubtful: doubt(category, reasoning) [doubtAnswer is not work] / index row only
  Doubtful --> Inbox: resolve(work) / record the answer
  Doubtful --> Personal: resolve(personal) / delete local file, source.markPersonal (duplicates too), clear reasoning
  Doubtful --> Deleted: resolve(delete) / delete local file, source.trash (duplicates too)
  Triaged --> Extracted: sheet written (brick 4) / thumbnail if design gem
  Extracted --> Deleted: purge (brick 4) / delete local file, source.trash
  Duplicate --> Personal: resolve(personal) on the original / source.markPersonal
  Duplicate --> Deleted: resolve(delete) on the original / source.trash
  Duplicate --> Deleted: purge [original deleted by purge] (brick 4) / source.trash
  Personal --> [*]
  Deleted --> [*]
  note right of Triaged
    file(decision) / re-file to the new domain, append decision with answer = correction (internal)
  end note
  note right of Doubtful
    resolve(personal or delete) --dry-run / print effects, no transition
  end note
```

## Transitions and tests

| From | Event [guard] | To | Effect | Test |
|---|---|---|---|---|
| — | `scan` [else: no other `scan` guard holds] | Inbox | copy into `data/inbox/`, row with `contentHash` (covers an unknown hash and a restored deleted capture) | T-1 |
| — | `scan` [hash known, original not final] | Duplicate | row with `duplicateOf`, no copy | T-2 |
| — | `scan` [hash of a personal capture, or id in `Personnel/`] | Personal | row with `duplicateOf`, `source.markPersonal` (collision rule) | T-14 |
| — | `scan` [id still in `.trash/`] | Deleted | row with `duplicateOf`, `source.trash` (collision rule) | T-14 |
| Inbox | `file(decision)` | Triaged | move to `data/<domain>/<id>.<ext>`, decision appended (skipped if already there), index written, in that order | T-3 |
| Inbox | `doubt(category, reasoning)` [doubtAnswer ≠ work] | Doubtful | index row only, nothing appended to the log | T-4 |
| Doubtful | `resolve(work)` | Inbox | `doubtAnswer = work` on the row; the following `file` logs `answer = work` | T-5 |
| Doubtful | `resolve(personal)` | Personal | local delete, `source.markPersonal` of the capture and its duplicates, reasoning cleared | T-6, T-14 |
| Doubtful | `resolve(delete)` | Deleted | local delete, `source.trash` of the capture and its duplicates | T-6, T-14 |
| Doubtful | `resolve(personal or delete) --dry-run` | Doubtful | effects printed in order, nothing changed | T-7 |
| — | `scan --dry-run` | — | nothing changed: no copy, no row, every effect printed in order, the 2a source action included | T-7 |
| Triaged | `file(decision)` | Triaged | re-file to another domain folder, decision appended with `answer = correction` | T-8 |
| any other (state, event) pair | — | unchanged | rejected with the current status, non-zero exit | T-10 |
| Triaged | sheet written | Extracted | brick 4 | brick 4 |
| Extracted | purge | Deleted | brick 4 | brick 4 |
| Duplicate | `resolve(personal)` on the original | Personal | `source.markPersonal` (or removal from the source when `Personnel/<id>.<ext>` already holds the identical bytes) | T-14 |
| Duplicate | `resolve(delete)` on the original | Deleted | `source.trash` (same collision rule) | T-14 |
| Duplicate | purge [original deleted by purge] | Deleted | brick 4 | brick 4 |

T-9 (90-day reminder) and T-11 to T-13 belong to UC3 and the tag rules, not to this machine; T-14 (a fresh `scan` after losing the index lists no personal or deleted capture) belongs to the source; see the matrix.

## Notes

- **Rejected events** (T-10 covers one of each): `resolve` on a non-doubtful capture, `file` on a deleted, personal, doubtful or duplicate capture, `doubt` on a triaged capture or on an inbox capture whose `doubtAnswer` is `work`.
- **Personal and Deleted are the final statuses** (glossary "Final status") and never re-enter: a personal capture's content is never read again (REQ-5; only the ids in `Personnel/` are listed); a wrongly deleted asset is restored by the owner from the source trash, outside this tool, and the next `scan` then treats it as new (its id is no longer in `.trash/`, so the index row alone does not re-trash it; T-14). The source records both durably, so losing the index never resurfaces them.
- **Duplicate** is reached only from the initial pseudostate, and only while its original is not final; a copy of a personal or deleted capture that comes back to the source (a phone re-sync) is settled by `scan` itself, so it is never readable after a lost `data/`: the duplicate file is never copied, so there is nothing local to delete. Its row follows its original: when the original is answered personal or delete, every `duplicateOf` row takes the same final status in the same `resolve` effect list, with the same source action, so the brick 4 purge never touches it again; the purge only trashes a duplicate whose original it purged itself (the guard keeps the CLAUDE.md invariant). On the local source a duplicate and its original share the `<id>.<ext>` name: when the target already exists, the duplicate file is removed from the source instead of moved, the bytes being identical.
- **The four `scan` guards are evaluated in this order, and the first true one fires**: Personal (index row or id in `Personnel/`), then Deleted (id still in `.trash/`), then Duplicate (hash known, original not final), then Inbox as the `[else]`. So after `data/` is lost, a re-synced copy of a personal capture takes the Personal branch, never the Inbox one (T-14 asserts it). The two guards on a returning copy differ on purpose. Personal is the conservative one: the index row or an id in `Personnel/` (Immich: album membership) settles the copy, so it holds after `data/` is lost. Deleted uses the source as the only witness: the copy is re-trashed only while `.trash/<id>.<ext>` (Immich: trash membership) still exists, so a file the owner restored is triaged again as new (T-14). `scan --dry-run` changes nothing and prints every effect (T-7).
- The `Inbox → Inbox` case after a failed move (UC1 ext. 5a) is not a transition: the row keeps `inbox` with an `error` field and the next `scan` presents it again.
