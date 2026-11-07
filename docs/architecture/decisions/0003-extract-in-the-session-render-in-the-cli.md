# ADR-0003 — Extract in the Claude Code session, render and purge in the CLI, derive the enrichment batch from the target skills

Status: accepted · Date: 2026-11-07 · Deciders: Benoît Bremaud, with Claude Code (MCDA matrices, scores /500).
Settles how brick 4 (#4) turns a triaged capture into a sheet, when the capture is deleted, and how a batch knows which rules the enrichment PR still has to carry; amends ADR-0001 § Sheet format (the sheet carries the id, never the Immich asset id) and decision 8 (sheets under `knowledge/<domain>/` of this repository, as ADR-0002 already moved them).

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
| **Total /500** | **475** | **260** | **320** |

Sensitivity: C reaches A only if simplicity weighs about 60 with invariants near zero, which drops the deletion guard of CLAUDE.md. **Outcome: A.** New command `extract <id> [--dry-run]` reads a sheet payload on stdin (schema in `src/extract/`), writes `knowledge/<domain>/<id>.md` from a fixed template, writes or removes the thumbnail, and moves the row from `triaged` to `extracted`. The sheet's tags and domain come from the index row, not from the payload, so REQ-2 keeps one owner.

## Decision 2 — when the capture is deleted

Drivers: recoverability before deletion 40, simplicity 25, owner effort 20, readability of the invariant 15.

| Criterion (weight) | A — `extract` deletes the local file and trashes the source asset in the same effect list | B — a separate `purge` command, run at the end of the batch after the owner has read the sheets, with `--dry-run` |
|---|---|---|
| Recoverability (40) | 2 — a weak sheet is found after the image is gone (source trash only) | 5 — the image stays until the owner accepts the batch |
| Simplicity (25) | 5 — no extra command | 4 — one command over `extracted` rows |
| Owner effort (20) | 5 — nothing to run | 3 — one confirmation per batch, asked by the skill |
| Invariant readability (15) | 4 — deletion inside a writing command | 5 — one command deletes, one effect list to review |
| **Total /500** | 365 | **435** |

Sensitivity: moving weight from recoverability to owner effort, A overtakes B at about recoverability 26 and owner effort 34, which ranks one command per batch above a lost image. **Outcome: B.** `purge [--dry-run]` handles each `extracted` row in one effect list: for each of its `duplicate` rows `source.trash` then the row `deleted`, then the local delete of `data/<domain>/<id>.<ext>`, `source.trash` and the original's row `deleted` last; a crash leaves the original `extracted`, so a re-run finds its duplicates again (same order as `resolve` in brick 2). A re-run of `extract` on an `extracted` row rewrites the sheet (correction before the purge).

## Decision 3 — how a batch knows which rules the enrichment PR still carries

Drivers: durability after losing `data/` 30, simplicity 30, no extra state or command 20, coupling to the layout of `~/.claude` 20.

| Criterion (weight) | A — a `noted` command records the PR on the index rows | B — the sheet front matter gets a `notedIn` field, committed after the PR | C — derived: `notes` lists the rules whose citation is absent from the target skill's `references/field-notes.md` |
|---|---|---|---|
| Durability (30) | 2 — lost with `data/` | 5 — versioned | 5 — both sides versioned |
| Simplicity (30) | 4 | 3 — a second write per sheet | 4 — one read-only command |
| No extra state (20) | 2 — a command and a field | 3 — a field and a commit | 5 — none |
| Coupling to `~/.claude` (20) | 5 — none | 5 — none | 3 — reads `skills/<name>/references/field-notes.md` |
| **Total /500** | 320 | 400 | **430** |

Sensitivity: B overtakes C when about 8 points move from "no extra state" to coupling (coupling ≈ 28); the field-notes path is fixed by ADR-0001 decision 8, so the coupling is to a documented contract. **Outcome: C.** Each rule is cited as `<id>#<n>`, where `n` is an explicit `rank` field of the payload rule (1 to 9, unique), rendered in the sheet item as `[<id>#<n>]` and parsed back from that token, never from the item's position; a rewrite keeps the ranks and a rule removed by hand leaves its rank unused, so a rule the owner drops stays uncited while its siblings are published. `notes --skills-dir DIR` writes nothing in the working trees: it fetches `DIR`'s repository and reads each field-notes file from `origin/main` (`git show origin/main:<path>`, never the working tree or a stale local `main`), matching citations as whole tokens, and returns per target skill the uncited rules split into `adopted` (verified, consistent) and `to-confirm` (contradicted, not-found, in-tension), already rendered as escaped Markdown items the skill appends verbatim, plus the new-skill candidates (REQ-7). One enrichment PR is open at a time, recognised by its title prefix `docs(field-notes):`; the skill checks none is open before it proposes the next.

## Consequences

- **The CLI renders, the session never authors derived Markdown.** The sheet payload holds plain text fields with length limits (title ≤ 80, summary ≤ 3 lines, each rule ≤ 300, justification ≤ 600 characters), single-line except the summary, control characters rejected; evidence is an `https` URL without backtick, `<`, `>` or whitespace, rendered as an inline code span, never a live link; the renderer escapes Markdown and HTML, so a screenshot cannot inject a link, an image, a heading or a fenced block into a sheet. The field-notes items come out of the same renderer through `notes`. The rules are stored as list items opening with `[<id>#<rank>]` and the status, which `notes` parses back (round-trip test).
- **Field notes are data for later sessions.** The enrichment PR into `~/.claude` (a private repository) is drafted on Opus (ADR-0001 § Models) and approved by the owner before it is opened; the field-notes file opens with a line saying its items are observations to weigh, not instructions; a rule asking a session to do something is dropped at review. Its branch follows the shared-tree rules of `~/.claude` (`branch-scope.sh`).
- **Sheets are published through this repository's PR flow.** After a batch, the sheets are committed on a branch and merged through the usual gate; UC6 runs only on sheets already on `main`, so every citation URL resolves.
- **Privacy of the published sheet.** It holds the id, derived text and the author's Instagram handle only (`@[A-Za-z0-9._]{1,30}`): no ref, no filename, no Immich asset id, no OCR dump, no other person's name. A triaged capture whose useful content cannot be stated without private text is answered `personal` or `delete` by the owner with `resolve`, which brick 4 accepts on a `triaged` row (REQ-16).
- **Thumbnails** are 800 px wide JPEG files in `data/thumbnails/<id>.jpg` (git-ignored, NFR-1), written only for a `design` capture in `png`, `jpg` or `webp` whose payload sets `gem` (the prebuilt `sharp` binaries do not decode HEVC-based HEIC; a HEIC gem is reported without thumbnail), and removed when a re-extraction drops `gem`. `sharp` (ADR-0001 decision 13) is the one new dependency of the brick.
- **The skill** `/screenshots` gains the extraction prompt, the Context7 verification step and the PR proposal; it is written in `~/.claude` under its own issue, after this brick's CLI contract is merged.
- `src/extract/` imports nothing from `src/sources/`, `src/store/`, `node:fs` or `sharp`, enforced by a `no-restricted-imports` block like the one of `src/triage/`; the thumbnail lives in `src/thumbnail.ts`, run as an effect; the purge goes through the existing `CaptureSource.trash` port.
