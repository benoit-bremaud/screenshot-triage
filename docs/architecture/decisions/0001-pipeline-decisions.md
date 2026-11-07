# ADR-0001 — Screenshot triage pipeline decisions

Status: accepted, amended by ADR-0002 (decisions 7 and 8, § Bricks) and ADR-0003 (decision 8, § Sheet format) · Date: 2026-11-05 · Deciders: Benoît Bremaud, with Claude Code (MCDA matrices, scores /500).
Decisions taken on 2026-11-05 for turning Instagram screenshots (taken on an Android phone, backed up to Google Photos) into knowledge that enriches or creates Claude Code skills, frontend design first.

## Goal

1. Recognise what a screenshot is about (frontend, design, backend, CI/CD, …) and file it in a folder named after that domain.
2. With a second agent, extract the useful information to enrich existing skills, create new ones, or set it aside.
3. Delete the screenshot once processed: the knowledge is kept, not the image.

## Decisions (MCDA winner in bold, score /500)

| # | Question | Decision | Score | Alternatives |
|---|---|---|---|---|
| 1 | Trigger | **On demand**, a `/screenshots` skill; scheduler can be added later | 415 | weekly job 345, inotify watcher 270 |
| 2 | Phone | Android (fact) | — | — |
| 3 | Transport phone → PC | **Immich on the homelab** (Raspberry Pi 5, Docker, Tailscale); Immich app auto-backs up the Screenshots album | 390 | Syncthing 440 (owner chose Immich), Drive + rclone 310 |
| 4 | Fetch to the PC | **Immich API from the PC**: scoped API key, search by album + updatedAfter, download originals, OCR text attached, tags and trash written back | 460 | n8n push 310, rsync of storage 205 |
| 5 | Domain recognition | **Vision (Sonnet) with Immich OCR text in context**, single path | 415 | OCR-first + Haiku 360, keyword rules 290 |
| 6 | Taxonomy | **Fixed domains as folders + free tags**; tags reused before created; target skill is a separate dimension; `index.jsonl` | 450 | fixed two-level list 365, fully emergent 310 |
| 7 | Deletion | **Delete everything after the extraction sheet** (PC file removed, Immich asset trashed); 800 px JPEG thumbnail kept only for `design` gems; doubtful captures stop on a question to the owner: perso / pro / delete | 405 | no thumbnail 385, PC only 375 |
| 8 | Enrichment | **One sheet per capture in `~/.claude/knowledge/screenshots/`; per batch, one PR adds rules to `references/field-notes.md` of the target skill** and lists new-skill candidates | 475 | sheets only 355, SKILL.md per capture 310 |
| 9 | Verification | **Targeted**: technical rules checked via Context7 / official docs (verified / contradicted / not found); design rules confronted with the target skill (consistent / in tension); annex split into "adopted" and "to confirm" | 380 | systematic 355, none 345 |
| 10 | Google Photos backlog | **Start from zero, then targeted download** (photos.google.com "screenshots" search → zip → `immich-go`), batches of 20–30 | 390 | no backlog 380, full Takeout 340 |
| 11 | Work split | **Parallel, 5 bricks**, one issue and one chat each | 450 | sequential 425, two big bricks 250 |
| 12 | Hosting | **Dedicated public repo `~/Documents/02_personal/screenshot-triage`** holding code, index and sheets; thumbnails stay local and git-ignored (third-party content); enrichment PRs target `~/.claude` and cite sheets by URL | 390 | code in repo + sheets in `~/.claude` 385, everything in `~/.claude` 355 |
| 13 | Language | **TypeScript**: Node, official `@immich/sdk`, `sharp`, vitest | 470 | Python 420, Bash + jq 250 |

## Taxonomy

Domains (folders): `frontend`, `design`, `backend`, `devops`, `ai-tooling`, `product`, `career`, `other`.
Boundary test design vs frontend: "if the code is removed, does the advice still hold?" Yes → `design`.
One folder per capture (dominant domain); other subjects become tags. Tag reaching 5 captures without a covering skill → new-skill candidate; 3–4 → watch list.

## Lifecycle

```
phone ─Immich app─▶ Immich (Pi) ─API─▶ inbox/ (PC) ─▶ step 1 triage
  domain ─▶ step 2 extraction ─▶ sheet + tags + target skill ─▶ PC file deleted, Immich trashed, thumbnail if design gem
  doubtful ─▶ question to owner: perso (PC deleted, Immich album "Personnel", never read again) / pro (triaged) / delete (trash)
  duplicate ─▶ trash
  other ─▶ set aside; reminder after 90 days
```

Deletion happens only on a final status, never on triage alone. `--dry-run` lists what would be deleted. API key scoped without trash-empty permission. Immich trash retention is server-configured (30 days default), restore available by API.

## Sheet format

Title, 3-line summary, actionable rule(s), justification from the capture, tags, target skill, source (Instagram handle), verification status, optional thumbnail, Immich asset id, date.

## Models

Step 1 and step 2 on Sonnet; the enrichment PR (touches skill doctrine) on Opus.

## Bricks

1. `bb-homelab` — deploy Immich on the Pi: compose, Caddy, Tailscale only, nightly backup, named and dated API key, lightened ML.
2. `~/.claude` — skill `screenshot-triage` + triage script (step 1), `index.jsonl`, domain folders, perso/pro/delete question, source = local folder (`~/Pictures/Screenshots` for testing).
3. `~/.claude` — Immich adapter: API pull with OCR, tags and trash write-back. Contract fixed in brick 2: asset id, date, original name, OCR text, local path.
4. `~/.claude` — step 2: extraction sheets, targeted verification, enrichment PR, new-skill candidates.
5. Backlog import from Google Photos; later, optionally the Immich MCP server for natural-language queries.

Bricks 1 and 2 run in parallel (two projects, two chats).

## Out of scope / notes

- Google Photos API cannot list non-app-created media since 2025-03; Google Photos stays the owner's manual concern (or drop the Screenshots folder from its backup).
- Phone storage: Immich app "free up space" after backup.
- n8n is not in the data path; possible later use: Telegram reminder of untriaged captures.
