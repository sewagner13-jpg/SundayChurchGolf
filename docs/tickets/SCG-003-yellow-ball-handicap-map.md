# SCG-003: Yellow Ball Handicap Map

## Status

Complete. Verified, deployed, and confirmed on the active live round on 2026-08-16.

## User Outcome

Each Yellow Ball team can see which players receive handicap shots on every hole before choosing and locking its four-player rotation.

## Scope

- Show the shared relative-handicap grid in the Yellow Ball scoring flow.
- Keep the grid visible both before and after the order is locked.
- Render one dot per stroke, with a dash when no stroke is received.
- Show all 18 holes and highlight the current hole.
- Preserve the established lowest-player-zero calculation with no slope or tee adjustment.
- Keep player labels fixed and confine horizontal scrolling to the hole grid on phones.
- Retain the existing Yellow Ball order, scoring, handicap, and server-validation behavior.

## Acceptance Evidence

- A regression test fails before dot formatting is implemented and passes afterward.
- Browser E2E verifies the stroke map beside the Yellow Ball order controls.
- Browser E2E verifies the map remains visible after order lock and highlights the current hole.
- At 390x844, player labels remain readable and only the hole grid scrolls horizontally.
- Full release and negative-probe gates pass before completion is claimed.

## Release Boundary

Deployment is authorized only through `npm run deploy:production -- --confirm`. After server-confirmed release, update only production draft `cmsuqvycj0001la09ri2bq1fr` to Sunday Church Yellow Ball Skins with handicaps enabled. Preserve its selected players, generated teams, course, date, visibility, and $30 buy-in. Do not create a disposable smoke round.

## Work Log

- 2026-08-16: Dot formatter and production-integration tests failed before implementation, then passed with `•` per received stroke and `-` for none.
- 2026-08-16: Added the shared 18-hole handicap map above both the unlocked Yellow Ball order and locked scoring card. The display uses the complete round's locked handicap map and is omitted when handicaps are disabled.
- 2026-08-16: Desktop and 390x844 browser tests verified all 18 holes, full-round relative offsets, 16px dots, current-hole highlighting, page-width containment, and the handicap map's sticky player labels. Removing sticky positioning failed by 483px before it was restored and passed.
- 2026-08-16: Independent review found no critical defects. Its two important test gaps were fixed with runtime production-component coverage and a non-lowest-team fixture whose lowest player correctly plays 1.
- 2026-08-16: `npm run deploy:production -- --confirm` passed on exact commit `b4b32c35e956d77bd8d444682aace1b13f76f2f1`: 122 unit tests, typecheck, lint with 43 existing warnings and no errors, production build, 5 Playwright tests, schema sync, seed, exact deploy identity, live HTTP, and stopped-build restoration.
- 2026-08-16: Netlify deploy `6a81a14ea3bffef87ae12014` is ready and automatic builds are stopped. The previously targeted draft no longer existed; current live round `cmsvpapkh0001jt09ia7sx74t` was already Yellow Ball with handicaps enabled and displayed the new dot map above the unlocked order with 0/18 scores. No production scoring or round configuration was changed.
