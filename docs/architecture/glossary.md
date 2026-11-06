# Glossary

Every domain term used in the diagrams, defined once. Alphabetical, English headword.

| Term | Definition | Source |
|---|---|---|
| Capture | One screenshot taken on the phone, identified in the tool by the hash of its content; has one status (`05-state-capture.md`). | ADR-0001 |
| Capture source | The place captures come from: a local directory (brick 2) or the Immich server (brick 3); the `CaptureSource` port in code. | `03-component.md` |
| Decision log | `knowledge/decisions.jsonl`, append-only record of every classification, doubt and owner answer with its reasoning; training material for brick 6. | ADR-0002 |
| Domain | One of the eight fixed folders a capture is filed into; the dominant subject of the capture. | ADR-0001 § Taxonomy |
| Doubt | The model's refusal to pick a domain because the capture may be personal, unreadable or outside dev and design veille; stops that capture until the owner answers. | CLAUDE.md |
| Index | `knowledge/index.jsonl`, one row per capture with its status, domain, tags and source ref. | ADR-0001 decision 6 |
| Owner | The person whose phone takes the screenshots and who answers the doubt question. | `01-use-case.md` |
| Personal | Final status of a capture the owner declared private: deleted locally, moved to the personal album at the source, never read again. | CLAUDE.md |
| Sheet | The Markdown extraction of a capture (brick 4); its existence makes the capture's status final. | ADR-0001 decision 8 |
| Tag | Free kebab-case English keyword on a capture, reused before created; five captures with no covering skill make a new-skill candidate. | ADR-0001 § Taxonomy |
| Vision model | The Claude Code session running `/screenshots`, which classifies captures (ADR-0002); drawn as a supporting actor. | ADR-0002 |
