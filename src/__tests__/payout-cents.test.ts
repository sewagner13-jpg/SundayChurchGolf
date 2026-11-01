import assert from "node:assert/strict";
import test from "node:test";
import { conservePayoutCents } from "@/lib/payout-cents";

test("whole-cent allocation settles equal remainders by stable player ID", () => {
  const result = conservePayoutCents(new Map([["b", 1 / 3], ["a", 1 / 3], ["c", 1 / 3]]));
  assert.equal(result.get("a"), 0.34);
  assert.equal(result.get("b"), 0.33);
  assert.equal(result.get("c"), 0.33);
});
test("empty and already exact payouts are preserved", () => {
  assert.deepEqual(conservePayoutCents(new Map()), new Map());
  assert.deepEqual(conservePayoutCents(new Map([["a", 30], ["b", 7.5]])), new Map([["a", 30], ["b", 7.5]]));
});
