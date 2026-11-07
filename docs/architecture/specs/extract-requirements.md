# Extract — requirements

Requirements of the extraction step (brick #4), numbered after the triage ones and cited by the use cases, diagrams and matrix.

## Functional

| ID | Requirement | Source |
|---|---|---|
| REQ-10 | `extract <id>` accepts only a `triaged` or `extracted` capture and one sheet payload on stdin, validated by one schema: prompt version, model, title, summary, rules (text, kind `technical` or `design`, status, optional `https` evidence), justification, tags, target skill (kebab-case), optional author handle, optional `gem`. | ADR-0003 decision 1 |
| REQ-11 | A technical rule has the status `verified`, `contradicted` or `not-found`; a design rule `consistent` or `in-tension`; any other pairing is rejected. | ADR-0001 decision 9 |
| REQ-12 | The CLI writes the sheet `knowledge/<domain>/<id>.md` from a fixed template that escapes Markdown and HTML; the sheet holds the id, derived text and the author's handle only, never a ref, a filename or an asset id. | ADR-0003 consequences, NFR-1 |
| REQ-13 | A thumbnail, 800 px wide JPEG, is written to `data/thumbnails/<id>.jpg` only for a `design` capture whose payload sets `gem`. | ADR-0001 decision 7 |
| REQ-14 | `purge` deletes the local file, trashes the source asset and sets `deleted` for every `extracted` capture, then for every duplicate whose original it purged; it never touches another status; `purge --dry-run` prints the effects in order and changes nothing. | ADR-0003 decision 2, REQ-3, REQ-6 |
| REQ-15 | `notes --skills-dir DIR` is read-only and returns, per target skill, the rules of the sheets whose id is not cited in `DIR/<skill>/references/field-notes.md`, split into `adopted` (verified, consistent) and `to confirm` (contradicted, not-found, in-tension), and the new-skill candidates. | ADR-0003 decision 3 |

## Non-functional

| ID | Requirement | Source |
|---|---|---|
| NFR-4 | Text derived from a screenshot is untrusted: field lengths are bounded, control characters rejected, the rendered sheet contains no link, image, heading, HTML or fenced block coming from the payload except the escaped evidence URLs. | ADR-0003 consequences, `security-policy` (LLM output handling) |
| NFR-5 | Tests cover the brick 4 transitions of `05-state-capture.md`, the payload schema, the renderer and its round trip through `notes`, the thumbnail rule and the purge (T-16 to T-21). | global testing rule |
