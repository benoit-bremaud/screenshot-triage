# Local review — screenshot-triage (brick 4 code)

Pre-merge review of PR #12 (`feat/4-extract-sheets-code`, closes #4): `extract`, `purge` and `notes` in the CLI.

- Date: 2026-11-07
- Commit: 6751275
- Scope: branch diff origin/main...feat/4-extract-sheets-code
- Checks run: adversarial (Opus, 3 rounds on the code, 3 verify rounds on the fixes) · design · docs · tests · security · correctness · SonarQube
- Verdict: ship as-is · Must 0 · Should 0 · Nice 2

## Adversarial review (#236)

- Rounds on the code, up to `c9a95da`: Must 2 · Should 9 · Nice several, all fixed; Push gate: open.
- Verify round on `7dc4a53` (fixes from this review): 1 Must not fixed (sharp sets no errno `code`, so the narrowed thumbnail catch never rethrew) · Push gate: closed.
- Verify round on `e55bfa4`: Must fixed (decode and write split) · Should 3 open (missing tests) · Push gate: open.
- Verify round on `6751275`: Should 3 fixed, both new tests fail on the old code · **Push gate: open**.
- Hosted reviewers: Copilot not available (request returned no reviewer) · Codex `@codex review` refused (quota); the owner waived Codex on 2026-11-07: "on merge sans review codex, mais tu lances alors la review locale avant".

## Pre-merge gate (head SHA 6751275)

| Step | Result |
|---|---|
| 0 CI mirror | n/a: no `.github/workflows` (owner rule 2026-11-07, local CI only) |
| 1 Tests | ✅ 202 vitest (unit and in-process CLI); one case `skipIf` root, not skipped here (uid 1000) |
| 2 Coverage | tests 96.36 % stmts / 89.93 % branches / 96.44 % funcs / 97.79 % lines (floor 80) · docs ≈ 100 % of exports documented (doc-auditor count, no tool) (floor 90) |
| 3 SonarQube | ✅ PASSED (new coverage 93 %, duplication 0 %, new violations 0). First run on `c9a95da` FAILED with 16 new violations; 13 fixed in code, 3 S9382 "await in a loop" in `purge` marked Accepted: purge is sequential by design (ADR-0003, one capture at a time, duplicates before the original's row), documented at `src/commands/extract.ts:69` |
| 4 Secrets | ✅ `gitleaks git` 8.30.1 clean on origin/main..HEAD (and `--all` on `c9a95da`) · only `.env.example` tracked · diff read: nothing sensitive |
| 5 E2E/smoke | n/a: CLI without a deployed product; the in-process CLI tests run every command end to end over a temporary directory and a local bare git origin |

- Gate: **GREEN — ready for the merge**. Report-only commit on top of `6751275`: `git diff --name-only 6751275 HEAD` prints `docs/architecture/review-local.md` only.

## 🔴 Must Have

- `tests/t22-t23-triaged.test.ts:40` `[tests]` · the crash-test arrangements were never asserted, so the tests could not fail · fixed in `e0706df`.
- `tests/t17-t21-payload.test.ts` `[tests]` · `\p{Co}`, `\p{Cn}`, U+2028 and U+2029 refusals were untested · fixed in `e0706df`.
- SonarQube `[sonar]` · 16 new violations (unsorted `sort()`, cognitive complexity of `run`, backtracking-prone `EMOJI_JOINER`, raw bidi character in a test, minors) · fixed in `e0706df`, `36a43ee`, `7dc4a53`.
- `src/effects.ts` `[adversarial|design|security]` · the thumbnail catch swallowed disk-full and permission errors, so a gem could be purged without its thumbnail · fixed in `e55bfa4` (decode with sharp, write with `fs`, new T-18 case).

## 🟡 Should Have

- `src/commands/extract.ts` `[security|correctness]` · `onMain` read any git error as "missing" · fixed with `ls-tree` in `e0706df`, tested in `6751275`.
- `src/commands/extract.ts` `[correctness]` · `git fetch` had no timeout · 60 s timeout in `e0706df`; the ssh override added there was dropped in `e55bfa4`.
- `src/commands/extract.ts:88` `[correctness]` · a failed error-flag write was silent · logged in `e0706df`, tested in `6751275`.
- `[design]` · sheet path built in five places, rule kinds in three · `sheetPath` and `RULE_KINDS` in `e0706df`.
- `[docs]` · `extract`, `purge` and `notes` docstrings missing their output and errors; README missing REQ-16/17 · fixed in `e0706df`.
- `tests/t17-t21-payload.test.ts` `[adversarial]` · invisible characters typed raw · escaped in `e55bfa4`.

## 🔵 Nice to Have

- `tests/t19-purge.test.ts:106`, `tests/t16-t18-extract.test.ts:97` `[adversarial]` · restore folder modes in `afterEach` or `finally`, so a thrown run cannot leave a 555 folder behind.
- `src/commands/extract.ts:153` `[adversarial]` · `.trim()` on `--show-prefix` would drop a trailing space of a folder name (pre-existing).
- Not applied, worth an issue: a filter refusing token, email and phone shapes in sheet text before publication `[security]`; the test-auditor's Should items on boundary accepts and status variety `[tests]`.

## ⚪ Disagree / Intentional

- `src/commands/extract.ts:69` `[sonar]` · sequential purge · ADR-0003.
- `src/commands/extract.ts` `[design]` · `notes` beside `extract` and `purge`, with the git helpers · `03-component.md` places them there.
- `gemWithoutThumbnail` `[design]` · kept: the session needs to tell a skipped gem from a non-gem.

## Per-dimension summary

- Adversarial: one real Must found in the fixes themselves (sharp errors carry no code), closed; gate open.
- Design: dependency rule holds, no over-engineering; duplication removed.
- Docs: public surface documented; three docstrings completed.
- Tests: pyramid healthy, no over-mocking; two false-confidence tests fixed, three behaviours newly covered.
- Security: no injection or path traversal; invisible-text refusal intact.
- Correctness: git errors and file-system errors now surface instead of being misread.
