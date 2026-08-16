import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Decimal } from "@prisma/client/runtime/library";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SundayChurchYellowBallScoring } from "@/components/sunday-church-yellow-ball-scoring";
import { getRelativePlayingHandicaps } from "@/lib/handicap-scoring";
import { getFormatById } from "@/lib/format-definitions";
import {
  assertSundayChurchYellowBallDedicatedScoreAction,
  assertSundayChurchYellowBallLiveConfigChange,
  assertSundayChurchYellowBallRoundStart,
} from "@/lib/sunday-church-yellow-ball-round";
import {
  calculateSundayChurchYellowBallResults,
  computeSundayChurchYellowBallHoleScore,
  getSundayChurchYellowBallCarrier,
  resolveSundayChurchYellowBallCarryoverTiebreaker,
  shouldMarkSundayChurchYellowBallHandicap,
  validateSundayChurchYellowBallHoleInput,
  validateSundayChurchYellowBallOrder,
  validateSundayChurchYellowBallSetup,
  type SundayChurchYellowBallScore,
} from "@/lib/sunday-church-yellow-ball-skins";

const teams = [
  { id: "team-a", teamNumber: 1 },
  { id: "team-b", teamNumber: 2 },
  { id: "team-c", teamNumber: 3 },
];

const courseHoles = Array.from({ length: 18 }, (_, index) => ({
  holeNumber: index + 1,
  par: 4,
  handicapRank: index + 1,
}));

function score(
  teamId: string,
  holeNumber: number,
  value: number | null,
  entryType: SundayChurchYellowBallScore["entryType"] = "VALUE"
): SundayChurchYellowBallScore {
  return { teamId, holeNumber, entryType, value };
}

test("yellow-ball skins is a seeded four-player skins format", () => {
  const format = getFormatById("sunday_church_yellow_ball_skins");
  assert.equal(format?.name, "Sunday Church Yellow Ball Skins");
  assert.equal(format?.formatCategory, "skins");
  assert.deepEqual(format?.supportedTeamSizes, [4]);
  assert.equal(
    format?.configOptions.find((option) => option.key === "useYellowBallHandicaps")
      ?.defaultValue,
    true
  );
});

test("yellow-ball hole input rejects client-supplied derived scoring fields", () => {
  assert.deepEqual(
    validateSundayChurchYellowBallHoleInput({
      yellowBallGrossScore: 4,
      scrambleGrossScore: 4,
    }),
    []
  );
  assert.match(
    validateSundayChurchYellowBallHoleInput({
      yellowBallGrossScore: 4,
      scrambleGrossScore: 4,
      combinedScore: 6,
      strokesReceived: 2,
    }).join(" "),
    /derived scoring fields/i
  );
});

test("generic hole scoring cannot bypass the dedicated yellow-ball action", async () => {
  const scoringSource = await readFile(
    new URL("../actions/scoring.ts", import.meta.url),
    "utf8"
  );
  assert.match(
    scoringSource,
    /assertSundayChurchYellowBallDedicatedScoreAction\(round\.formatId\)/
  );
  assert.throws(
    () => assertSundayChurchYellowBallDedicatedScoreAction("sunday_church_yellow_ball_skins"),
    /Yellow Ball gross-score entry form/i
  );
  assert.doesNotThrow(() =>
    assertSundayChurchYellowBallDedicatedScoreAction("default-sunday-church")
  );
});

test("yellow-ball scoring shows the shared dot handicap map for every course hole", async () => {
  const [componentSource, pageSource] = await Promise.all([
    readFile(
      new URL("../components/sunday-church-yellow-ball-scoring.tsx", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/rounds/[id]/scoring/page.tsx", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(componentSource, /<HandicapStrokeCard/);
  assert.match(componentSource, /strokeDisplay="dots"/);
  assert.match(componentSource, /title="Yellow Ball Handicap Shots"/);
  assert.match(componentSource, /useYellowBallHandicaps\s*&&/);
  assert.match(pageSource, /holes=\{round\.course\.holes\}/);
});

test("yellow-ball production component uses full-round offsets and hides the map when disabled", () => {
  const props = {
    roundId: "round-1",
    teamId: "team-b",
    teamLabel: "Team Bravo",
    currentHole: 1,
    handicapRank: 1,
    holes: courseHoles,
    players: [
      { playerId: "b1", name: "Jim" },
      { playerId: "b2", name: "David" },
      { playerId: "b3", name: "Tony" },
      { playerId: "b4", name: "Sean" },
    ],
    teamFormatConfig: null,
    playerHandicapIndexes: {
      a1: 6,
      a2: 9,
      a3: 12,
      a4: 15,
      b1: 7,
      b2: 10,
      b3: 13,
      b4: 16,
    },
    existingHoleData: null,
    hole17CarrierId: null,
    blocked: false,
    onSaved: () => undefined,
  };
  const enabled = renderToStaticMarkup(
    createElement(SundayChurchYellowBallScoring, {
      ...props,
      useYellowBallHandicaps: true,
    })
  );
  const disabled = renderToStaticMarkup(
    createElement(SundayChurchYellowBallScoring, {
      ...props,
      useYellowBallHandicaps: false,
    })
  );

  assert.match(enabled, /Yellow Ball Handicap Shots/);
  assert.match(enabled, /HCP 7 \/ plays 1/);
  assert.doesNotMatch(disabled, /Yellow Ball Handicap Shots/);
});

test("yellow-ball setup requires two four-player teams and all enabled handicaps", () => {
  const validTeams = [
    { id: "team-a", playerIds: ["a1", "a2", "a3", "a4"] },
    { id: "team-b", playerIds: ["b1", "b2", "b3", "b4"] },
  ];
  const handicaps = Object.fromEntries(
    validTeams.flatMap((team) => team.playerIds.map((playerId) => [playerId, 8]))
  );

  assert.deepEqual(
    validateSundayChurchYellowBallSetup({
      teams: validTeams,
      playerHandicapIndexes: handicaps,
      useYellowBallHandicaps: true,
    }),
    []
  );
  assert.match(
    validateSundayChurchYellowBallSetup({
      teams: validTeams.slice(0, 1),
      playerHandicapIndexes: handicaps,
      useYellowBallHandicaps: true,
    }).join(" "),
    /at least two teams/i
  );
  assert.match(
    validateSundayChurchYellowBallSetup({
      teams: [{ id: "team-a", playerIds: ["a1", "a2", "a3"] }, validTeams[1]],
      playerHandicapIndexes: handicaps,
      useYellowBallHandicaps: true,
    }).join(" "),
    /exactly four players/i
  );
  assert.match(
    validateSundayChurchYellowBallSetup({
      teams: validTeams,
      playerHandicapIndexes: { ...handicaps, b4: null },
      useYellowBallHandicaps: true,
    }).join(" "),
    /missing a handicap/i
  );
  assert.deepEqual(
    validateSundayChurchYellowBallSetup({
      teams: validTeams,
      playerHandicapIndexes: { ...handicaps, b4: null },
      useYellowBallHandicaps: false,
    }),
    []
  );
});

test("round start and live edits enforce yellow-ball team and handicap locks", () => {
  const round = {
    formatId: "sunday_church_yellow_ball_skins",
    teamSize: 4,
    teams: [
      {
        teamNumber: 1,
        roundPlayers: ["a1", "a2", "a3", "a4"].map((playerId) => ({ playerId })),
      },
      {
        teamNumber: 2,
        roundPlayers: ["b1", "b2", "b3", "b4"].map((playerId) => ({ playerId })),
      },
    ],
    roundPlayers: ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"].map(
      (playerId) => ({ playerId, player: { handicapIndex: 8 } })
    ),
    formatConfig: { useYellowBallHandicaps: true },
  };

  assert.doesNotThrow(() => assertSundayChurchYellowBallRoundStart(round));
  assert.throws(
    () =>
      assertSundayChurchYellowBallRoundStart({
        ...round,
        roundPlayers: round.roundPlayers.map((roundPlayer, index) =>
          index === 7
            ? { ...roundPlayer, player: { handicapIndex: null } }
            : roundPlayer
        ),
      }),
    /missing a handicap/i
  );
  assert.throws(
    () => assertSundayChurchYellowBallRoundStart({ ...round, teamSize: 3 }),
    /teams of four/i
  );
  assert.throws(
    () =>
      assertSundayChurchYellowBallLiveConfigChange(
        { ...round, holeScores: [{}] },
        { useYellowBallHandicaps: false }
      ),
    /cannot change after scoring begins/i
  );
  assert.doesNotThrow(() =>
    assertSundayChurchYellowBallLiveConfigChange(
      { ...round, holeScores: [{}] },
      { useYellowBallHandicaps: true }
    )
  );
});

test("yellow-ball orders contain four unique team players", () => {
  const roster = ["a1", "a2", "a3", "a4"];
  assert.deepEqual(validateSundayChurchYellowBallOrder(roster, roster), []);
  assert.match(
    validateSundayChurchYellowBallOrder(["a1", "a1", "a3", "a4"], roster).join(" "),
    /unique/i
  );
  assert.match(
    validateSundayChurchYellowBallOrder(["a1", "a2", "a3", "b1"], roster).join(" "),
    /team roster/i
  );
});

test("yellow-ball carrier repeats the locked order on holes 1 through 16", () => {
  const order = ["a1", "a2", "a3", "a4"];
  assert.equal(getSundayChurchYellowBallCarrier({ holeNumber: 1, yellowBallOrder: order }), "a1");
  assert.equal(getSundayChurchYellowBallCarrier({ holeNumber: 4, yellowBallOrder: order }), "a4");
  assert.equal(getSundayChurchYellowBallCarrier({ holeNumber: 5, yellowBallOrder: order }), "a1");
  assert.equal(getSundayChurchYellowBallCarrier({ holeNumber: 16, yellowBallOrder: order }), "a4");
});

test("holes 17 and 18 use manual team carriers and reject a repeated player", () => {
  const order = ["a1", "a2", "a3", "a4"];
  assert.equal(
    getSundayChurchYellowBallCarrier({
      holeNumber: 17,
      yellowBallOrder: order,
      designatedPlayerId: "a1",
    }),
    "a1"
  );
  assert.throws(
    () =>
      getSundayChurchYellowBallCarrier({
        holeNumber: 18,
        yellowBallOrder: order,
        designatedPlayerId: "a2",
      }),
    /score Hole 17 first/i
  );
  assert.throws(
    () =>
      getSundayChurchYellowBallCarrier({
        holeNumber: 18,
        yellowBallOrder: order,
        designatedPlayerId: "a1",
        previousDesignatedPlayerId: "a1",
      }),
    /different from Hole 17/i
  );
  assert.equal(
    getSundayChurchYellowBallCarrier({
      holeNumber: 18,
      yellowBallOrder: order,
      designatedPlayerId: "a2",
      previousDesignatedPlayerId: "a1",
    }),
    "a2"
  );
  assert.throws(
    () =>
      getSundayChurchYellowBallCarrier({
        holeNumber: 17,
        yellowBallOrder: order,
        designatedPlayerId: "a2",
        nextDesignatedPlayerId: "a2",
      }),
    /different from Hole 18/i
  );
});

test("relative handicaps make the lowest player zero and affect only yellow-ball gross", () => {
  const playing = getRelativePlayingHandicaps({ low: 6, carrier: 12, middle: 9.2 });
  const result = computeSundayChurchYellowBallHoleScore({
    yellowBallGrossScore: 4,
    scrambleGrossScore: 4,
    relativePlayingHandicap: playing.carrier,
    handicapRank: 3,
    useYellowBallHandicaps: true,
  });

  assert.equal(playing.low, 0);
  assert.deepEqual(result, {
    yellowBallGrossScore: 4,
    strokesReceived: 1,
    yellowBallNetScore: 3,
    scrambleGrossScore: 4,
    combinedScore: 7,
    handicapApplied: true,
  });
  assert.equal(result.scrambleGrossScore, 4);
  assert.equal(shouldMarkSundayChurchYellowBallHandicap(result), true);
  assert.equal(
    shouldMarkSundayChurchYellowBallHandicap(
      computeSundayChurchYellowBallHoleScore({
        yellowBallGrossScore: 4,
        scrambleGrossScore: 4,
        relativePlayingHandicap: playing.low,
        handicapRank: 1,
        useYellowBallHandicaps: true,
      })
    ),
    false
  );
});

test("yellow-ball skins use lower combined totals and two tie all tie carryovers", () => {
  const result = calculateSundayChurchYellowBallResults(
    [
      score("team-a", 1, 7),
      score("team-b", 1, 7),
      score("team-c", 1, 8),
      score("team-a", 2, 7),
      score("team-b", 2, 8),
      score("team-c", 2, 9),
      score("team-a", 3, 7),
      score("team-b", 3, 7),
      score("team-c", 3, 8),
      score("team-a", 4, 9),
      score("team-b", 4, 8),
      score("team-c", 4, 7),
    ],
    teams,
    1,
    new Decimal(180),
    courseHoles
  );

  assert.equal(result.holeResults[0].winnerTeamId, null);
  assert.equal(result.holeResults[0].isTie, true);
  assert.equal(result.holeResults[1].winnerTeamId, "team-a");
  assert.equal(result.holeResults[1].carrySkinsUsed, 2);
  assert.equal(result.holeResults[2].winnerTeamId, null);
  assert.equal(result.holeResults[3].winnerTeamId, "team-c");
  assert.equal(result.holeResults[3].carrySkinsUsed, 2);
  assert.equal(result.teamPayouts.get("team-a")?.toNumber(), 20);
  assert.equal(result.teamPayouts.get("team-c")?.toNumber(), 20);
});

test("X and BLANK cannot win and unresolved skins use lower-score tiebreaking", () => {
  const allScores = [
    score("team-a", 1, null, "X"),
    score("team-b", 1, 8),
    score("team-a", 2, 8),
    score("team-b", 2, 7),
  ];
  const result = calculateSundayChurchYellowBallResults(
    allScores,
    teams.slice(0, 2),
    1,
    new Decimal(180),
    courseHoles
  );
  assert.equal(result.holeResults[0].winnerTeamId, "team-b");

  const tiebreak = resolveSundayChurchYellowBallCarryoverTiebreaker(
    allScores,
    teams.slice(0, 2),
    courseHoles,
    2,
    new Decimal(10)
  );
  assert.equal(tiebreak.winnerTeamId, "team-b");
  assert.equal(tiebreak.decidingHoleNumber, 1);
  assert.equal(tiebreak.additionalPayouts.get("team-b")?.toNumber(), 20);
});
