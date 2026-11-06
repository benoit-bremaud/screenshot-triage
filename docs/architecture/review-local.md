# Local review — screenshot-triage (docs/2-triage-uml-study, --push)

- Date: 2026-11-06
- Commit: fd4c512 (round 1 ran on 374ca92)
- Scope: branch diff main...HEAD (docs only: triage UML study, ADR-0002, requirements, glossary, matrix, CLAUDE.md, README, PROJECT_LOG)
- Checks run: adversarial (Opus, 11 rounds) · design · docs · security (diff read, gitleaks) · correctness (n/a, no code)
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
- Round 11 on `fd4c512`: 2 fixed · 0 not fixed · 0 regressed · new Must 0 · **Push gate: open — 0 Must open**
- Hosted reviewers (filled at the pre-merge run): Copilot pending · Codex optional

## Pre-merge gate (head SHA fd4c512)

| Step | Result |
|---|---|
| 0 CI mirror | n/a — no `.github/workflows/` yet |
| 1 Tests | n/a — no code, no suite yet |
| 2 Coverage | ⏸ deferred (no code) |
| 3 SonarQube | ⏸ deferred to the pre-merge run (`--push`) |
| 4 Secrets | ✅ gitleaks clean (main..HEAD, 11 commits) · tracked env files: `.env.example` only (placeholders) · diff read: nothing sensitive |
| 5 E2E/smoke | ⏸ deferred (`--push`) |
- Gate: `--push`: **pre-push green** — adversarial gate open, no `justfile` (steps 1 to 3 and 5 deferred to the pre-merge run)

## 🔴 Must Have

_None open._ Applied across the rounds: private index in `data/` and a public log of `file` decisions only (owner decision, MCDA 440); `ref` as row key, `contentHash` as log key, `id` on argv; `resolve --as work` then `file`; the duplicate guard and the invariant retitled; "held, asked after the batch"; sensitivity sentences recomputed; JSON decision object on stdin; README layout; durable final statuses at the source (`Personnel/`, `.trash/`); stale MCDA score; copies named `<id>.<ext>` with a whitelisted extension; duplicate rows settled with their original; `scan` settling returning copies, with `--dry-run` and the source-side witness; `Personnel` content never read, ids only; ordered, exclusive `scan` guards (Personal, Deleted, Duplicate, Inbox); transition table aligned.

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

- Adversarial: 11 rounds, 13 Must in total, every one a privacy or consistency defect in the duplicate, final-status and returning-copy rules; gate open on `fd4c512` · Design: identity keys, argv free text, pure `transition` + effect runner, source as durable record · Docs: one rule stated once across CLAUDE.md, ADR-0002, glossary, diagrams and matrix · Security: no secret in the diff; privacy findings are design-level and closed · Correctness: n/a, no code.
