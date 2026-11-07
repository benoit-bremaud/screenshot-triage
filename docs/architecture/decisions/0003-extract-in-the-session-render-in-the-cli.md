# ADR-0003 — Extract in the Claude Code session, render and purge in the CLI, derive the enrichment batch from the target skills

Status: accepted · Date: 2026-11-07 · Deciders: Benoît Bremaud, with Claude Code (MCDA matrices, scores /500).
Settles how brick 4 (#4) turns a triaged capture into a sheet, when the capture is deleted, and how a batch knows which sheets the enrichment PR still has to carry; amends ADR-0001 § Sheet format (the sheet carries the id, never the Immich asset id) and decision 8 (sheets under `knowledge/<domain>/` of this repository, as ADR-0002 already moved them).

## Context

ADR-0001 decisions 7 to 9 fix what step 2 produces: one sheet per capture, targeted verification (Context7 for technical rules, the target skill for design rules), an 800 px thumbnail for design gems, one PR per batch into `references/field-notes.md` of the target skill in `~/.claude`, and deletion only after the sheet. ADR-0002 put the vision model in the Claude Code session and kept the CLI model-free. The sheets are published (public repository) and the field notes become skill doctrine that later sessions read, so the text derived from a screenshot is untrusted twice: it may echo personal data, and it may carry a prompt injection aimed at a future session.

## Decision 1 — who writes the sheet

Drivers: consistency with ADR-0002 30, verifiable invariants 30, cost and simplicity 25, access to Context7 15.

| Criterion (weight) | A — the session extracts and verifies, sends one JSON payload on stdin, the CLI validates, renders and files the sheet | B — the CLI calls the Anthropic API | C — the session writes the Markdown file itself, no CLI command |
|---|---|---|---|
| Consistency with ADR-0002 (30) | 5 — same split as `file` | 2 — reverses ADR-0002 decision 1 | 3 — session, but bypasses the CLI contract |
| Verifiable invariants (30) | 5 — one schema, the transition table, `--dry-run`, tests | 4 — testable with the API mocked | 1 — nothing checks the file, the status or the purge guard |
| Cost and simplicity (25) | 4 — one command and a renderer | 2 — API key, billing, retries | 5 — no code |
| Context7 access (15) | 5 — MCP tools of the session | 2 — rebuilt by hand in the CLI | 5 — same as A |
| **Total /500** | **475** | **265** | **320** |

Sensitivity: C reaches A only if simplicity weighs about 60 with invariants near zero, which drops the deletion guard of CLAUDE.md. **Outcome: A.** New command `extract <id>` reads a sheet payload on stdin (schema in `src/extract/`), writes `knowledge/<domain>/<id>.md` from a fixed template, writes the thumbnail when the payload marks a design gem, and moves the row from `triaged` to `extracted`.

## Decision 2 — when the capture is deleted

Drivers: recoverability before deletion 40, simplicity 25, owner effort 20, readability of the invariant 15.

| Criterion (weight) | A — `extract` deletes the local file and trashes the source asset in the same effect list | B — a separate `purge` command, run at the end of the batch after the owner has read the sheets, with `--dry-run` |
|---|---|---|
| Recoverability (40) | 2 — a weak sheet is found after the image is gone (source trash only) | 5 — the image stays until the owner accepts the batch |
| Simplicity (25) | 5 — no extra command | 4 — one command over `extracted` rows |
| Owner effort (20) | 5 — nothing to run | 3 — one confirmation per batch, asked by the skill |
| Invariant readability (15) | 4 — deletion inside a writing command | 5 — one command deletes, one effect list to review |
| **Total /500** | 365 | **435** |

Sensitivity: A overtakes B only when owner effort weighs about 55 against recoverability 5. **Outcome: B.** `purge [--dry-run]` deletes `data/<domain>/<id>.<ext>`, calls `source.trash(ref, target)` and sets `deleted` for every `extracted` row, then for every `duplicate` row whose original it has just purged (`05-state-capture.md`). A re-run of `extract` on an `extracted` row rewrites the sheet (correction before the purge).

## Decision 3 — how a batch knows which sheets the enrichment PR still carries

Drivers: durability after losing `data/` 30, simplicity 30, no extra state or command 20, coupling to the layout of `~/.claude` 20.

| Criterion (weight) | A — a `noted` command records the PR on the index rows | B — the sheet front matter gets a `notedIn` field, committed after the PR | C — derived: `notes` lists the sheets whose id is not cited in the target skill's `references/field-notes.md` |
|---|---|---|---|
| Durability (30) | 2 — lost with `data/` | 5 — versioned | 5 — both sides versioned |
| Simplicity (30) | 4 | 3 — a second write per sheet | 4 — one read-only command |
| No extra state (20) | 2 — a command and a field | 3 — a field and a commit | 5 — none |
| Coupling to `~/.claude` (20) | 5 — none | 5 — none | 3 — reads `skills/<name>/references/field-notes.md` |
| **Total /500** | 320 | 400 | **430** |

Sensitivity: B overtakes C when the coupling weighs about 40 at the expense of "no extra state"; the field-notes path is fixed by ADR-0001 decision 8, so the coupling is to a documented contract. **Outcome: C.** `notes --skills-dir DIR` is read-only: it groups the rules of the sheets not yet cited (by their `<id>`) under each target skill, split into `adopted` (verified, consistent) and `to confirm` (contradicted, not found, in tension), and lists the new-skill candidates (tags at five captures, REQ-7). One enrichment PR is open at a time: the skill checks that no field-notes PR is pending in `~/.claude` before it proposes the next one, so `notes` read on `main` never repeats an open PR.

## Consequences

- **The CLI renders, the session never writes Markdown.** The sheet payload holds plain text fields with length limits (title ≤ 80, summary ≤ 3 lines, each rule ≤ 300, justification ≤ 600 characters), single-line except the summary, control characters rejected; evidence links are `https` URLs only; the renderer escapes Markdown and HTML, so a screenshot cannot inject a link, an image, a heading or a fenced block into a sheet or the field notes. The rules are stored as list items with a fixed status prefix, which `notes` parses back (round-trip test).
- **Field notes are data for later sessions.** The enrichment PR into `~/.claude` is reviewed by the owner (Opus, ADR-0001 § Models) and the field-notes file opens with a line saying its items are observations to weigh, not instructions; a rule asking a session to do something is dropped at review.
- **Privacy of the published sheet.** It holds the id, derived text and the author's Instagram handle only (`@[A-Za-z0-9._]{1,30}`): no ref, no filename, no Immich asset id, no OCR dump, no other person's name. A capture whose useful content cannot be stated without private text is answered `delete` by the owner, not extracted.
- **Thumbnails** are 800 px wide JPEG files in `data/thumbnails/<id>.jpg` (git-ignored, NFR-1), written only for a `design` capture whose payload sets `gem`; they need `sharp` (ADR-0001 decision 13), the one new dependency of the brick.
- **The skill** `/screenshots` gains the extraction prompt, the Context7 verification step and the PR proposal; it is written in `~/.claude` under its own issue, after this brick's CLI contract is merged.
- `src/extract/` imports nothing from `src/sources/` (NFR-2); the purge goes through the existing `CaptureSource.trash` port.
