# Glossary

Every domain term used in the diagrams, defined once. Alphabetical, English headword.

| Term | Definition | Source |
|---|---|---|
| Answer | The owner's reply to a doubtful capture: `work` (keep as dev or design watch), `personal`, or `delete` (also the right answer for confidential work content, since a `work` filing is published). | `01-use-case.md` UC2 |
| Batch | One run of `scan` and the filings that follow it in the same session; doubtful captures are held and asked after the batch. | `02-sequence-triage-batch.md` |
| Capture source | The place captures come from: a local directory (brick 2) or the Immich server (brick 3); the `CaptureSource` port in code. | `03-component.md` |
| Capture | One screenshot taken on the phone; identified by its ref, deduplicated by its content hash; has one status. | ADR-0001 |
| Confidence | The model's self-assessed probability, 0 to 1, that the domain is right; stored in the decision log. | ADR-0002 |
| Content hash | SHA-256 of the file bytes; detects duplicates and identifies a capture in the versioned decision log so no filename reaches Git. | ADR-0002 |
| Correction | A `file` on an already triaged capture by the owner, moving it to another domain; logged with `answer: correction`, `model: owner` and no confidence, so brick 6 can tell human labels from model labels. | `01-use-case.md` UC1 ext. 5b |
| Decision log | `knowledge/decisions.jsonl`, append-only, versioned, one line per `file` decision, labels only (no reasoning); training material for brick 6, which reads the last line per hash and the reasoning from the private index. | ADR-0002 |
| Decision payload | The JSON object a `file` or `doubt` command reads on stdin: prompt version, model, domain, tags, considered tags, confidence (required on a first filing, absent on a correction), reasoning (or category for a doubt). | ADR-0002 |
| Design gem | A `design` capture worth keeping as an 800 px thumbnail outside Git when purged (brick 4). | ADR-0001 decision 7 |
| Domain | One of the eight fixed folders a capture is filed into; the dominant subject of the capture. | ADR-0001 § Taxonomy |
| Doubt | The model's refusal to pick a domain, with a category: `personal-suspected`, `unreadable` or `off-topic`; holds the capture until the owner answers. | CLAUDE.md |
| Evidence | The `https` URL that supports the status of a rule (documentation page, skill file). | ADR-0003 |
| Field notes | `references/field-notes.md` of a skill in `~/.claude`: rules from sheets, split into adopted and to confirm, each citing its sheet; observations, not instructions. | ADR-0001 decision 8, ADR-0003 |
| Final status | `personal` or `deleted`: the capture is gone from the PC and recorded as such at the source. `extracted` is not final; the purge makes an extracted capture `deleted`. A duplicate follows its original into a final status: at the original's `resolve`, at `scan` when the hash is already personal (index row, or id present in `Personnel/`) or still in `.trash/`, or at the brick 4 purge of the original. | `05-state-capture.md` |
| Id | The first 12 hex characters of the content hash; the only capture identifier that travels on argv, and the name of every local copy (`data/inbox/<id>.<ext>`, `data/<domain>/<id>.<ext>`, `Personnel/<id>.<ext>`, `.trash/<id>.<ext>`; `<ext>` from the magic bytes, whitelisted). Unique among addressable rows because duplicates receive no command; a command resolves the id to the row that is not final (on the local source a restored file gets a new inbox row next to its old `deleted` row; on Immich the `deleted` row is replaced). | ADR-0002 |
| Identical log line | The line a `file` would append equals the last line for that hash in every field but the timestamp (the reasoning is never in it); the append is skipped only then. | ADR-0002 |
| Index | `data/index.jsonl`, git-ignored, one row per capture: ref, filename, content hash, status, domain, tags, the model's reasoning (filing or doubt), doubt category, owner answer. | ADR-0002 |
| New-skill candidate | A tag reaching five captures; the owner checks against the skill list of `~/.claude` whether a skill already covers it. | ADR-0001 § Taxonomy |
| Owner | The person whose phone takes the screenshots and who answers the doubt question. | `01-use-case.md` |
| Personal | Final status of a capture the owner declared private: deleted locally, marked personal at the source (local `Personnel/` subfolder, Immich album `Personnel`); its content is never read again, only the ids or membership of the folder are listed. | CLAUDE.md |
| Prompt version | Identifier of the skill prompt that produced a decision; lets brick 6 group comparable labels. | ADR-0002 |
| Purge | The `purge` command (brick 4): deletes the local file and trashes the source asset once a capture is `extracted`, or for a duplicate whose original it purged. | ADR-0001 decision 7 |
| Reasoning | Two to three sentences from the model justifying a domain or a doubt; untrusted text, stored in the private index only, never in the versioned log, never interpreted. | ADR-0002 |
| Ref | The identifier of a capture at its source and the index row key: a path relative to the local directory, or the Immich asset id. Never written to the versioned log, never passed on argv (see Id). | `03-component.md` |
| Rule | One actionable statement of a sheet, of kind `technical` (status verified, contradicted, not-found) or `design` (consistent, in-tension); adopted when verified or consistent, to confirm otherwise. | ADR-0001 decision 9 |
| Sheet | The Markdown extraction of a capture, `knowledge/<domain>/<id>.md`, rendered by the CLI from a sheet payload; its existence moves the capture to `extracted` and allows the purge. | ADR-0001 decision 8, ADR-0003 |
| Sheet payload | The JSON object `extract` reads on stdin: prompt version, model, title, summary, rules, justification, tags, target skill, handle, gem. | ADR-0003 |
| Skill `/screenshots` | The Claude Code skill in `~/.claude` that drives a triage conversation and calls the CLI. | ADR-0001 decision 1 |
| Status | The lifecycle value of a capture: `inbox`, `duplicate`, `triaged`, `doubtful`, `personal`, `deleted`, `extracted` (`05-state-capture.md`). | `05-state-capture.md` |
| Tag | Free kebab-case English keyword on a capture, reused before created. | ADR-0001 § Taxonomy |
| Target skill | The skill of `~/.claude` a sheet's rules are meant for, kebab-case name. | ADR-0001 decision 6 |
| Thumbnail | 800 px JPEG kept under `data/` for a design gem; never versioned. | ADR-0001 decision 7 |
| Uncited | A sheet whose id appears in no field notes of its target skill; what `notes` proposes. | ADR-0003 decision 3 |
| Vision model | The Claude Code session running `/screenshots`, which classifies captures (ADR-0002); drawn as a supporting actor. | ADR-0002 |
