import test from "node:test";
import assert from "node:assert/strict";

import {
  computeFinalPlayerPayoutRows,
  computePar3PlayerBonuses,
} from "@/lib/payout-breakdown";

const teams = [
  {
    id: "team-1",
    teamNumber: 1,
    totalPayout: 120,
    roundPlayers: [
      {
        id: "rp-1",
        playerId: "griff",
        player: { fullName: "Griff Hamilton", nickname: "Griff" },
      },
      {
        id: "rp-2",
        playerId: "eddie",
        player: { fullName: "Eddie Dennis", nickname: "Eddie" },
      },
      {
        id: "rp-3",
        playerId: "david",
        player: { fullName: "David Hamilton", nickname: "David" },
      },
      {
        id: "rp-4",
        playerId: "julien",
        player: { fullName: "Julien Jenkins", nickname: "Julien" },
      },
    ],
  },
];

const roundPlayers = teams[0].roundPlayers.map((roundPlayer) => ({
  ...roundPlayer,
  team: { id: "team-1", teamNumber: 1 },
}));

test("computePar3PlayerBonuses respects hole payout target fallback", () => {
  const bonuses = computePar3PlayerBonuses(
    teams,
    [
      {
        holeNumber: 4,
        winnerPlayerId: "eddie",
        payoutAmount: 25,
      },
    ],
    new Map([[4, "TEAM" as const]])
  );

  assert.equal(bonuses.get("griff"), 6.25);
  assert.equal(bonuses.get("eddie"), 6.25);
  assert.equal(bonuses.get("david"), 6.25);
  assert.equal(bonuses.get("julien"), 6.25);
});

test("computeFinalPlayerPayoutRows splits shared par 3 winnings across the team", () => {
  const payoutRows = computeFinalPlayerPayoutRows(
    teams,
    roundPlayers,
    [
      {
        holeNumber: 4,
        winnerPlayerId: "eddie",
        payoutAmount: 25,
      },
      {
        holeNumber: 8,
        winnerPlayerId: "eddie",
        payoutAmount: 25,
      },
      {
        holeNumber: 13,
        winnerPlayerId: "eddie",
        payoutAmount: 25,
      },
    ],
    new Map([
      [4, "TEAM" as const],
      [8, "TEAM" as const],
      [13, "TEAM" as const],
    ])
  );

  for (const row of payoutRows) {
    assert.equal(row.mainGamePayout, 30);
    assert.equal(row.par3Payout, 18.75);
    assert.equal(row.totalPayout, 48.75);
  }
});
