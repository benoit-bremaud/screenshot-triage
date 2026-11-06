# screenshot-triage

Turns the Instagram screenshots taken on a phone into knowledge that enriches or creates Claude Code skills, frontend design first.

## How it works

1. **Collect**: the Immich app on the phone backs up the Screenshots album to the self-hosted Immich server, which deduplicates and runs OCR.
2. **Triage, on demand**: the `/screenshots` skill pulls new assets through the Immich API and files each one, by vision with the OCR text in context, into one of eight fixed domains plus free tags.
3. **Guard rail**: on any doubt (personal, unreadable, off-topic) the capture is held and, after the batch, the owner answers: work / personal / delete. Personal captures are never read; confidential work content is answered delete, because a work filing is published as derived text.
4. **Extract**: one sheet per capture (actionable rule, source, tags, target skill); technical rules verified against official docs, design rules confronted with the target skill.
5. **Enrich**: one pull request per batch into the target skill's `references/field-notes.md`; a tag reaching five captures with no covering skill becomes a new-skill candidate.
6. **Purge**: once the sheet exists, the local file is deleted and the Immich asset trashed. Only design gems keep an 800 px thumbnail, outside Git.

Decisions and their scores: [ADR-0001](docs/architecture/decisions/0001-pipeline-decisions.md).

## Domains

`frontend`, `design`, `backend`, `devops`, `ai-tooling`, `product`, `career`, `other`.
Boundary test between design and frontend: "if the code is removed, does the advice still hold?" Yes → `design`.

## Layout (target)

```
src/cli.ts      TypeScript CLI: scan | file | doubt | resolve | status | tags (bricks 2-3), --dry-run;
                extract | enrich | purge from brick 4
  main.ts       bin entry point (stdin, exit code)
  commands/     one module per command
  sources/      CaptureSource port, local-directory adapter, Immich adapter (@immich/sdk, brick 3)
  triage/       domains, tag rules, decision schema, status transitions and their effects
  effects.ts    runs the effects in order, or prints them with --dry-run
  store/        CaptureIndex (data/index.jsonl) and DecisionLog (knowledge/decisions.jsonl)
  extract/      sheets and targeted verification (brick 4)
knowledge/      decisions.jsonl and, from brick 4, one Markdown sheet per capture (versioned, derived text only)
data/           inbox, domain folders, thumbnails, index.jsonl (git-ignored)
docs/           architecture: ADRs, UML diagrams, requirements, QA
tests/          vitest, Immich mocked at the boundary
```

## Usage (brick 2, local directory)

```bash
npm install && npm run build
node dist/main.js scan --source ~/Screenshots            # copy new captures into data/inbox, JSON report
echo '{"promptVersion":"triage-v1","model":"claude-sonnet-5-5","domain":"frontend","tags":["react"],"consideredTags":[],"confidence":0.9,"reasoning":"..."}' \
  | node dist/main.js file <id>                           # Inbox -> Triaged, labels appended to knowledge/decisions.jsonl
echo '{"promptVersion":"triage-v1","model":"claude-sonnet-5-5","category":"personal-suspected","reasoning":"..."}' \
  | node dist/main.js doubt <id>                          # held, asked after the batch
node dist/main.js resolve <id> --as personal --source ~/Screenshots --dry-run
node dist/main.js status --json
node dist/main.js tags
```

`<id>` is the first 12 hex characters of the capture's SHA-256; a filename never reaches argv. `npm run check` runs typecheck, lint and the tests (the CI mirror).

## Status

Brick 0: repository created, decisions recorded. Brick 2 (triage CLI with a local-directory source): conception and code done. Brick 1 (Immich on the homelab) in `bb-homelab`. Planned: 3 Immich adapter, 4 extraction and enrichment PR, 5 Google Photos backlog, 6 local model in shadow mode.

## Licence

MIT, see [LICENSE](LICENSE). Sheets contain derived text and the author's handle only; screenshots and thumbnails are never committed.
