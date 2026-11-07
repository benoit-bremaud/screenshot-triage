# Extract — requirements

Requirements of the extraction step (brick #4), numbered after the triage ones and cited by the use cases, diagrams and matrix.

## Functional

| ID | Requirement | Source |
|---|---|---|
| REQ-10 | `extract <id> [--dry-run]` accepts only a `triaged` or `extracted` capture whose domain is not `other`, and one sheet payload on stdin, validated by one schema: prompt version, model, title, summary, rules (1 to 9; rank 1 to 9, unique, kept across rewrites; text, kind `technical` or `design`, status, optional `https` evidence without backtick, `<`, `>` or whitespace), justification, target skill (kebab-case), optional author handle, optional `gem`; domain and tags are read from the index row. | ADR-0003 decision 1 |
| REQ-11 | A technical rule has the status `verified`, `contradicted` or `not-found`; a design rule `consistent` or `in-tension`; any other pairing is rejected. | ADR-0001 decision 9 |
| REQ-12 | The CLI writes the sheet `knowledge/<domain>/<id>.md` from a fixed template that escapes Markdown and HTML and renders each rule as a list item opening with its citation `[<id>#<rank>]` and status, evidence as a code span; the sheet holds the id, derived text and the author's handle only, never a ref, a filename or an asset id. | ADR-0003 consequences, NFR-1 |
| REQ-13 | A thumbnail, 800 px wide JPEG, is written to `data/thumbnails/<id>.jpg` only for a `design` capture in `png`, `jpg` or `webp` whose payload sets `gem`, and removed when a re-extraction drops `gem`. | ADR-0001 decision 7, ADR-0003 |
| REQ-14 | `purge` sets `deleted` for every `extracted` capture and its duplicates: per original, the duplicates' `source.trash` and rows first, then the local delete, `source.trash` and the original's row; it changes no capture in another status; a re-run after a crash completes; `purge --dry-run` prints the effects in order and changes nothing. | ADR-0003 decision 2, REQ-3, REQ-6 |
| REQ-15 | `notes --skills-dir DIR` writes nothing in the working trees (it only fetches `origin` of `DIR`'s repository) and returns, per target skill, the rules whose citation `<id>#<n>` is absent, as a whole token, from `references/field-notes.md` on `origin/main` of `DIR`'s repository after a `git fetch`, split into `adopted` (verified, consistent) and `to-confirm` (contradicted, not-found, in-tension), rendered as escaped Markdown items, and the new-skill candidates. | ADR-0003 decision 3 |
| REQ-16 | `resolve personal` and `resolve delete` are accepted on a `triaged` capture, with the effects they have on a `doubtful` one (duplicates included, reasoning cleared on personal); its labels line in the decision log stays (labels only, ADR-0002) and brick 6 reads the final status from the index. | ADR-0003 consequences |
| REQ-17 | `status` also lists the `triaged` captures with id, path, domain and tags. | `02-sequence-extract-batch.md` |

## Non-functional

| ID | Requirement | Source |
|---|---|---|
| NFR-4 | Text derived from a screenshot is untrusted: field lengths are bounded, control characters rejected, and nothing rendered from the payload into a sheet or a field-notes item is a live link, image, heading, HTML or fenced block. | ADR-0003 consequences, `security-policy` (LLM output handling) |
| NFR-5 | Tests cover the brick 4 transitions of `05-state-capture.md`, the payload schema, the renderer and its round trip through `notes`, the thumbnail rule, the purge and the new `resolve` and `status` behaviour (T-16 to T-23). | global testing rule |
| NFR-6 | `src/extract/` imports neither `src/sources/`, `src/store/`, `node:fs` nor `sharp`, enforced by a `no-restricted-imports` block. | ADR-0003 consequences |
