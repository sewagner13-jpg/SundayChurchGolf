# Bet-first scoring and winnings

User opted to proceed: make the bets easy to follow, remove wasted scoring tabs, show only the active six-hole event, teammate net in the same player entry box, always-visible other-group scores. Player entry remains strokes with calculated net displayed; changing the scoring engine's gross storage is outside scope. Other bets and tools move behind a single expandable section.

Final money page is a player list, with each winning bet amount adding to the authoritative recorded total, including configured hole contests. No silent inferred payouts. Differences are explicitly labeled. Finish goes directly to the money list; detailed scores remain accessible separately.

Configured closest/longest-putt/furthest/etc contests are editable during hole entry. Both groups see the same current name; leaving it alone performs no write. Updating uses latest config, per-hole optimistic comparison and Serializable retries; different-hole edits and burgers survive. Only finalization pays prizes, inside the existing atomic finish claim. No schema, migration, seed, routing or production data repair.

Approaches considered: keep adding panels (rejected, clutter); add more tabs (rejected by user); replace the cross-group scoring view with the focused bet screen (selected). Existing non-cross scoring remains available and gains inline contests. Existing Tailwind3 retained instead of a dependency migration. Test engine-boundary calculations, money conservation, contest conflicts and phone views with local synthetic data.
