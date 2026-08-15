import type { HoleEntryType } from "@prisma/client";
import { getFormatById } from "@/lib/format-definitions";
import {
  calculateDirectionalSkinResults,
  determineDirectionalSkinWinner,
  resolveDirectionalSkinCarryoverTiebreaker,
} from "@/lib/directional-skins";
import type { CourseHoleInfo, HoleResultData, TeamScore } from "@/lib/scoring-engine";

export const SUNDAY_CHURCH_HOLE_GAMES_FORMAT_ID = "sunday_church_hole_games";

export const SUNDAY_CHURCH_HOLE_GAME_ELIGIBLE_FORMATS = [
  "default-sunday-church",
  "captains_choice",
  "step_aside_scramble",
  "scramble_rotating_drives",
  "shamble_team",
  "one_best_ball_of_four",
  "two_best_balls_of_four",
  "three_best_balls_of_four",
  "lone_ranger",
  "money_ball",
  "cha_cha_cha",
  "chicago_points_team",
  "train_game",
] as const;

export type SundayChurchHoleGameFormatId =
  (typeof SUNDAY_CHURCH_HOLE_GAME_ELIGIBLE_FORMATS)[number];

export type SundayChurchHoleGameComparison = "higher" | "lower";

export interface SundayChurchHoleGameAssignment {
  formatId: SundayChurchHoleGameFormatId;
  allBirdiesCount?: boolean;
}

export interface SundayChurchHoleGameConfig extends Record<string, unknown> {
  holeGames?: Record<string, SundayChurchHoleGameAssignment>;
}

export interface SundayChurchHoleGameScore extends TeamScore {
  grossScore?: number | null;
}

export interface SundayChurchHoleGameOutcome {
  holeNumber: number;
  formatId: string;
  formatName: string;
  comparison: SundayChurchHoleGameComparison;
  isComplete: boolean;
  isTie: boolean;
  winningTeamIds: string[];
  teamValues: Map<string, number | null>;
}

const HOLE_NUMBERS = Array.from({ length: 18 }, (_, index) => index + 1);
const ELIGIBLE_FORMAT_SET = new Set<string>(SUNDAY_CHURCH_HOLE_GAME_ELIGIBLE_FORMATS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isEligibleHoleGameFormatId(
  formatId: unknown
): formatId is SundayChurchHoleGameFormatId {
  return typeof formatId === "string" && ELIGIBLE_FORMAT_SET.has(formatId);
}

export function createDefaultSundayChurchHoleGamesConfig(): SundayChurchHoleGameConfig {
  return {
    holeGames: Object.fromEntries(
      HOLE_NUMBERS.map((holeNumber) => [
        String(holeNumber),
        { formatId: "default-sunday-church" satisfies SundayChurchHoleGameFormatId },
      ])
    ),
  };
}

export function getSundayChurchHoleGameAssignment(
  formatConfig: Record<string, unknown> | null | undefined,
  holeNumber: number
): SundayChurchHoleGameAssignment {
  const configuredHoleGames = isPlainObject(formatConfig?.holeGames)
    ? formatConfig.holeGames
    : {};
  const configuredAssignment = configuredHoleGames[String(holeNumber)];

  if (!isPlainObject(configuredAssignment)) {
    return { formatId: "default-sunday-church" };
  }

  const formatId = configuredAssignment.formatId;
  if (!isEligibleHoleGameFormatId(formatId)) {
    return { formatId: "default-sunday-church" };
  }

  return {
    formatId,
    allBirdiesCount: configuredAssignment.allBirdiesCount === true,
  };
}

export function getEffectiveHoleFormatId(
  roundFormatId: string | null | undefined,
  holeNumber: number,
  formatConfig: Record<string, unknown> | null | undefined
): string | null {
  if (roundFormatId === SUNDAY_CHURCH_HOLE_GAMES_FORMAT_ID) {
    return getSundayChurchHoleGameAssignment(formatConfig, holeNumber).formatId;
  }
  return roundFormatId ?? null;
}

export function validateSundayChurchHoleGamesConfig(
  formatConfig: Record<string, unknown> | null | undefined,
  teamSize?: number | null
): string[] {
  const errors: string[] = [];
  const holeGames = formatConfig?.holeGames;

  if (!isPlainObject(holeGames)) {
    return ["Assign a gameplay format to every hole."];
  }

  for (const holeNumber of HOLE_NUMBERS) {
    const key = String(holeNumber);
    const assignment = holeGames[key];

    if (!isPlainObject(assignment)) {
      errors.push(`Hole ${holeNumber} is missing a gameplay format.`);
      continue;
    }

    const formatId = assignment.formatId;
    if (!isEligibleHoleGameFormatId(formatId)) {
      errors.push(`Hole ${holeNumber} has an invalid gameplay format.`);
      continue;
    }

    const formatDefinition = getFormatById(formatId);
    if (
      teamSize &&
      formatDefinition &&
      !formatDefinition.supportedTeamSizes.includes(teamSize)
    ) {
      errors.push(
        `Hole ${holeNumber} uses ${formatDefinition.name}, which does not support teams of ${teamSize}.`
      );
    }
  }

  return errors;
}

export function getSundayChurchHoleGameComparison(
  assignment: SundayChurchHoleGameAssignment
): SundayChurchHoleGameComparison {
  if (assignment.allBirdiesCount) return "lower";
  if (assignment.formatId === "default-sunday-church") return "higher";

  const formatDefinition = getFormatById(assignment.formatId);
  if (formatDefinition?.formatCategory === "points") return "higher";

  return "lower";
}

function getComparableValue(score: SundayChurchHoleGameScore | undefined) {
  if (!score || score.entryType !== "VALUE") return null;
  return score.grossScore ?? score.value ?? null;
}

export function determineSundayChurchHoleGameWinner(
  scores: SundayChurchHoleGameScore[],
  comparison: SundayChurchHoleGameComparison
): { winnerTeamId: string | null; isTie: boolean } {
  return determineDirectionalSkinWinner(
    scores.map((score) => ({
      teamId: score.teamId,
      holeNumber: score.holeNumber,
      entryType: score.entryType,
      comparisonValue: getComparableValue(score),
    })),
    comparison
  );
}

export function computeSundayChurchHoleGameOutcomes(
  teams: { id: string; teamNumber: number }[],
  scores: SundayChurchHoleGameScore[],
  formatConfig: Record<string, unknown> | null | undefined
): SundayChurchHoleGameOutcome[] {
  return HOLE_NUMBERS.map((holeNumber) => {
    const assignment = getSundayChurchHoleGameAssignment(formatConfig, holeNumber);
    const comparison = getSundayChurchHoleGameComparison(assignment);
    const formatDefinition = getFormatById(assignment.formatId);
    const holeScores = scores.filter((score) => score.holeNumber === holeNumber);
    const isComplete = teams.every((team) =>
      holeScores.some(
        (score) => score.teamId === team.id && score.entryType !== "BLANK"
      )
    );
    const result = isComplete
      ? determineSundayChurchHoleGameWinner(holeScores, comparison)
      : { winnerTeamId: null, isTie: false };

    return {
      holeNumber,
      formatId: assignment.formatId,
      formatName: formatDefinition?.name ?? assignment.formatId,
      comparison,
      isComplete,
      isTie: result.isTie,
      winningTeamIds: result.winnerTeamId ? [result.winnerTeamId] : [],
      teamValues: new Map(
        teams.map((team) => {
          const score = holeScores.find((entry) => entry.teamId === team.id);
          return [team.id, getComparableValue(score)] as const;
        })
      ),
    };
  });
}

export function calculateSundayChurchHoleGameResults(
  allScores: SundayChurchHoleGameScore[],
  teams: { id: string; teamNumber: number }[],
  startingHole: number,
  pot: HoleResultData["holePayout"],
  courseHoles: CourseHoleInfo[],
  formatConfig: Record<string, unknown> | null | undefined
): {
  holeResults: HoleResultData[];
  teamPayouts: Map<string, HoleResultData["holePayout"]>;
  unresolvedCarryover: number;
} {
  void courseHoles;
  return calculateDirectionalSkinResults({
    allScores: allScores.map((score) => ({
      teamId: score.teamId,
      holeNumber: score.holeNumber,
      entryType: score.entryType,
      comparisonValue: getComparableValue(score),
    })),
    teams,
    startingHole,
    pot,
    getComparison: (holeNumber) =>
      getSundayChurchHoleGameComparison(
        getSundayChurchHoleGameAssignment(formatConfig, holeNumber)
      ),
  });
}

export function resolveSundayChurchHoleGameCarryoverTiebreaker(
  allScores: SundayChurchHoleGameScore[],
  teams: { id: string }[],
  courseHoles: CourseHoleInfo[],
  unresolvedCarryover: number,
  baseSkinValue: HoleResultData["holePayout"],
  formatConfig: Record<string, unknown> | null | undefined
) {
  return resolveDirectionalSkinCarryoverTiebreaker({
    allScores: allScores.map((score) => ({
      teamId: score.teamId,
      holeNumber: score.holeNumber,
      entryType: score.entryType,
      comparisonValue: getComparableValue(score),
    })),
    teams,
    courseHoles,
    unresolvedCarryover,
    baseSkinValue,
    getComparison: (holeNumber) =>
      getSundayChurchHoleGameComparison(
        getSundayChurchHoleGameAssignment(formatConfig, holeNumber)
      ),
  });
}

export function toSundayChurchHoleGameScores(
  scores: Array<{
    teamId: string;
    holeNumber: number;
    entryType: HoleEntryType;
    value: number | null;
    grossScore?: number | null;
  }>
): SundayChurchHoleGameScore[] {
  return scores.map((score) => ({
    teamId: score.teamId,
    holeNumber: score.holeNumber,
    entryType: score.entryType,
    value: score.value,
    grossScore: score.grossScore ?? null,
  }));
}
