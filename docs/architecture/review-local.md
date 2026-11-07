# Local review — screenshot-triage (brick 4 conception)

- Date: 2026-11-07
- Commit: 51cb439
- Scope: branch diff main...feat/4-extract-sheets-enrichment (docs only)
- Checks run: adversarial (Opus, 4 rounds) · docs · tests (`npm run check`) · secrets
- Verdict: ship as-is · Must 0 · Should 0 · Nice 1

## Adversarial review (#236)
- Round 1 on `48606a2`: Must 7 · Should 13 · Nice 6 · unverified 1 · Push gate: closed
- Round 2 on `ca71cb0`: all round 1 Must fixed · new Must 2 (stale cross-references) · Push gate: closed
- Round 3 on `d602e6b`: 2 fixed · new Must 0 · Should 1 (rule rank not stored) · Push gate: open
- Round 4 on `51cb439`: 3 fixed · 0 not fixed · 0 regressed · new Must 0 · **Push gate: open**
- Hosted reviewers: Copilot requested on PR #10, code review not available on this repository (as on PR #7) · Codex not requested

## Pre-merge gate (head SHA 51cb439)
| Step | Result |
|---|---|
| 0 CI mirror | n/a: no GitHub workflow (owner rule 2026-11-07, local CI only) |
| 1 Tests | ✅ 117 tests, 15 files (`npm run check`: typecheck, lint, vitest) |
| 2 Coverage | tests 96.32 % stmts / 91.06 % branches / 97.16 % funcs / 97.84 % lines (floor 80) · docs ⚠️ not measured (no counter in the project); **waived by the owner on 2026-11-07 for this docs-only PR**, counter to come with the brick 4 code |
| 3 SonarQube | ✅ PASSED on `f5d774e` (first analysis, project auto-provisioned): coverage 94.6 %, 0 bugs, 0 vulnerabilities, 0 hotspots, 0 % duplication, 11 code smells in brick 2 code (follow-up #8) |
| 4 Secrets | ✅ `gitleaks git --log-opts=--all` clean · only `.env.example` tracked · diff read: docs only, nothing sensitive |
| 5 E2E/smoke | n/a: docs-only change, no runtime path touched |
- Gate (pre-merge, `f5d774e`): steps 1, 3, 4 green, step 2 green for tests with the doc-coverage waiver above, step 5 n/a. Head after this report commit differs from `f5d774e` by this file only.
- Mermaid rendering not checked by tool (no headless browser on this machine); syntax read by the adversarial reviewer in every round.

## 🔴 Must Have
_None._

## 🟡 Should Have
_None._

## 🔵 Nice to Have
- `docs/architecture/specs/extract-requirements.md:9` `[adversarial]` · REQ-10 says the rank is kept across rewrites without saying who checks it · decide in the code study: the CLI compares the new ranks with the `[<id>#n]` tokens of the existing sheet.

## ⚪ Disagree / Intentional
- `docs/architecture/decisions/0003-extract-in-the-session-render-in-the-cli.md` `[adversarial]` · a separate `purge` command rather than deletion inside `extract` · strengthens the CLAUDE.md deletion invariant (ADR-0003 decision 2).

## Per-dimension summary
- Adversarial: 4 rounds, all Must and Should fixed (owner answer on a triaged capture, crash-safe purge order, CLI-rendered field notes cited per rule, `origin/main` read, explicit rank). · Docs: `status` gap, missing delete path, MCDA total and stale cross-references, all fixed. · Tests: suite unchanged and green. · Security: untrusted derived text bounded, escaped, evidence inert (NFR-4). · Design and correctness: covered by the adversarial rounds on a docs-only diff.
