# ADR-0002 — Classify captures in the Claude Code session and log every decision

Status: accepted · Date: 2026-11-06 · Deciders: Benoît Bremaud, with Claude Code (MCDA matrix, scores /500).
Settles who calls the vision model left open by ADR-0001 decision 5, and adds the decision log that brick 6 (#6) will learn from.

## Context

ADR-0001 chose vision triage on Sonnet but not where the model call lives. The CLI is TypeScript; the `/screenshots` skill runs inside a Claude Code session that can already read images. The owner also wants, later, a local model that imitates Claude's triage (distillation), which needs every decision recorded with its reasoning.

## Decision drivers

Cost (no extra key or per-token billing) 30, simplicity 25, testability 20, autonomy for a future scheduler 15, secrets to manage 10.

## Options considered

| Criterion (weight) | A — CLI calls the Anthropic API | B — Claude Code session classifies, CLI does the rest | C — `Classifier` port in the CLI, session adapter now, API adapter later |
|---|---|---|---|
| Cost (30) | 2 — paid API key per token | 5 — subscription, no key | 5 |
| Simplicity (25) | 3 — HTTP client, retries, prompt in code | 4 — CLI is pure files and index, prompt in the skill | 2 — abstraction with one adapter |
| Testability (20) | 4 — API mocked at the boundary | 4 — CLI fully deterministic | 4 |
| Autonomy (15) | 5 — runs without a session | 1 — needs an open session | 4 |
| Secrets (10) | 3 — one more key in `.env` | 5 — none | 4 |
| **Total /500** | **320** | **395** | **380** |

Sensitivity: C overtakes B only if autonomy weighs 30 or more, which is the scheduled-job scenario set aside in ADR-0001 decision 1.

## Outcome

**Option B.** The skill presents each inbox capture to the session with the domain list and the current tags, and records the answer through the CLI (`file`, `doubt`, `resolve`). The CLI never calls a model and needs no model credential.

**Decision log.** Every classification and every owner answer is appended to `knowledge/decisions.jsonl`: capture id, timestamp, prompt version, domain, tags, confidence, reasoning (two to three sentences), and for a doubt or a resolution the answer. The log holds derived text only, never the image, so it is versioned. It is the labelled dataset with rationales that brick 6 feeds to a local model in shadow mode, text (OCR) first.

## Consequences

- The CLI interface (`scan` → JSON inbox, `file`, `doubt`, `resolve`, `status`, `tags`) is the contract between skill and code; adding an API classifier later is a new caller of the same commands, not a change to them.
- Triage requires an open Claude Code session; no cron in brick 2.
- The prompt and the tag rules live in the skill (`~/.claude`), the facts (domains, tags, statuses) in the CLI; the skill reads them from `cli tags` to avoid drift.
- Reasoning text in the log must stay free of personal content: a doubtful capture answered personal gets no reasoning beyond the model's initial doubt.
