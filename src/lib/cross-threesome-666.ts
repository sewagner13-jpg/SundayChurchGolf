import { getNetScore, getStrokesReceivedForHole } from "@/lib/handicap-scoring";

export const CROSS_THREESOME_666_FORMAT_ID = "cross_threesome_6_6_6";
export const CROSS_THREESOME_666_CONFIG_KEY = "crossThreesome666";

export type CrossThreesomeASlot = "A1" | "A2" | "A3";
export type CrossThreesomeBSlot = "B1" | "B2" | "B3";
export type CrossThreesomeGameId = "first6" | "second6" | "third6";

export interface CrossThreesome666Config {
  scoreMode: "best_net_ball";
  threesomeA: Record<CrossThreesomeASlot, string>;
  threesomeB: Record<CrossThreesomeBSlot, string>;
}

export interface CrossThreesomePair {
  virtualTeamId: string;
  label: string;
  slotLabels: [CrossThreesomeBSlot, CrossThreesomeASlot];
  playerIds: [string, string];
}

export interface CrossThreesomeGamePairings {
  id: CrossThreesomeGameId;
  label: string;
  holeNumbers: number[];
  pairs: CrossThreesomePair[];
}

export interface CrossThreesomePlayerScoreLike {
  playerId: string;
  holeNumber: number;
  grossScore: number | null;
}

export interface CrossThreesomePairHoleScore {
  virtualTeamId: string;
  label: string;
  playerIds: [string, string];
  grossScores: [number | null, number | null];
  netScores: [number | null, number | null];
  strokesReceived: [number | null, number | null];
  bestBallScore: number | null;
}

export interface CrossThreesomeHoleOutcome {
  holeNumber: number;
  isComplete: boolean;
  isTie: boolean;
  winningVirtualTeamId: string | null;
  pairScores: CrossThreesomePairHoleScore[];
}

export interface CrossThreesomePairSummary extends CrossThreesomePair {
  holesWon: number;
  payout: number;
}

export interface CrossThreesomeGameSummary {
  id: CrossThreesomeGameId;
  label: string;
  holeNumbers: number[];
  gamePot: number;
  completedHoles: number;
  pairs: CrossThreesomePairSummary[];
  winningVirtualTeamIds: string[];
  payoutPerWinningPair: number;
  holeOutcomes: CrossThreesomeHoleOutcome[];
}

const A_SLOTS = ["A1", "A2", "A3"] as const;
const B_SLOTS = ["B1", "B2", "B3"] as const;

const GAME_DEFINITIONS = [
  {
    id: "first6",
    label: "First 6",
    holeNumbers: [1, 2, 3, 4, 5, 6],
    rotation: [
      ["B1", "A1"],
      ["B2", "A3"],
      ["B3", "A2"],
    ],
  },
  {
    id: "second6",
    label: "Second 6",
    holeNumbers: [7, 8, 9, 10, 11, 12],
    rotation: [
      ["B1", "A3"],
      ["B2", "A2"],
      ["B3", "A1"],
    ],
  },
  {
    id: "third6",
    label: "Third 6",
    holeNumbers: [13, 14, 15, 16, 17, 18],
    rotation: [
      ["B1", "A2"],
      ["B2", "A1"],
      ["B3", "A3"],
    ],
  },
] as const satisfies ReadonlyArray<{
  id: CrossThreesomeGameId;
  label: string;
  holeNumbers: number[];
  rotation: ReadonlyArray<readonly [CrossThreesomeBSlot, CrossThreesomeASlot]>;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function slotValue(
  source: Record<string, unknown> | undefined,
  slot: CrossThreesomeASlot | CrossThreesomeBSlot
) {
  const value = source?.[slot];
  return typeof value === "string" ? value : "";
}

export function createDefaultCrossThreesome666Config(): {
  crossThreesome666: CrossThreesome666Config;
} {
  return {
    crossThreesome666: {
      scoreMode: "best_net_ball",
      threesomeA: { A1: "", A2: "", A3: "" },
      threesomeB: { B1: "", B2: "", B3: "" },
    },
  };
}

export function getCrossThreesome666Config(
  formatConfig: Record<string, unknown> | null | undefined
): CrossThreesome666Config {
  const rawConfig = isRecord(formatConfig?.[CROSS_THREESOME_666_CONFIG_KEY])
    ? (formatConfig?.[CROSS_THREESOME_666_CONFIG_KEY] as Record<string, unknown>)
    : {};
  const rawA = isRecord(rawConfig.threesomeA)
    ? (rawConfig.threesomeA as Record<string, unknown>)
    : {};
  const rawB = isRecord(rawConfig.threesomeB)
    ? (rawConfig.threesomeB as Record<string, unknown>)
    : {};

  return {
    scoreMode: "best_net_ball",
    threesomeA: {
      A1: slotValue(rawA, "A1"),
      A2: slotValue(rawA, "A2"),
      A3: slotValue(rawA, "A3"),
    },
    threesomeB: {
      B1: slotValue(rawB, "B1"),
      B2: slotValue(rawB, "B2"),
      B3: slotValue(rawB, "B3"),
    },
  };
}

export function validateCrossThreesome666Config(
  formatConfig: Record<string, unknown> | null | undefined,
  selectedPlayerIds?: string[]
) {
  const rawConfig = isRecord(formatConfig?.[CROSS_THREESOME_666_CONFIG_KEY])
    ? (formatConfig?.[CROSS_THREESOME_666_CONFIG_KEY] as Record<string, unknown>)
    : null;
  const errors: string[] = [];

  if (!rawConfig) return ["Cross-Threesome 6-6-6 setup is missing."];
  if (rawConfig.scoreMode !== undefined && rawConfig.scoreMode !== "best_net_ball") {
    errors.push("Cross-Threesome 6-6-6 uses net best ball scoring.");
  }
  if (selectedPlayerIds && selectedPlayerIds.length !== 6) {
    errors.push("Cross-Threesome 6-6-6 requires exactly 6 selected players.");
  }

  const config = getCrossThreesome666Config(formatConfig);
  const assignedPlayerIds = [...A_SLOTS, ...B_SLOTS]
    .map((slot) =>
      slot.startsWith("A")
        ? config.threesomeA[slot as CrossThreesomeASlot]
        : config.threesomeB[slot as CrossThreesomeBSlot]
    )
    .filter(Boolean);

  for (const slot of A_SLOTS) {
    if (!config.threesomeA[slot]) errors.push(`Assign a player to ${slot}.`);
  }
  for (const slot of B_SLOTS) {
    if (!config.threesomeB[slot]) errors.push(`Assign a player to ${slot}.`);
  }
  if (assignedPlayerIds.length !== 6) {
    errors.push("Cross-Threesome 6-6-6 requires exactly 6 assigned players.");
  }
  if (new Set(assignedPlayerIds).size !== assignedPlayerIds.length) {
    errors.push("Each player can be assigned once across Threesome A and Threesome B.");
  }
  if (selectedPlayerIds) {
    const selected = new Set(selectedPlayerIds);
    if (assignedPlayerIds.some((playerId) => !selected.has(playerId))) {
      errors.push("Every Cross-Threesome slot must use a selected round player.");
    }
  }

  return [...new Set(errors)];
}

export function getCrossThreesome666Pairings(
  formatConfig: Record<string, unknown> | null | undefined
): CrossThreesomeGamePairings[] {
  const config = getCrossThreesome666Config(formatConfig);

  return GAME_DEFINITIONS.map((game) => ({
    id: game.id,
    label: game.label,
    holeNumbers: [...game.holeNumbers],
    pairs: game.rotation.map(([bSlot, aSlot]) => ({
      virtualTeamId: `${game.id}-${bSlot}-${aSlot}`,
      label: `${bSlot}/${aSlot}`,
      slotLabels: [bSlot, aSlot],
      playerIds: [config.threesomeB[bSlot], config.threesomeA[aSlot]],
    })),
  }));
}

function getScoreByPlayerAndHole(playerScores: CrossThreesomePlayerScoreLike[]) {
  return new Map(
    playerScores.map((playerScore) => [
      `${playerScore.playerId}:${playerScore.holeNumber}`,
      playerScore.grossScore,
    ])
  );
}

function computeBestBallScore(scores: [number | null, number | null]) {
  const validScores = scores.filter((score): score is number => score !== null);
  return validScores.length > 0 ? Math.min(...validScores) : null;
}

function computeHoleOutcome(
  holeNumber: number,
  pairs: CrossThreesomePair[],
  scoresByPlayerAndHole: Map<string, number | null>,
  playerHandicapIndexes: Record<string, number | null | undefined>,
  courseHandicapRanks: Record<number, number>
): CrossThreesomeHoleOutcome {
  const pairScores = pairs.map((pair) => {
    const grossScores = pair.playerIds.map(
      (playerId) => scoresByPlayerAndHole.get(`${playerId}:${holeNumber}`) ?? null
    ) as [number | null, number | null];
    const strokesReceived = pair.playerIds.map((playerId) =>
      getStrokesReceivedForHole(
        playerHandicapIndexes[playerId],
        courseHandicapRanks[holeNumber]
      )
    ) as [number | null, number | null];
    const netScores = pair.playerIds.map((playerId, index) =>
      getNetScore({
        grossScore: grossScores[index],
        handicapIndex: playerHandicapIndexes[playerId],
        handicapRank: courseHandicapRanks[holeNumber],
      })
    ) as [number | null, number | null];

    return {
      virtualTeamId: pair.virtualTeamId,
      label: pair.label,
      playerIds: pair.playerIds,
      grossScores,
      netScores,
      strokesReceived,
      bestBallScore: computeBestBallScore(netScores),
    };
  });

  const isComplete = pairScores.every((pairScore) => pairScore.bestBallScore !== null);
  if (!isComplete) {
    return { holeNumber, isComplete: false, isTie: false, winningVirtualTeamId: null, pairScores };
  }

  const bestScore = Math.min(...pairScores.map((pairScore) => pairScore.bestBallScore as number));
  const winners = pairScores.filter((pairScore) => pairScore.bestBallScore === bestScore);
  return {
    holeNumber,
    isComplete: true,
    isTie: winners.length !== 1,
    winningVirtualTeamId: winners.length === 1 ? winners[0].virtualTeamId : null,
    pairScores,
  };
}

export function computeCrossThreesome666GameSummaries({
  formatConfig,
  playerScores,
  playerHandicapIndexes,
  courseHandicapRanks,
  totalPot = 0,
}: {
  formatConfig: Record<string, unknown> | null | undefined;
  playerScores: CrossThreesomePlayerScoreLike[];
  playerHandicapIndexes: Record<string, number | null | undefined>;
  courseHandicapRanks: Record<number, number>;
  totalPot?: number;
}): CrossThreesomeGameSummary[] {
  const pairings = getCrossThreesome666Pairings(formatConfig);
  const scoresByPlayerAndHole = getScoreByPlayerAndHole(playerScores);
  const gamePot = totalPot / GAME_DEFINITIONS.length;

  return pairings.map((game) => {
    const holeOutcomes = game.holeNumbers.map((holeNumber) =>
      computeHoleOutcome(
        holeNumber,
        game.pairs,
        scoresByPlayerAndHole,
        playerHandicapIndexes,
        courseHandicapRanks
      )
    );
    const completedHoles = holeOutcomes.filter((outcome) => outcome.isComplete).length;
    const holeWins = new Map<string, number>(game.pairs.map((pair) => [pair.virtualTeamId, 0]));

    for (const outcome of holeOutcomes) {
      if (outcome.winningVirtualTeamId && !outcome.isTie) {
        holeWins.set(
          outcome.winningVirtualTeamId,
          (holeWins.get(outcome.winningVirtualTeamId) ?? 0) + 1
        );
      }
    }

    const maxWins = Math.max(...game.pairs.map((pair) => holeWins.get(pair.virtualTeamId) ?? 0));
    const winningVirtualTeamIds = game.pairs
      .filter((pair) => (holeWins.get(pair.virtualTeamId) ?? 0) === maxWins)
      .map((pair) => pair.virtualTeamId);
    const payoutPerWinningPair = gamePot / winningVirtualTeamIds.length;

    return {
      id: game.id,
      label: game.label,
      holeNumbers: game.holeNumbers,
      gamePot,
      completedHoles,
      pairs: game.pairs.map((pair) => ({
        ...pair,
        holesWon: holeWins.get(pair.virtualTeamId) ?? 0,
        payout: winningVirtualTeamIds.includes(pair.virtualTeamId)
          ? payoutPerWinningPair
          : 0,
      })),
      winningVirtualTeamIds,
      payoutPerWinningPair,
      holeOutcomes,
    };
  });
}

export function calculateCrossThreesome666PlayerPayouts(
  summaries: CrossThreesomeGameSummary[]
) {
  const payouts = new Map<string, number>();

  for (const summary of summaries) {
    for (const pair of summary.pairs) {
      if (pair.payout <= 0) continue;
      const playerShare = pair.payout / pair.playerIds.length;
      for (const playerId of pair.playerIds) {
        payouts.set(playerId, (payouts.get(playerId) ?? 0) + playerShare);
      }
    }
  }

  return payouts;
}
