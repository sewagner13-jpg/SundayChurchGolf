import test from "node:test";
import assert from "node:assert/strict";

import * as handicapScoring from "@/lib/handicap-scoring";
import {
  getNetScore,
  getPlayingHandicap,
  getStrokesReceivedForHole,
} from "@/lib/handicap-scoring";
import { formatHandicapStrokeMark } from "@/components/handicap-stroke-card";

const getRelativePlayingHandicaps = (
  handicapScoring as unknown as {
    getRelativePlayingHandicaps?: (
      indexes: Record<string, number | null | undefined>
    ) => Record<string, number | null>;
  }
).getRelativePlayingHandicaps;

test("handicap scoring rounds an index to a whole playing handicap", () => {
  assert.equal(getPlayingHandicap(12.5), 13);
  assert.equal(getPlayingHandicap(-1.5), -2);
  assert.equal(getPlayingHandicap(null), null);
});

test("handicap scoring allocates extra strokes by the course handicap rank", () => {
  assert.equal(getStrokesReceivedForHole(19, 1), 2);
  assert.equal(getStrokesReceivedForHole(19, 2), 1);
  assert.equal(getStrokesReceivedForHole(19, 18), 1);
});

test("handicap scoring adds a stroke back for a plus handicap", () => {
  assert.equal(getStrokesReceivedForHole(-2, 1), -1);
  assert.equal(getNetScore({ grossScore: 4, handicapIndex: -2, handicapRank: 1 }), 5);
  assert.equal(getNetScore({ grossScore: 4, handicapIndex: -2, handicapRank: 3 }), 4);
});

test("handicap stroke marks use one dot per received stroke", () => {
  assert.equal(formatHandicapStrokeMark(null, "dots"), "-");
  assert.equal(formatHandicapStrokeMark(0, "dots"), "-");
  assert.equal(formatHandicapStrokeMark(1, "dots"), "•");
  assert.equal(formatHandicapStrokeMark(2, "dots"), "••");
  assert.equal(formatHandicapStrokeMark(-1, "dots"), "+•");
  assert.equal(formatHandicapStrokeMark(2), "2");
});

test("relative handicaps make the lowest player zero and preserve the differences", () => {
  assert.equal(typeof getRelativePlayingHandicaps, "function");
  assert.deepEqual(
    getRelativePlayingHandicaps?.({ low: 6, middle: 9.2, high: 12.4, missing: null }),
    { low: 0, middle: 3, high: 6, missing: null }
  );
});
