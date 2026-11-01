# SCG-006 — Morning scoring and money safety

Status: fixed and verified locally; publication and attended deployment pending.

## Fixes

Every `finishRound` payout transaction now starts with a conditional `LIVE` to `FINISHED` update on the round row. Exactly one concurrent finisher can claim it. The status claim, player payouts, team totals and season-stat increments share the transaction; failure rolls them all back. Other finishers receive a refresh message instead of applying credits again.

Cross-Threesome and Cross-Foursome final player payouts now allocate whole cents using largest fractional remainders, with stable player IDs breaking equal remainders. This preserves the rounded total payout rather than independently rounding away pennies. Standard $30 six/eight-player amounts are unchanged. Projected per-pair displays may differ from the final allocation by a cent when a split is not divisible into cents; saved per-player payouts remain authoritative.

## Evidence

The real production action implementations were run against a new synthetic PostgreSQL 16.15 database on localhost, using the repository schema. Only Next's cache invalidation was replaced with a no-op; Prisma transactions, score saves/reads, scoring engines and payout writes were real. A barrier forced both finishers to read LIVE before racing, making the regression deterministic.

- Before the guard: both simultaneous finish calls succeeded for six- and eight-player games.
- After the guard: exactly one succeeds; the loser receives the atomic guard's rejection.
- Four real-database scenarios pass under Node 20.19.4: six/eight players at $30 and six/eight players at $25 with tied game leaders.
- Each scenario saves 18 holes for both groups, reloads all player scores, refuses to finish with one missing score, and accepts completion after that score is saved.
- An injected payout-write failure rolls back the finished status and every money write. Retrying after success cannot credit season totals again; ordinary score entry after finish is rejected.
- Standard $30 six-player pot: $180, with the dominant scorer paid $90 and each of three opposite-cart partners $30. Standard $30 eight-player pot: $240, with $120 and four partners at $30. Remaining own-cart players receive $0 in these synthetic scenarios.
- Saved player payouts, team totals and season winnings sum to the exact pot in cents. Each player's season winnings match their recorded payout; buy-ins and rounds played are counted once.
- A $25 eight-player three-way game tie reproduced a two-cent loss before the allocation change. $25, $30 and $30.01 unit scenarios now conserve the pot.
- Full release verification: 202 unit tests, typecheck, lint (51 existing warnings, zero errors), production build and 7 browser tests pass. Negative probes and updated offline Netlify packaging pass.

Run the disposable database tests with `SCG_TEST_DATABASE_URL` set to an existing synthetic localhost database whose name starts `scg_test_`, then `npm run test:persistence`. The test refuses remote or non-test database names and cleans up only its own randomly named fixture records. It does not initialize schemas or use production connection strings. The normal release suite does not require this database.

Local logs in the parent workspace: `scg-persistence-red.log`, `scg-persistence-node20.log`, `scg-cents-red.log`, `scg-cents-green.log`, `scg-morning-release-node20.log`, `scg-morning-negative-probes.log`, `scg-morning-netlify-packaging.log`.

## Release and limits

Include the code-only release gate from SCG-005 and the merged phone scoring work from `d2ce999`. No schema, migration, seed, connection-string or database-topology change is required. Retain the currently serving branch and both preserved database copies. Do not restore, finalize, move endpoints or rename branches as part of deployment.

Concurrent editing of the same physical group's score form remains last-save-wins. The new guard prevents duplicate finalization money writes; it does not add collaborative field merging or a score-entry/finish concurrency protocol. Both groups should confirm their saved scores before a scorer finalizes.

Actual production write testing and payout recalculation on existing rounds were not performed. Further release approval must explicitly authorize the code-only app deployment; it must not authorize DB push, seed or topology changes.
