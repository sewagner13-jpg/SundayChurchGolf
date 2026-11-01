import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { changeLiveHoleContestWinner } from "../lib/live-hole-contests";
import { retryBurgerWrite } from "../lib/burger-orders";

const config = {
  useHandicaps: true,
  burgerOrders: { selectedPlayerIds: ["a"] },
  par3Contest: {
    enabled: true, fundingType: "SEPARATE_BUY_IN", amountPerPlayer: 5,
    participantPlayerIds: ["a", "b"], customSetting: "preserve",
    holes: [
      { holeNumber: 3, contestType: "CLOSEST_TO_PIN", payoutTarget: "PLAYER" },
      { holeNumber: 6, contestType: "LONGEST_PUTT", payoutTarget: "TEAM" },
    ], results: [],
  },
};
function change(current: unknown, hole: number, winner: string | null, expected: string | null, status = "LIVE") {
  return changeLiveHoleContestWinner(current, status, ["a", "b", "c"], hole, winner, expected);
}
test("live winners preserve unrelated config and winners on other holes", () => {
  const first = change(config, 3, "a", null);
  const next = change(first, 6, "b", null);
  assert.deepEqual(next.burgerOrders, config.burgerOrders);
  assert.equal(next.useHandicaps, true);
  assert.equal((next.par3Contest as Record<string, unknown>).customSetting, "preserve");
  assert.deepEqual(next.par3Contest.results, [
    { holeNumber: 3, winnerPlayerId: "a", payoutTarget: "PLAYER" },
    { holeNumber: 6, winnerPlayerId: "b", payoutTarget: "TEAM" },
  ]);
  assert.deepEqual(config.par3Contest.results, []);
});
test("same-hole stale writes cannot replace another group's winner", () => {
  const first = change(config, 3, "a", null);
  assert.throws(() => change(first, 3, "b", null), /changed.*Refresh/);
  assert.equal(change(first, 3, "b", "a").par3Contest.results[0].winnerPlayerId, "b");
});
test("serialization retries merge another hole and burger updates", async () => {
  let latest: unknown = config;
  let attempts = 0;
  const result = await retryBurgerWrite(async () => {
    if (++attempts === 1) {
      latest = { ...change(config, 6, "b", null), burgerOrders: { selectedPlayerIds: ["b"] } };
      throw { code: "P2034" };
    }
    return change(latest, 3, "a", null);
  });
  assert.equal(result.par3Contest.results.length, 2);
  assert.deepEqual(result.burgerOrders, { selectedPlayerIds: ["b"] });
});
test("live writes validate status, configured holes and eligible round players", () => {
  for (const status of ["SETUP", "FINISHED"]) assert.throws(() => change(config, 3, "a", null, status), /live round/);
  for (const player of ["outsider", "c"]) assert.throws(() => change(config, 3, player, null), /eligible/);
  assert.throws(() => change(config, 4, "a", null), /configured/);
  assert.throws(() => change(config, 3.5, "a", null), /hole/);
  assert.throws(() => change(null, 3, "a", null), /enabled/);
});
test("clearing and leaving the saved winner are explicit and preserve prize overrides", () => {
  const first = change(config, 3, "a", null);
  first.par3Contest.results[0].payoutAmount = 7;
  assert.equal(change(first, 3, "a", "a").par3Contest.results[0].payoutAmount, 7);
  assert.equal(change(first, 3, null, "a").par3Contest.results[0].winnerPlayerId, null);
});
test("live server action only updates round config in a serializable transaction", () => {
  const action = readFileSync(new URL("../actions/live-hole-contests.ts", import.meta.url), "utf8");
  assert.match(action, /TransactionIsolationLevel.Serializable/);
  assert.match(action, /tx\.round\.update/);
  assert.doesNotMatch(action, /tx\.(team|roundPlayer|seasonPlayerStat)\.(update|upsert|create)/);
});


test("hole navigation discards late reads and saves never replace score input state", async () => {
  const { createBurgerRefresh } = await import("../lib/burger-refresh");
  let resolve!: (winner: string) => void;
  const seen: string[] = [];
  const previousHole = createBurgerRefresh(() => new Promise<string>((done) => { resolve = done; }), (value) => seen.push(value), () => {});
  const pending = previousHole.refresh();
  previousHole.stop();
  resolve("old hole winner");
  await pending;
  assert.deepEqual(seen, []);
  const ui = readFileSync(new URL("../components/live-hole-contest.tsx", import.meta.url), "utf8");
  assert.match(ui, /key=\{`\$\{props.roundId\}:\$\{props.holeNumber\}`\}/);
  assert.match(ui, /10000/);
  assert.doesNotMatch(ui, /router\.refresh|saveHoleScores|updateScores/);
});
