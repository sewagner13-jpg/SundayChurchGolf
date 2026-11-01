import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HandicapStrokeCard, HandicapPlayerScoreDetails } from "@/components/handicap-stroke-card";

test("full handicap display uses full strokes and the matching label", () => {
  const props = {currentHole:1, players:[{playerId:"a",name:"A"}], playerHandicapIndexes:{a:6,b:12}, holes:[{holeNumber:1,handicapRank:1}], handicapMode:"full" as const};
  const html = renderToStaticMarkup(<HandicapStrokeCard {...props} />);
  assert.match(html, /Full player handicaps/);
  assert.match(html, /A, hole 1: Gets 1 shot/);
  const details = renderToStaticMarkup(<HandicapPlayerScoreDetails playerId="a" grossScore="5" playerHandicapIndexes={props.playerHandicapIndexes} handicapRank={1} handicapMode="full" />);
  assert.match(details, /Net 4/);
});
