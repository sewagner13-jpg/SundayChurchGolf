# Sunday Church Yellow Ball Skins Design

## Domain Model

`Round.formatConfig.useYellowBallHandicaps` defaults to `true`. `Team.formatConfig.yellowBallOrder` contains exactly four unique IDs from that team's roster. Team-owned storage prevents concurrent teams from overwriting each other's order.

The server derives the carrier from the locked order on holes 1-16. Holes 17 and 18 accept a carrier selection from the same team; Hole 18 must differ from Hole 17. Once a team has any score, its order cannot change.

## Handicap Calculation

At round start, selected player handicap indexes are locked in `RoundPlayer.eventHandicapIndex`. Each is rounded to a whole playing handicap. The lowest rounded value in the entire round becomes zero and is subtracted from every other player. Course handicap rank allocates strokes; slope and tee position do not modify the calculation.

Only the yellow-ball gross score receives strokes. The scramble score always remains gross. Missing handicaps block start only when yellow-ball handicapping is enabled.

## Scoring

For each team and hole:

`combined = yellow-ball gross - strokes received + three-player scramble gross`

Exactly one lowest valid combined score wins the accumulated skins. A tie for lowest or incomplete scoring carries all skins. `BLANK`, `X`, and invalid component scores cannot win. Unresolved Hole 18 skins use the existing Sunday Church final tiebreaker.

The carrier's gross score is stored in `PlayerScore`. `HoleScore.value` and `grossScore` store the combined score. `HoleScore.holeData` stores the carrier, component scores, strokes, net, total, and whether handicap credit changed the score.

## UI Contract

The scoring control says **Enter gross scores** and has exactly two score inputs. Carrier, shots, yellow-ball net, combined total, pending state, success, and actionable failure render beside the save control through the shared controlled-action mechanism.

Leaderboard, scorecard, and summary use one shared responsive score grid. Each cell leads with the bold combined total, then carrier name and `yellow net + Scr gross`. A single `•` follows the total when one or more strokes improved it. The grid owns horizontal scrolling; team labels and hole headers remain sticky.

## Release

The feature must pass unit, type, lint, build, browser E2E, negative probes, and release verification. Deployment and production data mutation remain separately authorized.
