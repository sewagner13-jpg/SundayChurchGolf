# SCG-003: Yellow Ball Handicap Map

## Status

Design approved in conversation on 2026-08-16. Written specification awaits user review.

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

Deployment and production data changes are not authorized. Release requires a separate explicit approval through the attended production gate.
