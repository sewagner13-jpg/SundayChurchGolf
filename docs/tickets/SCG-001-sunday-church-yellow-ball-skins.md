# SCG-001: Sunday Church Yellow Ball Skins

## Status

Verified; pending merge. Claimed 2026-08-15 by Codex on `codex/scg-001-yellow-ball-skins`.

## User Outcome

The user can run Sunday Church skins for two or more four-player teams where one rotating yellow-ball player's gross or net score is added to a separate three-player scramble gross score.

## Scope

- Seed `sunday_church_yellow_ball_skins` and expose it in round setup.
- Require four-player teams and at least two teams.
- Store the handicap toggle in `Round.formatConfig` and each team's locked order in `Team.formatConfig`.
- Repeat each team's order through holes 1-16; require different manual carriers on holes 17 and 18.
- Derive carrier, relative handicap strokes, net score, and combined score server-side.
- Save carrier gross in `PlayerScore` and combined/component data in `HoleScore`.
- Score lower-wins skins with two-tie-all-tie carryovers and the established final-hole tiebreaker.
- Add setup, scoring, leaderboard, scorecard, summary, controlled feedback, and phone-readable E2E coverage.

## Acceptance Evidence

- Pure scoring and validation tests fail before implementation and pass afterward.
- Server actions reject invalid orders, carriers, inputs, and locked-setting changes.
- Browser E2E covers order lock, gross entry, net math, carryover, dot legend, and Hole 17/18 rules at desktop and 390x844.
- `npm run verify:negative-probes` and `npm run verify:release` pass.
- Screenshots and traces are retained under Playwright artifacts.

## Release Boundary

Deployment, production database changes, seeding, and disposable live-round verification are not authorized in this ticket. Release requires a separate explicit approval and only `npm run deploy:production -- --confirm` from clean `main`.

## Work Log

- 2026-08-15: Reconciled unrelated production and prior-main histories without changing the production tree. GitHub default and Netlify production branch now use `main`; published production remains commit `85ea086`.
- 2026-08-15: Baseline passed 93 unit tests. Branch and STATE line-cap enforcement tests were proven red before implementation.
- 2026-08-15: Added the seeded format definition, team-owned order storage, server-derived scoring, relative yellow-ball handicaps, lower-wins carryovers, setup/scoring/summary UI, and the shared mobile leaderboard grid.
- 2026-08-15: Review defects were fixed for generic-score bypass, BLIND score visibility, reverse Hole 17/18 edits, live-toggle/start/revert transactions, and Netlify single-build restoration.
- 2026-08-15: Final release verification passed 117 unit tests, typecheck, lint with 43 existing warnings and no errors, production build, and 5 browser tests. Negative probes passed, including forced Netlify trigger and activation-verification failures that restored stopped builds.
- 2026-08-15: Playwright retained Yellow Ball desktop/mobile screenshots and traces under `test-results/`. The production bundle returned 404 for the fixture route when `E2E_FIXTURES` was absent.
- 2026-08-15: Netlify automatic Git builds remain stopped. No production deployment, schema sync, seed, or live smoke round was run under this ticket.
