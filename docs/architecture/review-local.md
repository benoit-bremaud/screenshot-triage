# Local review — screenshot-triage (feat/15-archive-captures)

Pre-push review of the archive brick (#15, ADR-0004): four adversarial rounds, the push gate open, SonarQube passed.

- Date: 2026-11-13
- Commit: 6de0dc0
- Scope: branch diff main...HEAD (`--push`)
- Checks run: adversarial (Opus, 4 rounds) · tests · coverage · SonarQube · secrets · diff read
- Verdict: ship · Must 0 · Should 0 · Nice 4

## Adversarial review (#236)

- Round 1 on `4f0849b`: Must 4 · Push gate: closed. Fixed in `e816e78`.
- Round 2 on `e816e78`: all 4 fixed · new Must 2, Should 1 · Push gate: closed. Fixed in `c08bbcc`.
- Round 3 on `c08bbcc`: Must 1 partly fixed, Must 2 and Should fixed · new Must 2 (a personal answer left a copy in `.archive/`; a re-keyed ref let another capture's answer trash the archived one) · Push gate: closed. Fixed in `cbd4b71` (copies matched on the content hash).
- Round 4 on `cbd4b71`: 2 fixed · new Must 0 · Should 1 (state machine), fixed in `43c4122` · **Push gate: open**.
- Optional second review (owner's OpenAI account): not run (never a gate step).

## Pre-merge gate (head SHA 6de0dc0)

| Step | Result |
|---|---|
| 0 CI mirror | n/a: no GitHub Actions (owner rule 2026-11-07) |
| 1 Tests | ✅ 238 vitest (unit and CLI integration over a temporary directory) |
| 2 Coverage | tests 96.42 % stmts / 90.84 % branches (floor 80) · docs ⏸ deferred to the pre-merge run |
| 3 SonarQube | ✅ PASSED (project `screenshot-triage`, created by this branch's `sonar-project.properties`); new coverage 95 %, duplication 0 %; 5 new findings fixed, 2 S9382 "await in loop" in `src/commands/archive.ts` marked Accepted by the owner (sequential on purpose: a crash leaves at most one capture half-archived, like `purge`) |
| 4 Secrets | ✅ gitleaks 8.30.1 clean on main..HEAD · no tracked `.env` (only `.env.example`) · diff read: nothing sensitive |
| 5 E2E/smoke | n/a: a CLI with no deployed build; the CLI tests drive the built commands end to end |

- Gate: `--push`: **pre-push green** — `npm run check` passed, doc coverage deferred (never GREEN); the repository has no `scripts/attest.sh`, so the merge follows the waiver question.

## 🔴 Must Have

_None._

## 🟡 Should Have

_None._

## 🔵 Nice to Have

- `src/triage/transition.ts:47` `[adversarial]` · the `archived:` ref prefix could clash with a real root file named `archived:<id>.png` · a prefix `listCaptures` cannot produce.
- `src/commands/archive.ts`, `src/commands/extract.ts` `[adversarial]` · the `archive` and `purge` loops are alike · kept apart until a third (Rule of Three).
- `docs/architecture/diagrams/extract/01-use-case.md` `[docs]` · UC7 still reads "(status: planned)".
- `src/sources/local-directory.ts` `[correctness]` · out of scope, to file: `moveInto` with `from === destination`; Immich re-listing of final assets and the timeline mechanism (brick 3).

## ⚪ Disagree / Intentional

- `src/sources/local-directory.ts:116` `[adversarial]` · an archived target missing from `.archive/` is a no-op · the port's "a ref already gone is a no-op" contract.
- `src/commands/decide.ts:72` `[adversarial]` · `resolve` also settles same-hash archived rows of an earlier life of the capture · the owner's answer is about these bytes.

## Per-dimension summary

- Adversarial: 4 rounds, 8 Must found and fixed, gate open · Tests: T-24 and T-25 cover archive, failures, re-sync and both reproduced bugs · Security: no secret, personal bytes never left in the archive · SonarQube: passed.
