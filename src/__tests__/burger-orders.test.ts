import assert from "node:assert/strict";
import test from "node:test";
import { readBurgerSelections, changeBurgerSelection, retryBurgerWrite, preserveBurgerOrdersForFormatUpdate } from "../lib/burger-orders";

test("shared selections retain players from different groups and omit invalid ids", () => {
  assert.deepEqual(readBurgerSelections({burgerOrders: {selectedPlayerIds: ["a", "b", "a", "unknown"]}}, ["a", "b"]), ["a", "b"]);
});

test("a new mark preserves a different group's saved mark and other format settings", () => {
  const result = changeBurgerSelection({useHandicaps: true, burgerOrders: {selectedPlayerIds: ["a"]}}, ["a", "b"], "b", true);
  assert.deepEqual(readBurgerSelections(result, ["a", "b"]), ["a", "b"]);
  assert.equal(result.useHandicaps, true);
});

test("unmarking one player preserves everyone else", () => {
  assert.deepEqual(readBurgerSelections(changeBurgerSelection({burgerOrders: {selectedPlayerIds: ["a", "b"]}}, ["a", "b"], "a", false), ["a", "b"]), ["b"]);
});

test("mark writes are idempotent and reject outsiders", () => {
  const first = changeBurgerSelection(null, ["a"], "a", true);
  assert.deepEqual(readBurgerSelections(changeBurgerSelection(first, ["a"], "a", true), ["a"]), ["a"]);
  assert.throws(() => changeBurgerSelection(first, ["a"], "outsider", true), /not in this round/);
  assert.throws(() => changeBurgerSelection(first, ["a"], "a", "yes" as unknown as boolean), /true or false/);
});

test("malformed stored selection data becomes an empty valid list", () => {
  assert.deepEqual(readBurgerSelections({burgerOrders: {selectedPlayerIds: "a"}}, ["a"]), []);
  assert.deepEqual(readBurgerSelections(null, ["a"]), []);
});

test("transaction conflicts rerun against latest saved names", async () => {
  let attempts = 0;
  let current = {burgerOrders: {selectedPlayerIds: [] as string[]}};
  const result = await retryBurgerWrite(async () => {
    attempts++;
    if (attempts === 1) {
      current = {burgerOrders: {selectedPlayerIds: ["a"]}};
      throw {code: "P2034"};
    }
    return changeBurgerSelection(current, ["a", "b"], "b", true);
  });
  assert.deepEqual(readBurgerSelections(result, ["a", "b"]), ["a", "b"]);
  assert.equal(attempts, 2);
});

test("transaction conflict retries stop after three attempts", async () => {
  let attempts = 0;
  await assert.rejects(retryBurgerWrite(async () => { attempts++; throw Object.assign(new Error("conflict"), {code: "P2034"}); }), /conflict/);
  assert.equal(attempts, 3);
});

test("ordinary write failures are surfaced without retry", async () => {
  let attempts = 0;
  await assert.rejects(retryBurgerWrite(async () => { attempts++; throw new Error("offline"); }), /offline/);
  assert.equal(attempts, 1);
});

test("stale format edits preserve the latest shared burger marks", () => {
  const result = preserveBurgerOrdersForFormatUpdate(
    {burgerOrders: {selectedPlayerIds: ["a", "b"], updatedAt: "latest"}, oldSetting: true},
    {burgerOrders: {selectedPlayerIds: ["a"]}, useHandicaps: false}
  );
  assert.deepEqual(result, {burgerOrders: {selectedPlayerIds: ["a", "b"], updatedAt: "latest"}, useHandicaps: false});
});

test("format edits cannot introduce burger marks when none exist", () => {
  assert.deepEqual(preserveBurgerOrdersForFormatUpdate(null, {burgerOrders: {selectedPlayerIds: ["a"]}, useHandicaps: true}), {useHandicaps: true});
});
