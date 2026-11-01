import { conservePayoutCents } from "@/lib/payout-cents";
import { readCrossFoursomePartnerOrder } from "@/lib/cross-foursome-partner-draw";
export const CROSS_FOURSOME_66618_FORMAT_ID = "cross_foursome_6_6_6_18";
export const CROSS_FOURSOME_66618_CONFIG_KEY = "crossFoursome66618";
import {
  getNetScore,
  getPlayingHandicaps,
  getStrokesReceivedForHole,
} from "@/lib/handicap-scoring";
import type {
  CrossFoursomeScoreMode,
  CrossFoursomeASlot,
  CrossFoursomeBSlot,
  CrossFoursomeGameId,
  CrossFoursome66618Config,
  CrossFoursomePair,
  CrossFoursomeGamePairings,
  CrossFoursomePlayerScoreLike,
  CrossFoursomeHoleOutcome,
  CrossFoursomeGameSummary
} from "@/lib/cross-foursome-types";
export type * from "@/lib/cross-foursome-types";

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

  const scoreMode =
    rawConfig.scoreMode === "best_net_ball" ? "best_net_ball" : "best_ball";

  return {
    scoreMode,
    ...(rawConfig.handicapModeConfirmed === false ? {handicapModeConfirmed: false} : {}),
    ...(rawConfig.partnerDrawRequired === true ? {partnerDrawRequired: true} : {}),
    ...(readCrossFoursomePartnerOrder(rawConfig.partnerOrder) ? {partnerOrder: readCrossFoursomePartnerOrder(rawConfig.partnerOrder)} : {}),
    handicapMode: rawConfig.handicapMode === "full" ? "full" : "relative",
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

  if (
    rawConfig.scoreMode !== undefined &&
    rawConfig.scoreMode !== "best_ball" &&
    rawConfig.scoreMode !== "best_net_ball"
  ) {
    errors.push("Cross-Foursome 6-6-6-18 only supports gross or net best ball scoring.");
  }

  if (rawConfig.partnerOrder !== undefined && !readCrossFoursomePartnerOrder(rawConfig.partnerOrder)) errors.push("Invalid cross-cart partner draw.");

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

export function getCrossFoursome66618StartConfig(
  formatConfig: Record<string, unknown> | null | undefined,
  handicaps: Array<number | null | undefined>
): CrossFoursome66618Config {
  const config = getCrossFoursome66618Config(formatConfig);
  if (config.scoreMode === "best_net_ball" &&
      handicaps.some((handicap) => handicap == null || !Number.isFinite(handicap))) {
    throw new Error("Every Cross-Foursome player needs a valid handicap before starting net best ball");
  }
  if (config.scoreMode === "best_net_ball" && config.handicapModeConfirmed === false) throw new Error("Choose a handicap method before starting the round");
  if (config.partnerDrawRequired && !config.partnerOrder) throw new Error("Draw cross-cart partners before starting the round");
  return config;
}

export function assertCrossFoursome66618LiveConfigChange(
  round: { formatId: string; formatConfig: unknown },
  nextConfig: Record<string, unknown> | undefined
) {
  if (round.formatId !== CROSS_FOURSOME_66618_FORMAT_ID || nextConfig === undefined) return;
  const current = getCrossFoursome66618Config(round.formatConfig as Record<string, unknown> | null);
  const next = getCrossFoursome66618Config(nextConfig);
  if (current.scoreMode !== next.scoreMode || current.handicapMode !== next.handicapMode || JSON.stringify([current.partnerOrder, current.foursomeA, current.foursomeB]) !== JSON.stringify([next.partnerOrder, next.foursomeA, next.foursomeB])) {
    throw new Error("Choose Cross-Foursome scoring, handicap method, and partner draw before starting the round");
  }
}

export function getCrossFoursome66618Pairings(
  formatConfig: Record<string, unknown> | null | undefined
): CrossFoursomeGamePairings[] {
  const config = getCrossFoursome66618Config(formatConfig);

  return GAME_DEFINITIONS.map((game) => ({
    id: game.id,
    label: game.label,
    holeNumbers: [...game.holeNumbers],
    pairs: game.rotation.map(([bSlot, originalASlot]) => {
      const aSlot = config.partnerOrder?.[A_SLOTS.indexOf(originalASlot)] ?? originalASlot;
      return ({
      virtualTeamId: `${game.id}-${bSlot}-${aSlot}`,
      label: `${bSlot}/${aSlot}`,
      slotLabels: [bSlot, aSlot],
      playerIds: [config.foursomeB[bSlot], config.foursomeA[aSlot]],
    }); }),
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
  scoresByPlayerAndHole: Map<string, number | null>,
  scoreMode: CrossFoursomeScoreMode,
  playerHandicapIndexes: Record<string, number | null | undefined>,
  courseHandicapRanks: Record<number, number>
): CrossFoursomeHoleOutcome {
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
    const scores = scoreMode === "best_net_ball" ? netScores : grossScores;
    return {
      virtualTeamId: pair.virtualTeamId,
      label: pair.label,
      playerIds: pair.playerIds,
      grossScores,
      netScores,
      strokesReceived,
      bestBallScore: computeBestBallScore(scores),
    };
  });

  // A partial pair can show a provisional best ball, but the missing partner
  // may still improve it. Never award a hole until both carts have scored.
  const isComplete = pairScores.every((pairScore) =>
    (scoreMode === "best_net_ball" ? pairScore.netScores : pairScore.grossScores)
      .every((score) => score !== null && Number.isFinite(score))
  );
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
  playerHandicapIndexes = {},
  courseHandicapRanks = {},
  totalPot = 0,
}: {
  formatConfig: Record<string, unknown> | null | undefined;
  playerScores: CrossFoursomePlayerScoreLike[];
  playerHandicapIndexes?: Record<string, number | null | undefined>;
  courseHandicapRanks?: Record<number, number>;
  totalPot?: number;
}): CrossFoursomeGameSummary[] {
  const config = getCrossFoursome66618Config(formatConfig);
  const pairings = getCrossFoursome66618Pairings(formatConfig);
  const scoresByPlayerAndHole = getScoreByPlayerAndHole(playerScores);
  const relativePlayingHandicaps = getPlayingHandicaps(playerHandicapIndexes, config.handicapMode);
  const gamePot = totalPot / GAME_DEFINITIONS.length;

  return pairings.map((game) => {
    const holeOutcomes = game.holeNumbers.map((holeNumber) =>
      computeHoleOutcome(
        holeNumber,
        game.pairs,
        scoresByPlayerAndHole,
        config.scoreMode,
        relativePlayingHandicaps,
        courseHandicapRanks
      )
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
    const winningVirtualTeamIds = completedHoles === 0 ? [] : game.pairs
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

  return conservePayoutCents(payouts);
}


export function createNewCrossFoursome66618Config() {
  return {crossFoursome66618: {...createDefaultCrossFoursome66618Config().crossFoursome66618,
    scoreMode: "best_net_ball" as const, handicapModeConfirmed: false, partnerDrawRequired: true}};
}
