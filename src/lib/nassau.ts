import { getFormatById } from "@/lib/format-definitions";

export interface NassauTeamLike {
  id: string;
  teamNumber: number;
}

export interface NassauHoleScoreLike {
  teamId: string;
  holeNumber: number;
  entryType: string;
  value: number | null;
  grossScore?: number | null;
}

export interface NassauHoleOutcome {
  holeNumber: number;
  segmentIndex: number;
  formatId: string | null;
  formatName: string | null;
  scoringMode: "aggregate";
  higherIsBetter: boolean;
  isComplete: boolean;
  teamValues: Map<string, number | null>;
  winningTeamIds: string[];
  isTie: boolean;
}

export interface NassauSegmentSummary {
  segmentIndex: number;
  label: string;
  formatId: string | null;
  scoringMode: "aggregate";
  higherIsBetter: boolean;
  teamTotals: Map<string, number>;
  winningTeamIds: string[];
  payoutPerWinningTeam: number;
  segmentPot: number;
  completedHoles: number;
  holeOutcomes: NassauHoleOutcome[];
}

export interface NassauOverallSummary {
  label: string;
  scoringMode: "aggregate";
  higherIsBetter: boolean;
  teamTotals: Map<string, number>;
  winningTeamIds: string[];
  payoutPerWinningTeam: number;
  overallPot: number;
  completedHoles: number;
}

const NASSAU_SEGMENTS = [
  { segmentIndex: 0, label: "Front 9", holes: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { segmentIndex: 1, label: "Back 9", holes: [10, 11, 12, 13, 14, 15, 16, 17, 18] },
] as const;

const ALL_HOLE_NUMBERS = NASSAU_SEGMENTS.flatMap((segment) => segment.holes);

type NassauFormatConfig = Record<string, unknown> | null | undefined;

export function getNassauSegmentFormatId(
  holeNumber: number,
  formatConfig: NassauFormatConfig
) {
  if (holeNumber >= 1 && holeNumber <= 9) {
    return (formatConfig?.frontNineFormatId as string | undefined) ?? null;
  }
  if (holeNumber >= 10 && holeNumber <= 18) {
    return (formatConfig?.backNineFormatId as string | undefined) ?? null;
  }
  return null;
}

function getNassauSegmentFormatIdByIndex(
  segmentIndex: number,
  formatConfig: NassauFormatConfig
) {
  return segmentIndex === 0
    ? (formatConfig?.frontNineFormatId as string | undefined) ?? null
    : (formatConfig?.backNineFormatId as string | undefined) ?? null;
}

function getHoleSegmentIndex(holeNumber: number) {
  return holeNumber <= 9 ? 0 : 1;
}

function isHigherScoreBetter(formatId: string | null) {
  return formatId ? getFormatById(formatId)?.formatCategory === "points" : false;
}

function isOverallHigherScoreBetter(formatConfig: NassauFormatConfig) {
  const formatIds = [
    (formatConfig?.frontNineFormatId as string | undefined) ?? null,
    (formatConfig?.backNineFormatId as string | undefined) ?? null,
  ].filter((formatId): formatId is string => !!formatId);

  return (
    formatIds.length > 0 &&
    formatIds.every((formatId) => getFormatById(formatId)?.formatCategory === "points")
  );
}

function getNumericScore(score: NassauHoleScoreLike | undefined) {
  if (!score || score.entryType === "BLANK") return null;
  return score.grossScore ?? score.value ?? null;
}

function getTeamValueMap(
  teams: NassauTeamLike[],
  holeNumber: number,
  holeScores: NassauHoleScoreLike[]
) {
  return new Map(
    teams.map((team) => {
      const score = holeScores.find(
        (holeScore) =>
          holeScore.teamId === team.id && holeScore.holeNumber === holeNumber
      );
      return [team.id, getNumericScore(score)] as const;
    })
  );
}

function getWinningTeamIdsForOutcome(
  teams: NassauTeamLike[],
  teamValues: Map<string, number | null>,
  higherIsBetter: boolean
) {
  const complete = teams.every((team) => teamValues.get(team.id) !== null);
  if (!complete) {
    return { isComplete: false, winningTeamIds: [] as string[], isTie: false };
  }

  const values = teams
    .map((team) => ({
      teamId: team.id,
      value: teamValues.get(team.id),
    }))
    .filter(
      (entry): entry is { teamId: string; value: number } => entry.value !== null
    );

  if (values.length === 0) {
    return { isComplete: false, winningTeamIds: [] as string[], isTie: false };
  }

  const bestValue = higherIsBetter
    ? Math.max(...values.map((entry) => entry.value))
    : Math.min(...values.map((entry) => entry.value));
  const winningTeamIds = values
    .filter((entry) => entry.value === bestValue)
    .map((entry) => entry.teamId);

  return {
    isComplete: true,
    winningTeamIds,
    isTie: winningTeamIds.length !== 1,
  };
}

export function computeNassauHoleOutcomes(
  teams: NassauTeamLike[],
  holeScores: NassauHoleScoreLike[],
  formatConfig: NassauFormatConfig
) {
  return ALL_HOLE_NUMBERS.map((holeNumber) => {
    const segmentIndex = getHoleSegmentIndex(holeNumber);
    const formatId = getNassauSegmentFormatId(holeNumber, formatConfig);
    const formatName = formatId ? getFormatById(formatId)?.name ?? formatId : null;
    const higherIsBetter = isHigherScoreBetter(formatId);
    const teamValues = getTeamValueMap(teams, holeNumber, holeScores);
    const outcome = getWinningTeamIdsForOutcome(
      teams,
      teamValues,
      higherIsBetter
    );

    return {
      holeNumber,
      segmentIndex,
      formatId,
      formatName,
      scoringMode: "aggregate",
      higherIsBetter,
      isComplete: outcome.isComplete,
      teamValues,
      winningTeamIds: outcome.winningTeamIds,
      isTie: outcome.isTie,
    } satisfies NassauHoleOutcome;
  });
}

function createZeroTeamTotals(teams: NassauTeamLike[]) {
  return new Map(teams.map((team) => [team.id, 0]));
}

function getWinningTeamIdsFromTotals(
  teamTotals: Map<string, number>,
  higherIsBetter: boolean,
  hasScores: boolean
) {
  if (!hasScores) return [];
  const totals = [...teamTotals.values()];
  if (totals.length === 0) return [];
  const winningTotal = higherIsBetter ? Math.max(...totals) : Math.min(...totals);
  return [...teamTotals.entries()]
    .filter(([, total]) => total === winningTotal)
    .map(([teamId]) => teamId);
}

export function computeNassauSegmentSummaries(
  teams: NassauTeamLike[],
  holeScores: NassauHoleScoreLike[],
  formatConfig: NassauFormatConfig,
  totalPot: number
) {
  const segmentPot = totalPot / 3;
  const allHoleOutcomes = computeNassauHoleOutcomes(teams, holeScores, formatConfig);

  return NASSAU_SEGMENTS.map((segment) => {
    const formatId = getNassauSegmentFormatIdByIndex(
      segment.segmentIndex,
      formatConfig
    );
    const higherIsBetter = isHigherScoreBetter(formatId);
    const holeOutcomes = allHoleOutcomes.filter(
      (outcome) => outcome.segmentIndex === segment.segmentIndex
    );

    const teamTotals = new Map(
      teams.map((team) => [
        team.id,
        holeOutcomes.reduce((sum, outcome) => {
          const value = outcome.teamValues.get(team.id);
          return sum + (value ?? 0);
        }, 0),
      ])
    );
    const hasScores = holeOutcomes.some((outcome) =>
      teams.some((team) => outcome.teamValues.get(team.id) !== null)
    );
    const winningTeamIds = getWinningTeamIdsFromTotals(
      teamTotals,
      higherIsBetter,
      hasScores
    );

    return {
      segmentIndex: segment.segmentIndex,
      label: segment.label,
      formatId,
      scoringMode: "aggregate",
      higherIsBetter,
      teamTotals,
      winningTeamIds,
      payoutPerWinningTeam:
        winningTeamIds.length > 0 ? segmentPot / winningTeamIds.length : 0,
      segmentPot,
      completedHoles: holeOutcomes.filter((outcome) => outcome.isComplete).length,
      holeOutcomes,
    } satisfies NassauSegmentSummary;
  });
}

export function computeNassauOverallSummary(
  teams: NassauTeamLike[],
  holeScores: NassauHoleScoreLike[],
  formatConfig: NassauFormatConfig,
  totalPot: number
): NassauOverallSummary {
  const overallPot = totalPot / 3;
  const higherIsBetter = isOverallHigherScoreBetter(formatConfig);
  const allHoleOutcomes = computeNassauHoleOutcomes(teams, holeScores, formatConfig);
  const teamTotals = createZeroTeamTotals(teams);

  for (const team of teams) {
    teamTotals.set(
      team.id,
      allHoleOutcomes.reduce((sum, outcome) => {
        const value = outcome.teamValues.get(team.id);
        return sum + (value ?? 0);
      }, 0)
    );
  }

  const hasScores = allHoleOutcomes.some((outcome) =>
    teams.some((team) => outcome.teamValues.get(team.id) !== null)
  );
  const winningTeamIds = getWinningTeamIdsFromTotals(
    teamTotals,
    higherIsBetter,
    hasScores
  );

  return {
    label: "Overall 18 Holes",
    scoringMode: "aggregate",
    higherIsBetter,
    teamTotals,
    winningTeamIds,
    payoutPerWinningTeam:
      winningTeamIds.length > 0 ? overallPot / winningTeamIds.length : 0,
    overallPot,
    completedHoles: allHoleOutcomes.filter((outcome) => outcome.isComplete).length,
  };
}
