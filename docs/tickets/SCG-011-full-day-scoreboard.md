# SCG-011 — Full-day scoreboard and narrower entry

User requested an accessible scoreboard for the full day and said score entry was still too wide. Keep the current six-hole view simple while making the whole game available separately.

The scoring header now opens a full-screen, read-only scoreboard without unmounting the score form or discarding a draft. It shows each six-hole bet and the overall bet with per-pair best-ball hole scores, engine-awarded wins, provisional markers, and progress. An individual 18-hole net/gross scorecard deduplicates overlapping bets, includes nine-hole totals when complete, and labels running totals. Configured hole-contest winners appear below. Non-cross formats use the existing visibility-filtered all-teams scorecard.

The same view has a shareable `/rounds/[id]/scoreboard` URL and links from finished winnings and round summary. Live boards refresh independently every ten seconds; completed boards refresh on request/focus. Failed reads hide data until retry succeeds. Blind live rounds suppress full-day scores. No writes, game-engine, payout, database, configuration or dependency changes.

Score-entry cards now stack the player heading, a compact fluid stroke field and own net, then partner information and pair best. This replaces the three-across metrics. A 280px viewport with 20px root text has no page overflow and every input fits. Existing 320/390px phone tests retain draft, refresh, discard and finish protection; the first entry remains within the initial phone screen.

Validation: four scorecard projection tests, mobile open/close tests that preserve an unsaved score, all-bet visibility and contained scoreboard table scrolling. Full release suite passes 245 unit tests, typecheck, line caps, lint with existing warnings only, build and 20 mounted browser tests. Independent review found no material regressions. Production verification is read-only; do not reopen a finished round or create test rounds to exercise score entry.
