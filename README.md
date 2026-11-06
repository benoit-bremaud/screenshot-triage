# screenshot-triage

Turns the Instagram screenshots taken on a phone into knowledge that enriches or creates Claude Code skills, frontend design first.

## How it works

1. **Collect**: the Immich app on the phone backs up the Screenshots album to the self-hosted Immich server, which deduplicates and runs OCR.
2. **Triage, on demand**: the `/screenshots` skill pulls new assets through the Immich API and files each one, by vision with the OCR text in context, into one of eight fixed domains plus free tags.
3. **Guard rail**: on any doubt (personal, confidential, unreadable) the triage stops and asks the owner: personal / work / delete. Personal captures are never read.
4. **Extract**: one sheet per capture (actionable rule, source, tags, target skill); technical rules verified against official docs, design rules confronted with the target skill.
5. **Enrich**: one pull request per batch into the target skill's `references/field-notes.md`; a tag reaching five captures with no covering skill becomes a new-skill candidate.
6. **Purge**: once the sheet exists, the local file is deleted and the Immich asset trashed. Only design gems keep an 800 px thumbnail, outside Git.

Decisions and their scores: [ADR-0001](docs/architecture/decisions/0001-pipeline-decisions.md).

## Domains

`frontend`, `design`, `backend`, `devops`, `ai-tooling`, `product`, `career`, `other`.
Boundary test between design and frontend: "if the code is removed, does the advice still hold?" Yes → `design`.

## Layout (target)

```
src/            TypeScript CLI: pull | triage | extract | enrich | purge, --dry-run
  sources/      Immich adapter (@immich/sdk) and a local-directory source for tests
  triage/       domains, tags, the personal / work / delete question
  index/        index.jsonl, statuses and transitions
  extract/      sheets and targeted verification
knowledge/      one Markdown sheet per capture, by domain (versioned)
data/           inbox, domain folders, thumbnails (git-ignored)
docs/           architecture: ADRs, UML diagrams, QA
tests/          vitest, Immich mocked at the boundary
```

## Status

Brick 0: repository created, decisions recorded. Next: brick 1 (Immich on the homelab, in `bb-homelab`) and brick 2 (triage CLI with a local-directory source).

## Licence

MIT, see [LICENSE](LICENSE). Sheets contain derived text and the author's handle only; screenshots and thumbnails are never committed.
