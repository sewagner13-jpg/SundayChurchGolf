import test from "node:test";
import assert from "node:assert/strict";

import {
  getNetScore,
  getPlayingHandicap,
  getStrokesReceivedForHole,
} from "@/lib/handicap-scoring";

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
