# Local review — screenshot-triage (brick 2, #2)

Pre-push review of the triage CLI on a local-directory source, six adversarial rounds until the push gate opened.

- Date: 2026-11-06
- Commit: 684df81
- Scope: branch diff `main...HEAD` (`feat/2-triage-cli-local-source`, 56 files)
- Checks run: adversarial (Opus, 6 rounds) · design · docs · tests · security · correctness
- Verdict: ship as-is · Must 0 · Should 0 · Nice 3

## Adversarial review (#236)

- Round 1 on `f053702`: Must 4 · Push gate: closed. Free text could reach the public log through `model` and `promptVersion`; a source call failed on re-run and the primary row was written before its duplicates; a file changed after the scan could be moved under a stale name; the sequences showed the old port contract and `file`/`doubt` ignored `--dry-run`.
- Round 2 on `c1ff2b4`: 4 fixed · new Must 2 · Push gate: closed. A doubtful capture whose source file changed was stuck; four documents said `scan` revisits `deleted` rows only.
- Round 3 on `265aa29`: 2 fixed · new Must 2 · Push gate: closed. A capture deleted on the phone could not be resolved and left its duplicate unmarked; five places stated the previous `moveInto` rule.
- Round 4 on `ddfc8b7`: all fixed · Must 0 · Should 1 · **Push gate: open**. The source root is pinned in `data/source.json`.
- Round 5 on `d5f4830`: Should fixed (pin error names the root and the remedy) · **Push gate: open**.
- Round 6 on `684df81` (docs only): the owner's hash-on-change exception reads the same in five places · **Push gate: open**.
- Hosted reviewers (filled at the pre-merge run): Copilot not available on this repository · Codex `@codex review` pending.

## Pre-merge gate (head SHA 684df81, `--push` mode)

| Step | Result |
|---|---|
| 0 CI mirror | typecheck → `npm run typecheck` ✅ · lint → `npm run lint` ✅ · test → `npm test` ✅ · gitleaks → `gitleaks git` 8.30.1 (CI pins `GITLEAKS_VERSION: 8.30.1`) ✅ |
| 1 Tests | ✅ 94 unit and integration tests (vitest), one spawn of the entry point |
| 2 Coverage | tests 96.65 % stmts / 89.93 % branches / 96.93 % funcs / 97.82 % lines (floor 80) · docs ⏸ deferred to the pre-merge run |
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
- `docs/architecture/diagrams/triage/01-use-case.md` 3c `[docs]` · the hash-on-change rule also applies to `trash` · one word in 3c.

## ⚪ Disagree / Intentional

- `src/commands/decide.ts` `[adversarial]` · `resolve --as work` ignores `--dry-run` · it has no destructive effect (`02-sequence-resolve-doubt.md` § Notes).
- `src/triage/transition.ts` `[adversarial]` · `duplicateOf` points to the row's own ref when only the source holds the original · ADR-0002 decision 2.
- `src/cli.ts` `[design]` · no `--repin` flag · KISS; editing the pin is the owner's act and the error says how.

## Per-dimension summary

- Adversarial: six rounds, ten Must fixed, gate open. · Design: functional core and dependency rule held, `src/fs.ts` dedupes the file-system helpers. · Docs: conception, README and CLAUDE.md match the port contract. · Tests: table-driven transition matrix, adapter and CLI hardening suites. · Security: labels only in the public log, ids only on argv, source pinned. · Correctness: every crash and re-run path is idempotent.
