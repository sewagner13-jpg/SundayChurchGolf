import assert from "node:assert/strict";
import test from "node:test";
import { Decimal } from "@prisma/client/runtime/library";
import { buildHoleContestPayouts, splitContestPayout } from "../lib/finalize-hole-contests";

const players = ["a", "b", "c"].map((id) => ({ id: `rp-${id}`, playerId: id, teamId: "team", wasOnTopPayingTeam: true }));
const round = {
  date: new Date("2026-10-31T12:00:00Z"),
  roundPlayers: players,
  teams: [{ id: "team", roundPlayers: players }],
  formatConfig: { unrelated: { keep: true }, par3Contest: {
    enabled: true, amountPerPlayer: 10, fundingType: "SEPARATE_BUY_IN",
    holes: [1, 2, 3].map((holeNumber) => ({ holeNumber, contestType: "LONGEST_PUTT", payoutTarget: "TEAM" })),
    results: [{ holeNumber: 1, winnerPlayerId: "a" }, { holeNumber: 2, winnerPlayerId: "b", payoutTarget: "PLAYER" }],
  } },
};

test("live winners receive default amounts and exact-cent team shares", () => {
  const plan = buildHoleContestPayouts(round);
  assert.deepEqual(plan.results.map((result) => result.payoutAmount), [10, 10]);
  assert.equal(plan.teamDeltas.get("team")?.toString(), "10");
  assert.deepEqual([...plan.roundPlayerDeltas].map(([id, amount]) => [id, amount.toString()]), [
    ["rp-a", "3.34"], ["rp-b", "13.33"], ["rp-c", "3.33"],
  ]);
  assert.equal([...plan.seasonStatDeltas.values()].reduce((sum, value) => sum.add(value), new Decimal(0)).toString(), "20");
});

test("team split is stable regardless of roster query order and reverses exactly", () => {
  const positive = splitContestPayout(new Decimal(10), [...players].reverse());
  const negative = splitContestPayout(new Decimal(-10), players);
  for (const [id, amount] of positive) assert.equal(amount.add(negative.get(id)!).toString(), "0");
});

test("defaults allocate a pot with uneven cents without overpayment", () => {
  const plan = buildHoleContestPayouts({ ...round, formatConfig: { par3Contest: {
    ...round.formatConfig.par3Contest, amountPerPlayer: 0.01,
    holes: round.formatConfig.par3Contest.holes.slice(0, 2),
  } } });
  assert.deepEqual(plan.results.map((result) => result.payoutAmount), [0.02, 0.01]);
});

test("explicit override and unrecorded contests do not award default money", () => {
  const config = round.formatConfig.par3Contest;
  const plan = buildHoleContestPayouts({ ...round, formatConfig: { par3Contest: { ...config,
    results: [{ holeNumber: 1, winnerPlayerId: "a", payoutAmount: 0 }, { holeNumber: 2, winnerPlayerId: null }],
  } } });
  assert.equal([...plan.roundPlayerDeltas.values()].reduce((sum, value) => sum.add(value), new Decimal(0)).toString(), "0");
  assert.deepEqual(plan.results.map((result) => result.payoutAmount), [0, 0]);
});

test("transaction reads latest winners, preserves config, and finalization claim pays once", async () => {
  const { finalizeHoleContests } = await import("../lib/finalize-hole-contests");
  const { claimRoundFinalization } = await import("../lib/round-finalization");
  let status = "LIVE";
  let savedConfig: unknown;
  const playerPayouts = new Map(players.map((player) => [player.id, new Decimal(5)]));
  const winnings = new Map(players.map((player) => [player.playerId, new Decimal(5)]));
  let teamPayout = new Decimal(15);
  const tx = {
    round: {
      updateMany: async () => {
        const count = status === "LIVE" ? 1 : 0;
        status = "FINISHED";
        return { count };
      },
      findUnique: async () => round,
      update: async ({ data }: { data: { formatConfig: unknown } }) => { savedConfig = data.formatConfig; },
    },
    roundPlayer: { update: async ({ where, data }: { where: { id: string }; data: { payoutAmount?: { increment: Decimal } } }) => {
      if (data.payoutAmount) playerPayouts.set(where.id, playerPayouts.get(where.id)!.add(data.payoutAmount.increment));
    } },
    team: {
      update: async ({ data }: { data: { totalPayout?: { increment: Decimal } } }) => {
        if (data.totalPayout) teamPayout = teamPayout.add(data.totalPayout.increment);
      },
      findMany: async () => [{ id: "team", totalPayout: teamPayout }],
    },
    seasonPlayerStat: { upsert: async ({ where, update }: { where: { year_playerId: { playerId: string } }; update: { totalWinnings: { increment: Decimal } } }) => {
      const id = where.year_playerId.playerId;
      winnings.set(id, winnings.get(id)!.add(update.totalWinnings.increment));
    } },
  } as unknown as import("@prisma/client").Prisma.TransactionClient;
  const finish = async () => {
    await claimRoundFinalization(tx, "round");
    await finalizeHoleContests(tx, "round");
  };
  const outcomes = await Promise.allSettled([finish(), finish()]);
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((result) => result.status === "rejected").length, 1);
  assert.equal(teamPayout.toString(), "25");
  assert.deepEqual([...playerPayouts.values()].map(String), ["8.34", "18.33", "8.33"]);
  assert.deepEqual([...winnings.values()].map(String), ["8.34", "18.33", "8.33"]);
  assert.deepEqual((savedConfig as typeof round.formatConfig).unrelated, { keep: true });
  assert.deepEqual((savedConfig as typeof round.formatConfig).par3Contest.results.map((result) => (result as { payoutAmount?: number }).payoutAmount), [10, 10]);
});

for (const formatId of ["nassau", "cross_threesome_6_6_6", "cross_foursome_6_6_6_18"]) {
  test(`top-team flags and season appearances stay aligned after contest correction (${formatId})`, async () => {
    const { refreshHoleContestTopTeams } = await import("../lib/finalize-hole-contests");
    const crossGroup = formatId.startsWith("cross_");
    const counts = new Map([["a", crossGroup ? 2 : 3], ["b", 2]]);
    const flags = new Map([["a", !crossGroup], ["b", false]]);
    const teamFlags = new Map<string, boolean>();
    const snapshot = {
      date: round.date, formatId,
      roundPlayers: [
        { id: "rp-a", playerId: "a", teamId: "old", wasOnTopPayingTeam: !crossGroup },
        { id: "rp-b", playerId: "b", teamId: "new", wasOnTopPayingTeam: false },
      ],
    };
    const tx = {
      round: { findUnique: async () => snapshot },
      team: {
        findMany: async () => [{ id: "new", totalPayout: new Decimal(30) }, { id: "old", totalPayout: new Decimal(20) }],
        update: async ({ where, data }: { where: { id: string }; data: { isTopPayingTeam: boolean } }) => teamFlags.set(where.id, data.isTopPayingTeam),
      },
      roundPlayer: { update: async ({ where, data }: { where: { id: string }; data: { wasOnTopPayingTeam: boolean } }) => {
        const player = snapshot.roundPlayers.find((player) => player.id === where.id)!;
        flags.set(player.playerId, data.wasOnTopPayingTeam);
        player.wasOnTopPayingTeam = data.wasOnTopPayingTeam;
      } },
      seasonPlayerStat: { upsert: async ({ where, update }: { where: { year_playerId: { playerId: string } }; update: { topTeamAppearances: { increment: number } } }) => {
        const playerId = where.year_playerId.playerId;
        counts.set(playerId, counts.get(playerId)! + update.topTeamAppearances.increment);
      } },
    } as unknown as import("@prisma/client").Prisma.TransactionClient;
    await refreshHoleContestTopTeams(tx, "round");
    assert.deepEqual([...counts], [["a", 2], ["b", crossGroup ? 2 : 3]]);
    assert.deepEqual([...flags], [["a", false], ["b", !crossGroup]]);
    assert.equal(teamFlags.get("new"), !crossGroup);
    await refreshHoleContestTopTeams(tx, "round");
    assert.deepEqual([...counts], [["a", 2], ["b", crossGroup ? 2 : 3]], "reapplying unchanged flags must not duplicate appearances");
  });
}
