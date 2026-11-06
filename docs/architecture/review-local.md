# Local review — screenshot-triage (docs/2-triage-uml-study, --push)

- Date: 2026-11-06
- Commit: 374ca92
- Scope: branch diff main...HEAD (docs only: triage UML study, ADR-0002, requirements, glossary, matrix)
- Checks run: adversarial (Opus, round 1) · design · docs · security (diff read, gitleaks) · correctness (n/a, no code)
- Verdict: fix Must Have first · Must 8 · Should 12 · Nice 8

## Adversarial review (#236)
- Round 1 on `374ca92`: Must 6 · Should 10 · Nice 6 · unverified 0 · Push gate: closed
- Round 2: pending the fix commit
- Hosted reviewers (filled at the pre-merge run): Copilot pending · Codex optional

## Pre-merge gate (head SHA 374ca92)
| Step | Result |
|---|---|
| 0 CI mirror | n/a — no `.github/workflows/` yet |
| 1 Tests | n/a — no code, no suite yet |
| 2 Coverage | ⏸ deferred (no code) |
| 3 SonarQube | ⏸ deferred to the pre-merge run (`--push`) |
| 4 Secrets | ✅ gitleaks clean (main..HEAD) · tracked env files: `.env.example` only (placeholders) · diff read: nothing sensitive |
| 5 E2E/smoke | ⏸ deferred (`--push`) |
- Gate: `--push`: **pre-push closed** — adversarial gate closed, 8 Must open

## 🔴 Must Have
- `decisions/0002-*.md:31,38`, `specs/triage-requirements.md:13`, `02-sequence-triage-batch.md:41` `[adversarial|security]` · the model's doubt reasoning is appended to the versioned, public `knowledge/decisions.jsonl` before the owner answers, so a capture later answered personal has already been summarised in public Git history; the index row also publishes the source ref (a filename that may name the app) · owner decision (question 1): keep the index private in `data/`, log a reason category only at doubt time, copy free text into the versioned log only on a work answer.
- `glossary.md:7`, `02-sequence-triage-batch.md:23-35`, `05-state-capture.md:20`, `01-use-case.md:71` `[adversarial|design|docs]` · a capture is keyed by its content hash, so a duplicate `upsert` overwrites the original row; the loop guard and the duplicate branch use two undefined keys · fix: `id` = source ref, `contentHash` a field, loop skips known refs, duplicate row carries `duplicateOf`.
- `05-state-capture.md:23`, `02-sequence-resolve-doubt.md:24-28`, `01-use-case.md:98-101` `[adversarial|design|docs]` · the `work` answer is `resolve(work) then file` in the state machine but a lone `file` in the sequence; the owner's answer is never logged and `X then Y` is not one trigger · fix: `resolve --as work` logs the answer and moves `Doubtful → Inbox`; then the normal `file`; dry-run limited to personal and delete.
- `05-state-capture.md:9,28` vs `CLAUDE.md:7` `[adversarial|docs]` · "exactly three deleting transitions" is false (`Duplicate → Deleted` is a fourth) and that one has neither owner answer nor sheet · owner decision (question 2): guard `[original final]` and amend the invariant, or drop the transition.
- `CLAUDE.md:8`, `README.md:9`, issue #2 vs `01-use-case.md:72` `[adversarial]` · "doubt stops the pipeline" vs "the batch continues, questions after the batch" (owner chose the latter on 2026-11-06) · fix: reword the invariant, the README and the acceptance criteria of #2 to "held and asked after the batch".
- `decisions/0002-*.md:25` `[adversarial|docs]` · the sensitivity claim "C overtakes B only at autonomy ≥ 30" is wrong (C wins from ≈ 20; at 30 A and C tie, B last) · fix: correct the sentence and add the revisit trigger (brick 6).
- `02-sequence-triage-batch.md:41,44`, `02-sequence-resolve-doubt.md:26`, `decisions/0002-*.md:29` `[design|security]` · model-written free text travels through shell argv (`--reasoning "…"`), an injection path and a 6-field data clump missing prompt version, considered tags and model · fix: one JSON decision object on stdin, validated by one schema in `src/triage/`; ADR-0002 consequence "free text never travels through argv".
- `README.md:24,27,29` `[docs]` · layout lines name `pull | triage | extract | enrich | purge` and put statuses in `index/`; the study fixes `scan · file · doubt · resolve · status · tags` and the enum in `src/triage/` · fix: align the three lines.

## 🟡 Should Have
- `01-use-case.md:30-36` `[adversarial|docs]` · no `UC2 --- Source` association although UC2 calls the source · add it.
- `02-sequence-triage-batch.md:26` vs `03-component.md:43` `[docs]` · `date` vs `takenAt` in the port contract · `takenAt` everywhere.
- `traceability-matrix.md` `[adversarial|docs]` · `SEQ-…` IDs defined nowhere; cells are unpaired lists; REQ-1, REQ-2 and the tag part of REQ-7 have no test; NFR-1 test "gitleaks" does not detect images · add the IDs to the diagram headers, pair the cells, add T-11 to T-13, NFR-1 test = `.gitignore` check.
- `01-use-case.md:73`, `specs:10` `[adversarial|docs]` · REQ-2 "names the tags considered" has no field; "no existing tag covers it" is a semantic judgement the CLI cannot make · `consideredTags` in the payload; the CLI checks kebab-case and non-existence only.
- `specs/triage-requirements.md:15` `[adversarial]` · REQ-7 "no covering skill" needs a tag→skill mapping the CLI does not have; the 90-day anchor is undefined · narrow to "tags at ≥ 5 captures", anchor on `takenAt`.
- `02-sequence-resolve-doubt.md:51` `[adversarial|design]` · "pending source action" retry has no field, state or command; on the local source no call can fail · defer the retry to brick 3; state that delete and move are idempotent and `scan` re-presents an inconsistent row.
- `decisions/0002-*.md:31` `[adversarial]` · log fields lack the model id · add `model`.
- `docs/architecture/README.md:22` `[adversarial]` · data-flow skipped although personal screenshots are processed and derived text is published · add a short `06-data-flow.md` flagging the PII flows.
- `README.md:9`, glossary `[adversarial]` · `work` undefined; a confidential employer capture answered `work` would be published · define `work` as "keep as dev or design watch"; confidential → `delete`.
- `03-component.md:28-32` `[adversarial|design]` · composition-root dependency `cli → adapters` and the port's file location missing · add the arrows and `src/sources/capture-source.ts`.
- `05-state-capture.md:32-33,53-54` `[design]` · re-file `Triaged → Triaged` has no use case; `after(90 d)` is a `status` query, not a lifecycle event · add UC1 ext. 5b (owner corrects the domain, valuable brick 6 label) and drop the 90-day row.
- `03-component.md`, `02-sequence-triage-batch.md:37` `[design]` · domains and tags served by `scan`, `tags` and `status` · `tags` only; `scan` returns inbox captures; a pure `transition(capture, event) → { next, effects[] }` in `src/triage/` with one effect runner handling `--dry-run` and the effect order (REQ-6).
- `glossary.md` `[adversarial|docs]` · statuses, answers, confidence, prompt version, source ref, purge, design gem, new-skill candidate missing; "veille" in an English artefact · add the terms; "watch".

## 🔵 Nice to Have
- `05-state-capture.md:9` `[adversarial]` · state ids `Inbox` vs enum `inbox` · soften the claim ("lowercased").
- `specs:23` `[adversarial|docs]` · NFR-2 drops `src/extract/` · link to the CLAUDE.md rule.
- `decisions/0002-*.md:18-22` `[adversarial]` · option C scores lack one-line reasons · add them.
- `02-sequence-resolve-doubt.md:15` `[adversarial]` · title lacks the `(scope)` · add "(skill and CLI)".
- `01-use-case.md:54` `[adversarial]` · precondition "exist (created on first run)" contradicts itself · "exist or are created on first run".
- `02-sequence-triage-batch.md:52` `[docs]` · `ref` imitated as a message · use a note.
- `03-component.md:43` `[design]` · in-memory fake beside the real local adapter · temp directory only until a test needs more; `moveToPersonalAlbum` → `markPersonal` (less leaky).
- `03-component.md:24` `[design]` · `src/index/index.ts` collides with the barrel convention · `src/store/`.

## ⚪ Disagree / Intentional
- `02-sequence-triage-batch.md:39` `[adversarial]` · classification as a self-message of the Skill, no Model lifeline · ADR-0002 makes the session the classifier.
- `docs/architecture/README.md:22` `[adversarial|design]` · class and deployment diagrams skipped · proportionality, reasons listed.
- `PROJECT_LOG.md:10` `[docs]` · the old `adr/` path in the rename narrative · historical record.
- `03-component.md:43` `[design]` · `CaptureSource` port with one adapter today · the Immich adapter is a recorded commitment (ADR-0001 brick 3).
- Pre-existing, out of scope: ADR-0001 § Bricks and decision 8 still place bricks 2–4 and the sheets in `~/.claude` while decision 12 and CLAUDE.md place them here → noted for an amendment line in ADR-0002.

## Per-dimension summary
- Adversarial: 6 Must, privacy leak of doubt reasoning into a public log is the critical one; gate closed · Design: identity key, argv free text, `work` modelling; one structural step (pure transition + effect runner) · Docs: same key and `work` defects plus stale README lines and naming drift · Security: no secret in the diff; the privacy and argv findings are design-level · Correctness: n/a, no code.
