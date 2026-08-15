import type { HoleEntryType } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

import {
  determineDirectionalSkinWinner,
  type DirectionalSkinScore,
} from "@/lib/directional-skins";
import { getFormatById } from "@/lib/format-definitions";
import {
  calculateRoundResults,
  resolveCarryoverTiebreaker,
  type CourseHoleInfo,
  type TeamScore,
} from "@/lib/scoring-engine";
import {
  SUNDAY_CHURCH_HOLE_GAMES_FORMAT_ID,
  calculateSundayChurchHoleGameResults,
  computeSundayChurchHoleGameOutcomes,
  resolveSundayChurchHoleGameCarryoverTiebreaker,
  toSundayChurchHoleGameScores,
} from "@/lib/sunday-church-hole-games";
import {
  SUNDAY_CHURCH_YELLOW_BALL_SKINS_FORMAT_ID,
  calculateSundayChurchYellowBallResults,
  resolveSundayChurchYellowBallCarryoverTiebreaker,
} from "@/lib/sunday-church-yellow-ball-skins";

export interface StoredSkinScore {
  teamId: string;
  holeNumber: number;
  entryType: HoleEntryType;
  value: number | null;
  grossScore?: number | null;
}

export interface SkinsHoleOutcome {
  holeNumber: number;
  formatName: string | null;
  isComplete: boolean;
  isTie: boolean;
  winningTeamIds: string[];
}

function toTeamScores(scores: StoredSkinScore[]): TeamScore[] {
  return scores.map((score) => ({
    teamId: score.teamId,
    holeNumber: score.holeNumber,
    entryType: score.entryType,
    value: score.value,
  }));
}

function toDirectionalScores(scores: StoredSkinScore[]): DirectionalSkinScore[] {
  return scores.map((score) => ({
    teamId: score.teamId,
    holeNumber: score.holeNumber,
    entryType: score.entryType,
    comparisonValue: score.value,
  }));
}

export function calculateSkinsFormatResults({
  formatId,
  scores,
  teams,
  startingHole,
  pot,
  courseHoles,
  formatConfig,
}: {
  formatId: string | null | undefined;
  scores: StoredSkinScore[];
  teams: { id: string; teamNumber: number }[];
  startingHole: number;
  pot: Decimal;
  courseHoles: CourseHoleInfo[];
  formatConfig: Record<string, unknown> | null | undefined;
}) {
  if (formatId === SUNDAY_CHURCH_HOLE_GAMES_FORMAT_ID) {
    return calculateSundayChurchHoleGameResults(
      toSundayChurchHoleGameScores(scores),
      teams,
      startingHole,
      pot,
      courseHoles,
      formatConfig
    );
  }
  if (formatId === SUNDAY_CHURCH_YELLOW_BALL_SKINS_FORMAT_ID) {
    return calculateSundayChurchYellowBallResults(
      toTeamScores(scores),
      teams,
      startingHole,
      pot,
      courseHoles
    );
  }
  return calculateRoundResults(
    toTeamScores(scores),
    teams,
    startingHole,
    pot,
    courseHoles
  );
}

export function resolveSkinsFormatCarryover({
  formatId,
  scores,
  teams,
  courseHoles,
  unresolvedCarryover,
  baseSkinValue,
  formatConfig,
}: {
  formatId: string | null | undefined;
  scores: StoredSkinScore[];
  teams: { id: string }[];
  courseHoles: CourseHoleInfo[];
  unresolvedCarryover: number;
  baseSkinValue: Decimal;
  formatConfig: Record<string, unknown> | null | undefined;
}) {
  if (formatId === SUNDAY_CHURCH_HOLE_GAMES_FORMAT_ID) {
    return resolveSundayChurchHoleGameCarryoverTiebreaker(
      toSundayChurchHoleGameScores(scores),
      teams,
      courseHoles,
      unresolvedCarryover,
      baseSkinValue,
      formatConfig
    );
  }
  if (formatId === SUNDAY_CHURCH_YELLOW_BALL_SKINS_FORMAT_ID) {
    return resolveSundayChurchYellowBallCarryoverTiebreaker(
      toTeamScores(scores),
      teams,
      courseHoles,
      unresolvedCarryover,
      baseSkinValue
    );
  }
  return resolveCarryoverTiebreaker(
    toTeamScores(scores),
    teams,
    courseHoles,
    unresolvedCarryover,
    baseSkinValue
  );
}

export function computeSkinsFormatOutcomes({
  formatId,
  scores,
  teams,
  formatConfig,
}: {
  formatId: string | null | undefined;
  scores: StoredSkinScore[];
  teams: { id: string; teamNumber: number }[];
  formatConfig: Record<string, unknown> | null | undefined;
}): SkinsHoleOutcome[] {
  if (formatId === SUNDAY_CHURCH_HOLE_GAMES_FORMAT_ID) {
    return computeSundayChurchHoleGameOutcomes(
      teams,
      toSundayChurchHoleGameScores(scores),
      formatConfig
    );
  }

  const comparison =
    formatId === SUNDAY_CHURCH_YELLOW_BALL_SKINS_FORMAT_ID ? "lower" : "higher";
  const directionalScores = toDirectionalScores(scores);
  const formatName = getFormatById(formatId ?? "")?.name ?? null;
  return Array.from({ length: 18 }, (_, index) => {
    const holeNumber = index + 1;
    const holeScores = directionalScores.filter(
      (score) => score.holeNumber === holeNumber
    );
    const isComplete = teams.every((team) =>
      holeScores.some(
        (score) => score.teamId === team.id && score.entryType !== "BLANK"
      )
    );
    const result = isComplete
      ? determineDirectionalSkinWinner(holeScores, comparison)
      : { winnerTeamId: null, isTie: false };
    return {
      holeNumber,
      formatName,
      isComplete,
      isTie: result.isTie,
      winningTeamIds: result.winnerTeamId ? [result.winnerTeamId] : [],
    };
  });
}
