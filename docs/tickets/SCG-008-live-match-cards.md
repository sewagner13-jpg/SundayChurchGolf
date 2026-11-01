# SCG-008 — Individual live matches

Approved in chat: build and deploy separate match cards with clear lead/tie status and expandable hole-by-hole scores.

The cross-group leaderboard now groups the existing engine's results by game. Each card shows every partnership, holes won, actual completed/total hole counts, current-game indication and leader/tie status. Details show each hole's saved gross/net values and best ball. Incomplete holes remain pending; the presenter does not calculate new winners or payouts. Blind live rounds suppress the new match details. Ten-second refresh and existing score-entry behavior are preserved.

Validation: 210 Node tests, typecheck, line caps, lint (51 existing warnings, no errors), production build, and 13 browser tests pass. New phone tests at 320px and 390px verify cards, refresh, expanded-state preservation, unsaved input preservation, pending holes, updated net best balls, visibility suppression and no page overflow. The new browser checks failed before implementation. Eight presenter tests cover no/partial/full scores, ties, complete matches, net/gross distinction, blind suppression and three-pair support. Independent review found no material bugs.

No database, schema, migrations, scoring engine, dependencies or deployment configuration changes. Publication uses the attended code-only release gate. Production verification is read-only; no live score submission is part of this work.

Ruling: keep the existing Tailwind 3 components; daisyUI 5 requires a Tailwind 4 upgrade and would expand this small live-round change into a dependency migration.
