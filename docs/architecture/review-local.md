# Local review — screenshot-triage (brick 2, #2)

Pre-push review of the triage CLI on a local-directory source, sixteen adversarial rounds, the last ten on the Codex fixes.

- Date: 2026-11-06
- Commit: 27f276a
- Scope: branch diff `main...HEAD` (`feat/2-triage-cli-local-source`, 56 files)
- Checks run: adversarial (Opus, 16 rounds) · design · docs · tests · security · correctness
- Verdict: ship as-is · Must 0 · Should 0 · Nice 5

## Adversarial review (#236)

- Round 1 on `f053702`: Must 4 · Push gate: closed. Free text could reach the public log through `model` and `promptVersion`; a source call failed on re-run and the primary row was written before its duplicates; a file changed after the scan could be moved under a stale name; the sequences showed the old port contract and `file`/`doubt` ignored `--dry-run`.
- Round 2 on `c1ff2b4`: 4 fixed · new Must 2 · Push gate: closed. A doubtful capture whose source file changed was stuck; four documents said `scan` revisits `deleted` rows only.
- Round 3 on `265aa29`: 2 fixed · new Must 2 · Push gate: closed. A capture deleted on the phone could not be resolved and left its duplicate unmarked; five places stated the previous `moveInto` rule.
- Round 4 on `ddfc8b7`: all fixed · Must 0 · Should 1 · **Push gate: open**. The source root is pinned in `data/source.json`.
- Round 5 on `d5f4830`: Should fixed (pin error names the root and the remedy) · **Push gate: open**.
- Round 6 on `684df81` (docs only): the owner's hash-on-change exception reads the same in five places · **Push gate: open**.
- Round 7 on `f008a93`: both Codex P2 findings on #9 fixed (extra positionals refused per command, canonical paths for the `--source` isolation) · Nice 2 · **Push gate: open**.
- Round 8 on `321831c`: second Codex review fixed (`--data` and `--knowledge` kept apart, usage checks before the pin, source must be a directory) · Should 1 · **Push gate: open**.
- Round 9 on `87ac1b5`: Should fixed (id checked before the pin; only `scan` and `resolve --as personal|delete` pin) · **Push gate: open**.
- Round 10 on `3aaa240`: third Codex review fixed (inbox copy checked against the scanned hash, unique tags, pin only on a doubtful capture) · new Must 1: the duplicate check hashed the final record, reading `Personnel/` · Push gate: closed.
- Round 11 on `f4c005b`: the final record is checked by size only, its bytes never read · **Push gate: open**.
- Round 12 on `d2f9bf3`: fourth Codex review fixed (a capture replaced mid-scan is skipped and counted as `changed`; `Personnel/` and `.trash/` must be real directories) · Should 1 (test for `changed`) fixed in `b196c98` · **Push gate: open**.
- Round 13 on `1ffcb93`: fifth Codex review fixed (a final record must be a regular file, never a link, before the source copy goes) · **Push gate: open**.
- Round 14 on `9ad2eeb`: sixth Codex review fixed (only `<id>.<image-ext>` names count as final records) · **Push gate: open**.
- Round 15 on `da15b88`: seventh Codex review fixed (confidence required on a first filing, `read` never follows a link, only regular files count as final records) · Should 1: the branch still shipped a GitHub workflow against the owner rule of 2026-11-07 · **Push gate: open**.
- Round 16 on `27f276a`: workflow deleted, docs say local CI only, `moveInto` moves only a regular file · **Push gate: open**.
- Hosted reviewers: Copilot not available on this repository · Codex `@codex review` posted on `84372be`, two P2 findings, both fixed in `11f7a4c` and `f008a93`; second review on `167adb4`, one P1 and two P2, fixed in `321831c` and `87ac1b5`; third review on `dc23c57`, one P1 and three P2, fixed in `3aaa240` and `f4c005b`; fourth review on `4f0cb60`, two P2, fixed in `d2f9bf3`; fifth review on `e75f29b`, one P2, fixed in `1ffcb93`; sixth review on `e82c001`, one P2, fixed in `9ad2eeb`; seventh review on `afe0124`, three P2, fixed in `da15b88`.

## Pre-merge gate (head SHA 27f276a, `--push` mode)

| Step | Result |
|---|---|
| 0 Local CI | GitHub Actions dropped (owner rule 2026-11-07, billed) · `npm run check` (typecheck, lint, vitest) ✅ · `gitleaks git` 8.30.1 ✅ |
| 1 Tests | ✅ 117 unit and integration tests (vitest), one spawn of the entry point |
| 2 Coverage | tests 96.32 % stmts / 91.06 % branches / 97.16 % funcs / 97.84 % lines (floor 80) · docs ⏸ deferred to the pre-merge run |
| 3 SonarQube | ⚠️ not run: no SonarQube project for this repository |
| 4 Secrets | ✅ gitleaks clean (`--all`) · only `.env.example` tracked · diff read: nothing sensitive |
| 5 E2E/smoke | ⏸ deferred to the pre-merge run (a CLI: the in-process tests drive every command) |

- Gate: `--push`: **pre-push green**, SonarQube absent, doc coverage and E2E deferred (never GREEN).

## 🔴 Must Have

_None._

## 🟡 Should Have

_None._ CodeQL, dependency review and a weekly gitleaks run are deferred by the owner to #8.

## 🔵 Nice to Have

- `src/cli.ts:48` `[security]` · stderr carries absolute paths from `node:fs` errors · print the error code and the capture id instead.
- `src/cli.ts:128` `[correctness]` · deleting `data/source.json` by hand lets the next `--source` pin silently · warn on stderr when the index already has rows.
- `src/cli.ts:139` `[correctness]` · a dangling symbolic link as `--data` ends with exit 3 instead of a usage error; nothing is written · resolve the link target.
- `src/effects.ts:45` `[correctness]` · a capture whose bytes change during `scan` stops the batch with exit 3; scanning again settles it · skip and report it like a rejected file.
- `docs/architecture/diagrams/triage/01-use-case.md` 3c `[docs]` · the hash-on-change rule also applies to `trash` · one word in 3c.

## ⚪ Disagree / Intentional

- `src/commands/decide.ts` `[adversarial]` · `resolve --as work` ignores `--dry-run` · it has no destructive effect (`02-sequence-resolve-doubt.md` § Notes).
- `src/triage/transition.ts` `[adversarial]` · `duplicateOf` points to the row's own ref when only the source holds the original · ADR-0002 decision 2.
- `src/cli.ts` `[design]` · no `--repin` flag · KISS; editing the pin is the owner's act and the error says how.

## Per-dimension summary

- Adversarial: sixteen rounds, eleven Must fixed, gate open. · Design: functional core and dependency rule held, `src/fs.ts` dedupes the file-system helpers. · Docs: conception, README and CLAUDE.md match the port contract. · Tests: table-driven transition matrix, adapter and CLI hardening suites. · Security: labels only in the public log, ids only on argv, source pinned. · Correctness: every crash and re-run path is idempotent.
