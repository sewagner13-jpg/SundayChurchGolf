# SCG-003: Yellow Ball Handicap Map

## Status

Design and production release approved in conversation on 2026-08-16. Implementation pending.

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
