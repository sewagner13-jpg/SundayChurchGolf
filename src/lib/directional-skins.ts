import type { HoleEntryType } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

import { getScoringOrder } from "@/lib/scoring-order";
import type { CourseHoleInfo, HoleResultData } from "@/lib/scoring-engine";

export type SkinComparison = "higher" | "lower";

export interface DirectionalSkinScore {
  teamId: string;
  holeNumber: number;
  entryType: HoleEntryType;
  comparisonValue: number | null;
}

function getValidValue(score: DirectionalSkinScore | undefined) {
  if (
    !score ||
    score.entryType !== "VALUE" ||
    score.comparisonValue === null ||
    !Number.isFinite(score.comparisonValue)
  ) {
    return null;
  }
  return score.comparisonValue;
}

export function determineDirectionalSkinWinner(
  scores: DirectionalSkinScore[],
  comparison: SkinComparison
): { winnerTeamId: string | null; isTie: boolean } {
  const validScores = scores
    .map((score) => ({ teamId: score.teamId, value: getValidValue(score) }))
    .filter(
      (score): score is { teamId: string; value: number } => score.value !== null
    );

  if (validScores.length === 0) return { winnerTeamId: null, isTie: true };

  const winningValue =
    comparison === "higher"
      ? Math.max(...validScores.map((score) => score.value))
      : Math.min(...validScores.map((score) => score.value));
  const winners = validScores.filter((score) => score.value === winningValue);

  return winners.length === 1
    ? { winnerTeamId: winners[0].teamId, isTie: false }
    : { winnerTeamId: null, isTie: true };
}

export function calculateDirectionalSkinResults({
  allScores,
  teams,
  startingHole,
  pot,
  getComparison,
}: {
  allScores: DirectionalSkinScore[];
  teams: { id: string; teamNumber: number }[];
  startingHole: number;
  pot: Decimal;
  getComparison: (holeNumber: number) => SkinComparison;
}): {
  holeResults: HoleResultData[];
  teamPayouts: Map<string, Decimal>;
  unresolvedCarryover: number;
} {
  const baseSkinValue = pot.div(18);
  const zeroPayout = pot.mul(0);
  const teamPayouts = new Map<string, Decimal>();
  const holeResults: HoleResultData[] = [];
  teams.forEach((team) => teamPayouts.set(team.id, zeroPayout));

  let carrySkins = 0;
  for (const holeNumber of getScoringOrder(startingHole)) {
    carrySkins += 1;
    const holeScores = allScores.filter((score) => score.holeNumber === holeNumber);
    const allTeamsScored = teams.every((team) =>
      holeScores.some(
        (score) => score.teamId === team.id && score.entryType !== "BLANK"
      )
    );

    if (!allTeamsScored) {
      carrySkins -= 1;
      holeResults.push({
        holeNumber,
        winnerTeamId: null,
        isTie: false,
        carrySkinsUsed: 0,
        holePayout: zeroPayout,
      });
      continue;
    }

    const result = determineDirectionalSkinWinner(
      holeScores,
      getComparison(holeNumber)
    );
    if (!result.winnerTeamId) {
      holeResults.push({
        holeNumber,
        winnerTeamId: null,
        isTie: result.isTie,
        carrySkinsUsed: 0,
        holePayout: zeroPayout,
      });
      continue;
    }

    const holePayout = baseSkinValue.mul(carrySkins);
    holeResults.push({
      holeNumber,
      winnerTeamId: result.winnerTeamId,
      isTie: false,
      carrySkinsUsed: carrySkins,
      holePayout,
    });
    teamPayouts.set(
      result.winnerTeamId,
      (teamPayouts.get(result.winnerTeamId) ?? zeroPayout).add(holePayout)
    );
    carrySkins = 0;
  }

  return { holeResults, teamPayouts, unresolvedCarryover: carrySkins };
}

export function resolveDirectionalSkinCarryoverTiebreaker({
  allScores,
  teams,
  courseHoles,
  unresolvedCarryover,
  baseSkinValue,
  getComparison,
}: {
  allScores: DirectionalSkinScore[];
  teams: { id: string }[];
  courseHoles: CourseHoleInfo[];
  unresolvedCarryover: number;
  baseSkinValue: Decimal;
  getComparison: (holeNumber: number) => SkinComparison;
}) {
  const zeroPayout = baseSkinValue.mul(0);
  const additionalPayouts = new Map<string, Decimal>();
  teams.forEach((team) => additionalPayouts.set(team.id, zeroPayout));

  if (unresolvedCarryover <= 0) {
    return {
      additionalPayouts,
      winnerTeamId: null,
      decidingHoleNumber: null,
      skinsWon: 0,
    };
  }

  const carryoverPayout = baseSkinValue.mul(unresolvedCarryover);
  const sortedHoles = [...courseHoles].sort(
    (left, right) => left.handicapRank - right.handicapRank
  );
  for (const hole of sortedHoles) {
    const result = determineDirectionalSkinWinner(
      allScores.filter((score) => score.holeNumber === hole.holeNumber),
      getComparison(hole.holeNumber)
    );
    if (result.winnerTeamId) {
      additionalPayouts.set(result.winnerTeamId, carryoverPayout);
      return {
        additionalPayouts,
        winnerTeamId: result.winnerTeamId,
        decidingHoleNumber: hole.holeNumber,
        skinsWon: unresolvedCarryover,
      };
    }
  }

  const splitPayout = carryoverPayout.div(teams.length);
  teams.forEach((team) => additionalPayouts.set(team.id, splitPayout));
  return {
    additionalPayouts,
    winnerTeamId: null,
    decidingHoleNumber: null,
    skinsWon: unresolvedCarryover,
  };
}
