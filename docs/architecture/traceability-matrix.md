# Traceability matrix

One row per use case and per non-functional requirement not realised by a use case. Pairs are explicit; a dropped ID keeps its row with status `dropped`.

| ID | Goal | Requirements | Realisation | Components | Tests | Status |
|---|---|---|---|---|---|---|
| UC1 | Triage new captures | REQ-1, REQ-2, REQ-3, REQ-4 | UC1 → SEQ-triage-batch | `src/cli.ts`, `src/sources/local-directory.ts`, `src/triage/`, `src/index/`, skill `/screenshots` | T-1, T-2, T-3, T-4, T-8 | planned (#2) |
| UC2 | Decide the fate of a doubtful capture | REQ-3, REQ-4, REQ-5, REQ-6 | UC2 → SEQ-resolve-doubt | `src/cli.ts`, `src/sources/`, `src/index/` | T-5, T-6, T-7 | planned (#2) |
| UC3 | Review the triage status | REQ-7 | UC3 → text brief in `01-use-case.md` | `src/cli.ts`, `src/index/` | T-9 | planned (#2) |
| — | Capture lifecycle | REQ-8 | `05-state-capture.md` | `src/triage/` | T-10 | planned (#2) |
| NFR-1 | No third-party image in Git | — | `.gitignore` (`data/`) | — | gitleaks and review | done |
| NFR-2 | Dependency rule | — | `03-component.md` | `src/sources/` only | lint rule or review | planned (#2) |
| NFR-3 | Transition coverage | — | `05-state-capture.md` § Transitions | tests | T-1 to T-10 | planned (#2) |
