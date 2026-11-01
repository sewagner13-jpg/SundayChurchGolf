# SCG-010 — Less crowded scoring

User feedback: the bet-first screen looks better but remains too clustered.

The current bet keeps its lead/tie status and progress visible, with the full pair table under one expandable Pair standings row. The other group stays visible as a lighter strip. Player cards have larger padding and separation, a wider stroke field, and three aligned net values (own, partner, pair best) instead of scattered inline numbers. Removed the duplicate Home link; main navigation retains Home. Secondary explanatory copy and competing heavy borders are reduced.

Only presentation and mounted browser checks change. No score, winner, payout, database, finalization, visibility or save behavior changes. The fixture's simulation button moved below the real screen so geometry checks measure the product layout.

Phone tests at 320px and 390px verify the first stroke field appears above 600px, player cards have at least 16px separation, pair standings expand on demand, names and net values remain accessible, no horizontal overflow, and refresh/save/discard/finish safeguards remain intact. Geometry checks failed against the previous layout (first input at 746px in fixture) and passed after the change. Independent review found no material regression. Use the existing code-only release gate; production verification remains read-only.
