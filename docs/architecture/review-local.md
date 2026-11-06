# Local review — screenshot-triage (docs/2-triage-uml-study, --push)

- Date: 2026-11-06
- Commit: see § Adversarial review (round 1 ran on 374ca92, last verified head below)
- Scope: branch diff main...HEAD (docs only: triage UML study, ADR-0002, requirements, glossary, matrix, CLAUDE.md, README, PROJECT_LOG)
- Checks run: adversarial (Opus, 14 rounds) · Codex hosted review (3 findings, applied) · design · docs · security (diff read, gitleaks) · correctness (n/a, no code)
- Verdict: ship as-is · Must 0 · Should 0 · Nice 0 open (round 1: Must 8 · Should 12 · Nice 8, all applied)

## Adversarial review (#236)

- Round 1 on `374ca92`: Must 6 · Should 10 · Nice 6 · unverified 0 · Push gate: closed
- Round 2 on `d721764`: 6 fixed · 0 not fixed · 0 regressed · new Must 1 (losing `data/` resurfaced personal captures on the local source) · Push gate: closed
- Round 3 on `34612b5`: new Must 1 (stale MCDA score in `PROJECT_LOG.md`) · Should 6 · Nice 3 · Push gate: closed
- Round 4 on `86cc904`: 10 fixed · Should 3 (duplicate rows, collision, attacker-controlled extension) · **Push gate: open** (Shoulds applied anyway)
- Round 5 on `eaf70fe`: 5 fixed · new Must 1 (a copy arriving after its original was resolved had no transition) · Push gate: closed
- Round 6 on `da920bb`: 4 fixed · new Must 1 (`scan` became destructive, UC1 said it never deletes, no `scan --dry-run`) · Should 1 (copy arriving after `data/` is lost) · Push gate: closed
- Round 7 on `bb7180a`: 2 fixed · new Must 1 (`Personnel` album "never read" vs ids listed) · Should 1 (a restored file was re-trashed) · Push gate: closed
- Round 8 on `cce6c25`: 3 fixed, 1 partly · Should 1 (a restored file matched no `scan` guard) · **Push gate: open** (Should applied anyway)
- Round 9 on `c247a56`: 2 fixed · new Must 1 (overlapping `scan` guards, Personal vs Inbox) · Push gate: closed
- Round 10 on `cb933af`: 1 fixed · new Must 1 (stale Personal guard in the transition table) · Should 1 (intro wording) · Push gate: closed
- Round 11 on `fd4c512`: 2 fixed · 0 not fixed · 0 regressed · new Must 0 · **Push gate: open — 0 Must open** (PR #7 opened on `05caae0`)
- Codex review on `05caae0`: P1 reasoning published by a false-negative `work` filing (owner decision, ADR-0002 decision 3, B 435) · P2 restored Immich asset never revisited · P3 dedupe on domain only → applied in `0154995`, threads answered and resolved
- Round 12 on `0154995`: 3 fixed · new Must 3 (stale copies of the old rules) · Should 3 · Push gate: closed
- Round 14 on `3747c12`: 4 fixed · new Must 0 · Should 1 (glossary Id wording, applied in the next commit) · **Push gate: open — 0 Must open**
- Round 13 on `ec6e2e8`: 6 fixed · 0 not fixed · 0 regressed · new Must 0 · Should 2 · Nice 2 (all applied in the next commit) · **Push gate: open — 0 Must open**
- Hosted reviewers: Copilot not requestable on this repository (Copilot code review not enabled; REST request returns no reviewer) · **waived by the owner on 2026-11-06 for PR #7** (docs only, 14 adversarial rounds) · Codex posted its review on `05caae0`, 3 findings applied, threads resolved

## Pre-merge gate (head SHA: the commit that records this report, differing from `ec6e2e8` by the round-13 Should/Nice edits and this file)

| Step | Result |
|---|---|
| 0 CI mirror | n/a — no `.github/workflows/` yet |
| 1 Tests | n/a — no code, no suite yet |
| 2 Coverage | ⏸ deferred (no code) |
| 3 SonarQube | ⚠️ no SonarQube project for this repository yet (docs only, no code) |
| 4 Secrets | ✅ gitleaks clean (main..HEAD, 17 commits) · tracked env files: `.env.example` only (placeholders) · diff read: nothing sensitive |
| 5 E2E/smoke | ⏸ deferred (`--push`) |
- Gate: `--push`: **pre-push green** — adversarial gate open, no `justfile`. Pre-merge on PR #7: no CI workflow, no code, no SonarQube project; secrets step green; Copilot waived by the owner (above); Codex findings applied and resolved.

## 🔴 Must Have

_None open._ Applied across the rounds: private index in `data/` and a public log of `file` decisions only (owner decision, MCDA 440); `ref` as row key, `contentHash` as log key, `id` on argv; `resolve --as work` then `file`; the duplicate guard and the invariant retitled; "held, asked after the batch"; sensitivity sentences recomputed; JSON decision object on stdin; README layout; durable final statuses at the source (`Personnel/`, `.trash/`); stale MCDA score; copies named `<id>.<ext>` with a whitelisted extension; duplicate rows settled with their original; `scan` settling returning copies, with `--dry-run` and the source-side witness; `Personnel` content never read, ids only; ordered, exclusive `scan` guards (Personal, Deleted, Duplicate, Inbox); transition table aligned; reasoning kept out of the public log (decision 3); deleted refs revisited; identical-log-line dedupe.

## 🟡 Should Have

_None open._ All applied (see the rounds above and the round-1 list in git history of this file).

## 🔵 Nice to Have

_None open._

## ⚪ Disagree / Intentional

- `02-sequence-triage-batch.md` `[adversarial]` · classification as a self-message of the Skill, no Model lifeline · ADR-0002 makes the session the classifier.
- `docs/architecture/README.md` `[adversarial|design]` · class and deployment diagrams skipped · proportionality, reasons listed.
- `PROJECT_LOG.md` `[docs]` · the old `adr/` path in the rename narrative · historical record.
- `03-component.md` `[design]` · `CaptureSource` port with one adapter today · the Immich adapter is a recorded commitment (ADR-0001 brick 3).
- Pre-existing, out of scope: ADR-0001 decision 8 vs decision 12 (bricks placed in `~/.claude`), and the historical "never read again" wording at ADR-0001:41, both covered by the amendment line of ADR-0002; the `uml-sequence` skill's `alt [guard]` renders as `[[guard]]` (skill-level, not this repo).

## Per-dimension summary

- Adversarial: 14 rounds, 16 Must in total, every one a privacy or consistency defect in the duplicate, final-status and returning-copy rules; gate open on `ec6e2e8` · Codex: 3 findings, the P1 one a real privacy gap closed by decision 3 · Design: identity keys, argv free text, pure `transition` + effect runner, source as durable record · Docs: one rule stated once across CLAUDE.md, ADR-0002, glossary, diagrams and matrix · Security: no secret in the diff; privacy findings are design-level and closed · Correctness: n/a, no code.
