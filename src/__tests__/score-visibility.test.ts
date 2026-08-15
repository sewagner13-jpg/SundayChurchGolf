import assert from "node:assert/strict";
import test from "node:test";

import {
  canRevealHoleOutcome,
  canRevealTeamScore,
} from "@/lib/score-visibility";

const blindLive = {
  visibility: "BLIND",
  roundStatus: "LIVE",
  blindRevealMode: "REVEAL_AFTER_ROUND",
  holeComplete: false,
};

test("blind live scorecards reveal only the scoring team's values", () => {
  assert.equal(
    canRevealTeamScore({
      ...blindLive,
      teamId: "team-a",
      teamIdContext: "team-a",
    }),
    true
  );
  assert.equal(
    canRevealTeamScore({
      ...blindLive,
      teamId: "team-b",
      teamIdContext: "team-a",
    }),
    false
  );
  assert.equal(canRevealHoleOutcome(blindLive), false);
});

test("reveal-after-hole exposes scores and outcome only after every team scores", () => {
  const revealAfterHole = {
    ...blindLive,
    blindRevealMode: "REVEAL_AFTER_HOLE",
    holeComplete: true,
  };
  assert.equal(
    canRevealTeamScore({
      ...revealAfterHole,
      teamId: "team-b",
      teamIdContext: "team-a",
    }),
    true
  );
  assert.equal(canRevealHoleOutcome(revealAfterHole), true);
});
