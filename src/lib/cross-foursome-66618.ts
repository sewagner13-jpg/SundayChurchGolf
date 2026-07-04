export const CROSS_FOURSOME_66618_FORMAT_ID = "cross_foursome_6_6_6_18";

export const CROSS_FOURSOME_66618_CONFIG_KEY = "crossFoursome66618";

export type CrossFoursomeScoreMode = "best_ball";
export type CrossFoursomeASlot = "A1" | "A2" | "A3" | "A4";
export type CrossFoursomeBSlot = "B1" | "B2" | "B3" | "B4";
export type CrossFoursomeGameId =
  | "first6"
  | "second6"
  | "third6"
  | "overall18";

export interface CrossFoursome66618Config {
  scoreMode: CrossFoursomeScoreMode;
  foursomeA: Record<CrossFoursomeASlot, string>;
  foursomeB: Record<CrossFoursomeBSlot, string>;
}

export interface CrossFoursomePair {
  virtualTeamId: string;
  label: string;
  slotLabels: [CrossFoursomeBSlot, CrossFoursomeASlot];
  playerIds: [string, string];
}

export interface CrossFoursomeGamePairings {
  id: CrossFoursomeGameId;
  label: string;
  holeNumbers: number[];
  pairs: CrossFoursomePair[];
}

export interface CrossFoursomePlayerScoreLike {
  playerId: string;
  holeNumber: number;
  grossScore: number | null;
}

export interface CrossFoursomePairHoleScore {
  virtualTeamId: string;
  label: string;
  playerIds: [string, string];
  grossScores: [number | null, number | null];
  bestBallScore: number | null;
}

export interface CrossFoursomeHoleOutcome {
  holeNumber: number;
  isComplete: boolean;
  isTie: boolean;
  winningVirtualTeamId: string | null;
  pairScores: CrossFoursomePairHoleScore[];
}

export interface CrossFoursomePairSummary extends CrossFoursomePair {
  holesWon: number;
  payout: number;
}

export interface CrossFoursomeGameSummary {
  id: CrossFoursomeGameId;
  label: string;
  holeNumbers: number[];
  gamePot: number;
  completedHoles: number;
  pairs: CrossFoursomePairSummary[];
  winningVirtualTeamIds: string[];
  payoutPerWinningPair: number;
  holeOutcomes: CrossFoursomeHoleOutcome[];
}

const A_SLOTS = ["A1", "A2", "A3", "A4"] as const;
const B_SLOTS = ["B1", "B2", "B3", "B4"] as const;

const GAME_DEFINITIONS = [
  {
    id: "first6",
    label: "First 6",
    holeNumbers: [1, 2, 3, 4, 5, 6],
    rotation: [
      ["B1", "A1"],
      ["B2", "A4"],
      ["B3", "A3"],
      ["B4", "A2"],
    ],
  },
  {
    id: "second6",
    label: "Second 6",
    holeNumbers: [7, 8, 9, 10, 11, 12],
    rotation: [
      ["B1", "A4"],
      ["B2", "A3"],
      ["B3", "A2"],
      ["B4", "A1"],
    ],
  },
  {
    id: "third6",
    label: "Third 6",
    holeNumbers: [13, 14, 15, 16, 17, 18],
    rotation: [
      ["B1", "A3"],
      ["B2", "A2"],
      ["B3", "A1"],
      ["B4", "A4"],
    ],
  },
  {
    id: "overall18",
    label: "Overall 18",
    holeNumbers: Array.from({ length: 18 }, (_, index) => index + 1),
    rotation: [
      ["B1", "A2"],
      ["B2", "A1"],
      ["B3", "A4"],
      ["B4", "A3"],
    ],
  },
] as const satisfies ReadonlyArray<{
  id: CrossFoursomeGameId;
  label: string;
  holeNumbers: number[];
  rotation: ReadonlyArray<readonly [CrossFoursomeBSlot, CrossFoursomeASlot]>;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function slotValue(
  source: Record<string, unknown> | undefined,
  slot: CrossFoursomeASlot | CrossFoursomeBSlot
) {
  const value = source?.[slot];
  return typeof value === "string" ? value : "";
}

export function createDefaultCrossFoursome66618Config(): {
  crossFoursome66618: CrossFoursome66618Config;
} {
  return {
    crossFoursome66618: {
      scoreMode: "best_ball",
      foursomeA: {
        A1: "",
        A2: "",
        A3: "",
        A4: "",
      },
      foursomeB: {
        B1: "",
        B2: "",
        B3: "",
        B4: "",
      },
    },
  };
}

export function getCrossFoursome66618Config(
  formatConfig: Record<string, unknown> | null | undefined
): CrossFoursome66618Config {
  const rawConfig = isRecord(formatConfig?.[CROSS_FOURSOME_66618_CONFIG_KEY])
    ? (formatConfig?.[CROSS_FOURSOME_66618_CONFIG_KEY] as Record<string, unknown>)
    : {};
  const rawA = isRecord(rawConfig.foursomeA)
    ? (rawConfig.foursomeA as Record<string, unknown>)
    : {};
  const rawB = isRecord(rawConfig.foursomeB)
    ? (rawConfig.foursomeB as Record<string, unknown>)
    : {};

  return {
    scoreMode: "best_ball",
    foursomeA: {
      A1: slotValue(rawA, "A1"),
      A2: slotValue(rawA, "A2"),
      A3: slotValue(rawA, "A3"),
      A4: slotValue(rawA, "A4"),
    },
    foursomeB: {
      B1: slotValue(rawB, "B1"),
      B2: slotValue(rawB, "B2"),
      B3: slotValue(rawB, "B3"),
      B4: slotValue(rawB, "B4"),
    },
  };
}

export function validateCrossFoursome66618Config(
  formatConfig: Record<string, unknown> | null | undefined,
  selectedPlayerIds?: string[]
): string[] {
  const rawConfig = isRecord(formatConfig?.[CROSS_FOURSOME_66618_CONFIG_KEY])
    ? (formatConfig?.[CROSS_FOURSOME_66618_CONFIG_KEY] as Record<string, unknown>)
    : null;
  const errors: string[] = [];

  if (!rawConfig) {
    return ["Cross-Foursome 6-6-6-18 setup is missing."];
  }

  if (rawConfig.scoreMode !== undefined && rawConfig.scoreMode !== "best_ball") {
    errors.push("Cross-Foursome 6-6-6-18 only supports best ball scoring.");
  }

  if (selectedPlayerIds && selectedPlayerIds.length !== 8) {
    errors.push("Cross-Foursome 6-6-6-18 requires exactly 8 selected players.");
  }

  const config = getCrossFoursome66618Config(formatConfig);
  const assignedPlayerIds: string[] = [];

  for (const slot of A_SLOTS) {
    const playerId = config.foursomeA[slot];
    if (!playerId) {
      errors.push(`Assign a player to ${slot}.`);
    } else {
      assignedPlayerIds.push(playerId);
    }
  }

  for (const slot of B_SLOTS) {
    const playerId = config.foursomeB[slot];
    if (!playerId) {
      errors.push(`Assign a player to ${slot}.`);
    } else {
      assignedPlayerIds.push(playerId);
    }
  }

  if (assignedPlayerIds.length !== 8) {
    errors.push("Cross-Foursome 6-6-6-18 requires exactly 8 assigned players.");
  }

  const uniqueAssigned = new Set(assignedPlayerIds);
  if (uniqueAssigned.size !== assignedPlayerIds.length) {
    errors.push("Each player can be assigned once across Foursome A and Foursome B.");
  }

  if (selectedPlayerIds) {
    const selected = new Set(selectedPlayerIds);
    if (assignedPlayerIds.some((playerId) => !selected.has(playerId))) {
      errors.push("Every Cross-Foursome slot must use a selected round player.");
    }
  }

  return [...new Set(errors)];
}

export function getCrossFoursome66618Pairings(
  formatConfig: Record<string, unknown> | null | undefined
): CrossFoursomeGamePairings[] {
  const config = getCrossFoursome66618Config(formatConfig);

  return GAME_DEFINITIONS.map((game) => ({
    id: game.id,
    label: game.label,
    holeNumbers: [...game.holeNumbers],
    pairs: game.rotation.map(([bSlot, aSlot]) => ({
      virtualTeamId: `${game.id}-${bSlot}-${aSlot}`,
      label: `${bSlot}/${aSlot}`,
      slotLabels: [bSlot, aSlot],
      playerIds: [config.foursomeB[bSlot], config.foursomeA[aSlot]],
    })),
  }));
}

function getScoreByPlayerAndHole(
  playerScores: CrossFoursomePlayerScoreLike[]
) {
  const scores = new Map<string, number | null>();
  for (const playerScore of playerScores) {
    scores.set(
      `${playerScore.playerId}:${playerScore.holeNumber}`,
      playerScore.grossScore
    );
  }
  return scores;
}

function computeBestBallScore(scores: [number | null, number | null]) {
  const validScores = scores.filter((score): score is number => score !== null);
  if (validScores.length === 0) return null;
  return Math.min(...validScores);
}

function computeHoleOutcome(
  holeNumber: number,
  pairs: CrossFoursomePair[],
  scoresByPlayerAndHole: Map<string, number | null>
): CrossFoursomeHoleOutcome {
  const pairScores = pairs.map((pair) => {
    const grossScores = pair.playerIds.map(
      (playerId) => scoresByPlayerAndHole.get(`${playerId}:${holeNumber}`) ?? null
    ) as [number | null, number | null];
    return {
      virtualTeamId: pair.virtualTeamId,
      label: pair.label,
      playerIds: pair.playerIds,
      grossScores,
      bestBallScore: computeBestBallScore(grossScores),
    };
  });

  const isComplete = pairScores.every((pairScore) => pairScore.bestBallScore !== null);
  if (!isComplete) {
    return {
      holeNumber,
      isComplete: false,
      isTie: false,
      winningVirtualTeamId: null,
      pairScores,
    };
  }

  const bestScore = Math.min(
    ...pairScores.map((pairScore) => pairScore.bestBallScore as number)
  );
  const winners = pairScores.filter(
    (pairScore) => pairScore.bestBallScore === bestScore
  );

  return {
    holeNumber,
    isComplete: true,
    isTie: winners.length !== 1,
    winningVirtualTeamId: winners.length === 1 ? winners[0].virtualTeamId : null,
    pairScores,
  };
}

export function computeCrossFoursome66618GameSummaries({
  formatConfig,
  playerScores,
  totalPot = 0,
}: {
  formatConfig: Record<string, unknown> | null | undefined;
  playerScores: CrossFoursomePlayerScoreLike[];
  totalPot?: number;
}): CrossFoursomeGameSummary[] {
  const pairings = getCrossFoursome66618Pairings(formatConfig);
  const scoresByPlayerAndHole = getScoreByPlayerAndHole(playerScores);
  const gamePot = totalPot / GAME_DEFINITIONS.length;

  return pairings.map((game) => {
    const holeOutcomes = game.holeNumbers.map((holeNumber) =>
      computeHoleOutcome(holeNumber, game.pairs, scoresByPlayerAndHole)
    );
    const completedHoles = holeOutcomes.filter((outcome) => outcome.isComplete).length;
    const holeWins = new Map<string, number>(
      game.pairs.map((pair) => [pair.virtualTeamId, 0])
    );

    for (const outcome of holeOutcomes) {
      if (!outcome.isComplete || outcome.isTie || !outcome.winningVirtualTeamId) {
        continue;
      }
      holeWins.set(
        outcome.winningVirtualTeamId,
        (holeWins.get(outcome.winningVirtualTeamId) ?? 0) + 1
      );
    }

    const maxWins = Math.max(...game.pairs.map((pair) => holeWins.get(pair.virtualTeamId) ?? 0));
    const winningVirtualTeamIds = game.pairs
      .filter((pair) => (holeWins.get(pair.virtualTeamId) ?? 0) === maxWins)
      .map((pair) => pair.virtualTeamId);
    const payoutPerWinningPair =
      winningVirtualTeamIds.length > 0 ? gamePot / winningVirtualTeamIds.length : 0;

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

export function calculateCrossFoursome66618PlayerPayouts(
  summaries: CrossFoursomeGameSummary[]
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
