# SCG-009 — Bet-first scoring, shared hole winners and money receipts

User requested a substantially simpler round experience, net information next to each player's entry, always-visible other-group scores, active six-hole event only on the main screen, and itemized winnings after finishing. They then asked to proceed and include live closest/other configured hole-contest winners editable by both groups.

The cross-group screen now shows the other group's latest saved scores, one active six-hole bet, own net / teammate net / pair best net alongside each player's stroke field, and inline configured contest winner selection. Other bets, burgers and chat are collapsed in one tools section. Previous/next and finishing protect unsaved edits; failed discard preserves the draft. Saved inputs are keyed by round/group/hole with stale-request suppression. Score-entry arithmetic and gross-score persistence are unchanged. Non-cross formats gain inline hole contest selection.

Shared winner writes merge the latest format config in Serializable transactions and retry write conflicts. Same-hole edits compare the expected current winner. Changing no selection does not write. These live writes never pay money. All five finishRound paths award recorded hole prizes inside the existing claim-protected transaction, normalize default amounts and preserve exact cents in team splits and later corrections. Season top-team counters follow final flags; cross-group formats keep no physical top-team awards.

Finishing opens Money won directly. Player receipts itemize each completed cross bet and configured hole prize, sum exact cents to the recorded payout, and expose an explicit adjustment when historical details differ from recorded money. Historical money is never silently rewritten.

Validation:
- Full release verification: 241 unit tests, typecheck, line caps, lint (50 existing warnings, zero errors), production build, 17 mounted browser tests.
- Independent review found gross-mode display, failed-discard, unsaved finishing and top-team consistency issues; all have regression coverage and are fixed.
- Five real disposable-local PostgreSQL scenarios pass. Added deterministic concurrent different-hole winner saves, stale same-hole rejection, no early money writes, failed-finish rollback, concurrent finish exactly once, and $240 main bets plus $24 contest prize reconciliation with receipt items and season stats. The new localhost-only cluster was stopped after tests.
- Production verification is read-only. No hosted data edits, SQL, schema sync, migration, seed, connection, topology, dependency or deploy configuration change is part of publication.

Limits: UI browser tests use Chromium emulation; physical iPhone/Safari and live prize submission are not exercised. Unknown historical bet attribution is labeled rather than invented. Configured contest types use the existing per-hole contest model.
