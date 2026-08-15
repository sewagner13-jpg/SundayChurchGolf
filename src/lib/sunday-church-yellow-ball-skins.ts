import type { HoleEntryType } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

import {
  calculateDirectionalSkinResults,
  resolveDirectionalSkinCarryoverTiebreaker,
  type DirectionalSkinScore,
} from "@/lib/directional-skins";
import {
  getRelativePlayingHandicaps,
  getStrokesReceivedForHole,
} from "@/lib/handicap-scoring";
import type { CourseHoleInfo } from "@/lib/scoring-engine";

export const SUNDAY_CHURCH_YELLOW_BALL_SKINS_FORMAT_ID =
  "sunday_church_yellow_ball_skins";

export interface SundayChurchYellowBallConfig {
  useYellowBallHandicaps: boolean;
}

export interface SundayChurchYellowBallTeamConfig {
  yellowBallOrder: string[];
}

export interface SundayChurchYellowBallHoleInput {
  yellowBallGrossScore: number;
  scrambleGrossScore: number;
  designatedPlayerId?: string;
}

export interface SundayChurchYellowBallHoleData {
  designatedPlayerId: string;
  yellowBallGrossScore: number;
  strokesReceived: number;
  yellowBallNetScore: number;
  scrambleGrossScore: number;
  combinedScore: number;
  handicapApplied: boolean;
}

export interface SundayChurchYellowBallScore {
  teamId: string;
  holeNumber: number;
  entryType: HoleEntryType;
  value: number | null;
}

function isValidGrossScore(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 25;
}

export function validateSundayChurchYellowBallHoleInput(input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return ["Enter the yellow-ball gross score and scramble gross score."];
  }
  const record = input as Record<string, unknown>;
  const derivedFields = [
    "strokesReceived",
    "yellowBallNetScore",
    "combinedScore",
    "handicapApplied",
  ];
  if (derivedFields.some((field) => field in record)) {
    return ["Derived scoring fields must be calculated by the server."];
  }

  const errors: string[] = [];
  if (!isValidGrossScore(record.yellowBallGrossScore as number)) {
    errors.push("Enter a valid yellow-ball gross score from 1 through 25.");
  }
  if (!isValidGrossScore(record.scrambleGrossScore as number)) {
    errors.push("Enter a valid scramble gross score from 1 through 25.");
  }
  if (
    record.designatedPlayerId !== undefined &&
    typeof record.designatedPlayerId !== "string"
  ) {
    errors.push("Choose a valid yellow-ball player.");
  }
  return errors;
}

export function getSundayChurchYellowBallConfig(
  formatConfig: Record<string, unknown> | null | undefined
): SundayChurchYellowBallConfig {
  return {
    useYellowBallHandicaps: formatConfig?.useYellowBallHandicaps !== false,
  };
}

export function getSundayChurchYellowBallTeamConfig(
  formatConfig: unknown
): SundayChurchYellowBallTeamConfig {
  if (!formatConfig || typeof formatConfig !== "object" || Array.isArray(formatConfig)) {
    return { yellowBallOrder: [] };
  }
  const order = (formatConfig as Record<string, unknown>).yellowBallOrder;
  return {
    yellowBallOrder: Array.isArray(order)
      ? order.filter((playerId): playerId is string => typeof playerId === "string")
      : [],
  };
}

export function validateSundayChurchYellowBallSetup({
  teams,
  playerHandicapIndexes,
  useYellowBallHandicaps,
}: {
  teams: Array<{ id: string; playerIds: string[] }>;
  playerHandicapIndexes: Record<string, number | null | undefined>;
  useYellowBallHandicaps: boolean;
}): string[] {
  const errors: string[] = [];
  if (teams.length < 2) errors.push("Sunday Church Yellow Ball Skins requires at least two teams.");

  const allPlayerIds = teams.flatMap((team) => team.playerIds);
  for (const team of teams) {
    if (team.playerIds.length !== 4) {
      errors.push(`Each team must contain exactly four players; ${team.id} does not.`);
    }
    if (new Set(team.playerIds).size !== team.playerIds.length) {
      errors.push(`Every player on ${team.id} must be unique.`);
    }
  }
  if (new Set(allPlayerIds).size !== allPlayerIds.length) {
    errors.push("A player cannot belong to more than one team.");
  }

  if (useYellowBallHandicaps) {
    const missing = allPlayerIds.filter(
      (playerId) => playerHandicapIndexes[playerId] === null || playerHandicapIndexes[playerId] === undefined
    );
    if (missing.length > 0) {
      errors.push(`${missing.length} selected player${missing.length === 1 ? " is" : "s are"} missing a handicap.`);
    }
  }
  return errors;
}

export function validateSundayChurchYellowBallOrder(
  yellowBallOrder: string[],
  teamPlayerIds: string[]
): string[] {
  const errors: string[] = [];
  if (yellowBallOrder.length !== 4) errors.push("Choose exactly four players for the yellow-ball order.");
  if (new Set(yellowBallOrder).size !== yellowBallOrder.length) {
    errors.push("The yellow-ball order must use four unique players.");
  }
  const roster = new Set(teamPlayerIds);
  if (yellowBallOrder.some((playerId) => !roster.has(playerId))) {
    errors.push("Every player in the yellow-ball order must be on the team roster.");
  }
  return errors;
}

export function getSundayChurchYellowBallCarrier({
  holeNumber,
  yellowBallOrder,
  designatedPlayerId,
  previousDesignatedPlayerId,
  nextDesignatedPlayerId,
}: {
  holeNumber: number;
  yellowBallOrder: string[];
  designatedPlayerId?: string;
  previousDesignatedPlayerId?: string | null;
  nextDesignatedPlayerId?: string | null;
}) {
  const orderErrors = validateSundayChurchYellowBallOrder(
    yellowBallOrder,
    yellowBallOrder
  );
  if (orderErrors.length > 0) throw new Error(orderErrors[0]);
  if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18) {
    throw new Error("Hole number must be between 1 and 18.");
  }
  if (holeNumber <= 16) return yellowBallOrder[(holeNumber - 1) % 4];
  if (!designatedPlayerId || !yellowBallOrder.includes(designatedPlayerId)) {
    throw new Error(`Choose a yellow-ball player from this team for Hole ${holeNumber}.`);
  }
  if (holeNumber === 18 && !previousDesignatedPlayerId) {
    throw new Error("Score Hole 17 first, then choose the Hole 18 yellow-ball player.");
  }
  if (holeNumber === 18 && designatedPlayerId === previousDesignatedPlayerId) {
    throw new Error("The Hole 18 yellow-ball player must be different from Hole 17.");
  }
  if (holeNumber === 17 && designatedPlayerId === nextDesignatedPlayerId) {
    throw new Error("The Hole 17 yellow-ball player must be different from Hole 18.");
  }
  return designatedPlayerId;
}

export function computeSundayChurchYellowBallHoleScore({
  yellowBallGrossScore,
  scrambleGrossScore,
  relativePlayingHandicap,
  handicapRank,
  useYellowBallHandicaps,
}: {
  yellowBallGrossScore: number;
  scrambleGrossScore: number;
  relativePlayingHandicap: number | null | undefined;
  handicapRank: number | null | undefined;
  useYellowBallHandicaps: boolean;
}): Omit<SundayChurchYellowBallHoleData, "designatedPlayerId"> {
  if (!isValidGrossScore(yellowBallGrossScore) || !isValidGrossScore(scrambleGrossScore)) {
    throw new Error("Enter valid gross scores from 1 through 25.");
  }

  const strokesReceived = useYellowBallHandicaps
    ? getStrokesReceivedForHole(relativePlayingHandicap, handicapRank)
    : 0;
  if (strokesReceived === null) {
    throw new Error("Yellow-ball handicap scoring is unavailable for this player or hole.");
  }
  const yellowBallNetScore = yellowBallGrossScore - strokesReceived;
  return {
    yellowBallGrossScore,
    strokesReceived,
    yellowBallNetScore,
    scrambleGrossScore,
    combinedScore: yellowBallNetScore + scrambleGrossScore,
    handicapApplied: strokesReceived > 0,
  };
}

export function computeSundayChurchYellowBallHoleData({
  designatedPlayerId,
  playerHandicapIndexes,
  ...input
}: SundayChurchYellowBallHoleInput & {
  designatedPlayerId: string;
  playerHandicapIndexes: Record<string, number | null | undefined>;
  handicapRank: number;
  useYellowBallHandicaps: boolean;
}): SundayChurchYellowBallHoleData {
  const relativePlayingHandicaps = getRelativePlayingHandicaps(playerHandicapIndexes);
  return {
    designatedPlayerId,
    ...computeSundayChurchYellowBallHoleScore({
      ...input,
      relativePlayingHandicap: relativePlayingHandicaps[designatedPlayerId],
    }),
  };
}

export function shouldMarkSundayChurchYellowBallHandicap(
  holeData: Pick<SundayChurchYellowBallHoleData, "strokesReceived">
) {
  return holeData.strokesReceived > 0;
}

function toDirectionalScores(scores: SundayChurchYellowBallScore[]): DirectionalSkinScore[] {
  return scores.map((score) => ({
    teamId: score.teamId,
    holeNumber: score.holeNumber,
    entryType: score.entryType,
    comparisonValue: score.value,
  }));
}

export function calculateSundayChurchYellowBallResults(
  allScores: SundayChurchYellowBallScore[],
  teams: { id: string; teamNumber: number }[],
  startingHole: number,
  pot: Decimal,
  courseHoles: CourseHoleInfo[]
) {
  void courseHoles;
  return calculateDirectionalSkinResults({
    allScores: toDirectionalScores(allScores),
    teams,
    startingHole,
    pot,
    getComparison: () => "lower",
  });
}

export function resolveSundayChurchYellowBallCarryoverTiebreaker(
  allScores: SundayChurchYellowBallScore[],
  teams: { id: string }[],
  courseHoles: CourseHoleInfo[],
  unresolvedCarryover: number,
  baseSkinValue: Decimal
) {
  return resolveDirectionalSkinCarryoverTiebreaker({
    allScores: toDirectionalScores(allScores),
    teams,
    courseHoles,
    unresolvedCarryover,
    baseSkinValue,
    getComparison: () => "lower",
  });
}
