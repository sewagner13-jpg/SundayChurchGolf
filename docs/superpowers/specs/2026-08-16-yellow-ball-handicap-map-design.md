# Yellow Ball Handicap Map Design

## User Outcome

Before locking a Yellow Ball rotation, each team can compare which of its four players receives handicap credit on each hole. The same map remains available while scoring so teams can confirm the current carrier's shot.

## Presentation

Reuse the existing shared `HandicapStrokeCard` as a full 18-hole map above the Yellow Ball order or score controls. Rows represent the team's four players and columns represent Holes 1-18. The current hole is highlighted. The sticky player column shows each player's locked event handicap and relative playing handicap.

Stroke cells use strategy-friendly marks instead of numbers:

- `-` means no stroke.
- `•` means one stroke received.
- `••` means two strokes received.
- Additional strokes repeat the dot once per stroke.
- A plus-prefixed dot sequence represents strokes given only if a negative relative handicap is present.

The map is shown only when Yellow Ball handicap scoring is enabled. Existing order rows continue to list the four repeating assigned holes through Hole 16. Holes 17 and 18 remain manual selections under the established distinct-player rule.

## Scoring Authority

The display consumes the same locked round handicap indexes, course handicap ranks, `getRelativePlayingHandicaps`, and `getStrokesReceivedForHole` helpers used by server-authoritative Yellow Ball scoring. The lowest rounded handicap in the complete round plays from zero; every other player is offset from that value. No slope or tee adjustment is introduced.

The map is informational. It does not calculate a separate score, recommend an order, mutate the locked handicaps, or allow the client to submit derived strokes.

## Component Boundary

Extend `SundayChurchYellowBallScoring` with the round's ordered hole metadata and render `HandicapStrokeCard` before either the unlocked-order card or locked scoring card. Add a display-mode prop to the shared card so Yellow Ball can render one dot per received stroke while existing number-based handicap displays remain unchanged.

Keep formatting in a small exported pure helper so dot behavior is unit tested without coupling the test to React markup.

## Mobile Behavior

The map keeps the player column sticky and confines horizontal scrolling to the table container. Hole columns have stable widths. At 390x844, the page itself must not overflow horizontally, player names and playing handicaps must remain readable, and current-hole highlighting must remain visible.

## Error And Empty States

Missing handicap data renders the existing unavailable state rather than guessing. A zero result renders `-`. The map is omitted when Yellow Ball handicaps are disabled because gross scoring receives no handicap credit.

## Verification

1. Unit test the dot formatter, including zero, one, two, and negative strokes, and prove the test red before production code changes.
2. Extend the Yellow Ball browser fixture to include the real order-selection map.
3. Verify all 18 holes, all four players, dots, relative handicaps, current-hole highlighting, persistence after lock, and phone-only grid scrolling.
4. Run the focused tests, full test suite, typecheck, lint, build, E2E, negative probes, and release verification.

## Release Boundary

This ticket does not authorize deployment or production data changes. A verified implementation must be committed to `main`; production release remains a separate attended approval.
