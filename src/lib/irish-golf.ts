import { getFormatById } from "@/lib/format-definitions";

export interface IrishGolfTeamLike {
  id: string;
  teamNumber: number;
}

export interface IrishGolfHoleScoreLike {
  teamId: string;
  holeNumber: number;
  entryType: string;
  value: number | null;
  grossScore?: number | null;
}

export interface IrishGolfHoleOutcome {
  holeNumber: number;
  segmentIndex: number;
  formatId: string | null;
  formatName: string | null;
  scoringMode: "aggregate" | "match_play";
  higherIsBetter: boolean;
  isComplete: boolean;
  teamValues: Map<string, number | null>;
  winningTeamIds: string[];
  isTie: boolean;
}

export interface IrishGolfSegmentSummary {
  segmentIndex: number;
  label: string;
  formatId: string | null;
  scoringMode: "aggregate" | "match_play";
  higherIsBetter: boolean;
  teamTotals: Map<string, number>;
  winningTeamIds: string[];
  payoutPerWinningTeam: number;
  segmentPot: number;
  completedHoles: number;
  holeOutcomes: IrishGolfHoleOutcome[];
}

export interface IrishGolfOverallSummary {
  label: string;
  scoringMode: "aggregate" | "match_play";
  higherIsBetter: boolean;
  teamTotals: Map<string, number>;
  winningTeamIds: string[];
  payoutPerWinningTeam: number;
  overallPot: number;
  completedHoles: number;
}

const IRISH_GOLF_SEGMENTS = [
  { segmentIndex: 0, label: "Holes 1-6", holes: [1, 2, 3, 4, 5, 6] },
  { segmentIndex: 1, label: "Holes 7-12", holes: [7, 8, 9, 10, 11, 12] },
  { segmentIndex: 2, label: "Holes 13-18", holes: [13, 14, 15, 16, 17, 18] },
] as const;

const ALL_HOLE_NUMBERS = IRISH_GOLF_SEGMENTS.flatMap((segment) => segment.holes);

type IrishGolfFormatConfig = Record<string, unknown> | null | undefined;

interface IrishGolfMatchPlayStandings {
  points: Record<string, number>;
}

function getIrishGolfSegmentFormatId(
  segmentIndex: number,
  formatConfig: IrishGolfFormatConfig
) {
  if (segmentIndex === 0) {
    return (formatConfig?.segment1FormatId as string | undefined) ?? null;
  }
  if (segmentIndex === 1) {
    return (formatConfig?.segment2FormatId as string | undefined) ?? null;
  }
  return (formatConfig?.segment3FormatId as string | undefined) ?? null;
}

function getSegmentMatchPlayEnabled(
  segmentIndex: number,
  formatId: string | null,
  formatConfig: IrishGolfFormatConfig
) {
  const formatDefinition = formatId ? getFormatById(formatId) : undefined;
  if (formatDefinition?.formatCategory === "match") return true;
  if (segmentIndex === 0) {
    return formatConfig?.segment1MatchPlay === true;
  }
  if (segmentIndex === 1) {
    return formatConfig?.segment2MatchPlay === true;
  }
  return formatConfig?.segment3MatchPlay === true;
}

function getSegmentCarryOverEnabled(
  segmentIndex: number,
  formatConfig: IrishGolfFormatConfig
) {
  if (segmentIndex === 0) {
    return formatConfig?.segment1CarryOver === true;
  }
  if (segmentIndex === 1) {
    return formatConfig?.segment2CarryOver === true;
  }
  return formatConfig?.segment3CarryOver === true;
}

function getHoleSegmentIndex(holeNumber: number) {
  if (holeNumber >= 1 && holeNumber <= 6) return 0;
  if (holeNumber >= 7 && holeNumber <= 12) return 1;
  return 2;
}

function isHigherScoreBetter(formatId: string | null) {
  return formatId ? getFormatById(formatId)?.formatCategory === "points" : false;
}

function getNumericScore(score: IrishGolfHoleScoreLike | undefined) {
  if (!score || score.entryType === "BLANK") return null;
  return score.grossScore ?? score.value ?? null;
}

function getTeamValueMap(
  teams: IrishGolfTeamLike[],
  holeNumber: number,
  holeScores: IrishGolfHoleScoreLike[]
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
  teams: IrishGolfTeamLike[],
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

function computeIrishGolfMatchPlayHole(
  teamScores: { teamId: string; grossScore: number | null }[],
  carryover: number,
  higherIsBetter: boolean
) {
  const valid = teamScores.filter(
    (teamScore): teamScore is { teamId: string; grossScore: number } =>
      teamScore.grossScore !== null
  );
  if (valid.length === 0) {
    return {
      winnerTeamId: null,
      isTie: true,
      pointsToWinner: 0,
      newCarryover: carryover + 1,
    };
  }

  const winningScore = higherIsBetter
    ? Math.max(...valid.map((teamScore) => teamScore.grossScore))
    : Math.min(...valid.map((teamScore) => teamScore.grossScore));
  const winners = valid.filter((teamScore) => teamScore.grossScore === winningScore);

  if (winners.length !== 1) {
    return {
      winnerTeamId: null,
      isTie: true,
      pointsToWinner: 0,
      newCarryover: carryover + 1,
    };
  }

  return {
    winnerTeamId: winners[0].teamId,
    isTie: false,
    pointsToWinner: 1 + carryover,
    newCarryover: 0,
  };
}

function computeIrishGolfMatchPlayStandings(
  holeResults: Array<{
    teamScores: { teamId: string; grossScore: number | null }[];
    higherIsBetter: boolean;
  }>,
  carryOver: boolean
) {
  const teamIds = new Set<string>();
  for (const holeResult of holeResults) {
    holeResult.teamScores.forEach((teamScore) => teamIds.add(teamScore.teamId));
  }

  const points: Record<string, number> = {};
  teamIds.forEach((teamId) => {
    points[teamId] = 0;
  });

  let carryover = 0;
  for (const holeResult of holeResults) {
    const result = computeIrishGolfMatchPlayHole(
      holeResult.teamScores,
      carryOver ? carryover : 0,
      holeResult.higherIsBetter
    );

    if (!result.isTie && result.winnerTeamId) {
      points[result.winnerTeamId] =
        (points[result.winnerTeamId] ?? 0) + result.pointsToWinner;
      carryover = 0;
    } else {
      carryover = carryOver ? result.newCarryover : 0;
    }
  }

  return { points } satisfies IrishGolfMatchPlayStandings;
}

export function computeIrishGolfHoleOutcomes(
  teams: IrishGolfTeamLike[],
  holeScores: IrishGolfHoleScoreLike[],
  formatConfig: IrishGolfFormatConfig
) {
  return ALL_HOLE_NUMBERS.map((holeNumber) => {
    const segmentIndex = getHoleSegmentIndex(holeNumber);
    const formatId = getIrishGolfSegmentFormatId(segmentIndex, formatConfig);
    const formatName = formatId ? getFormatById(formatId)?.name ?? formatId : null;
    const higherIsBetter = isHigherScoreBetter(formatId);
    const scoringMode = getSegmentMatchPlayEnabled(
      segmentIndex,
      formatId,
      formatConfig
    )
      ? "match_play"
      : "aggregate";
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
      scoringMode,
      higherIsBetter,
      isComplete: outcome.isComplete,
      teamValues,
      winningTeamIds: outcome.winningTeamIds,
      isTie: outcome.isTie,
    } satisfies IrishGolfHoleOutcome;
  });
}

function createZeroTeamTotals(teams: IrishGolfTeamLike[]) {
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

export function computeIrishGolfSegmentSummaries(
  teams: IrishGolfTeamLike[],
  holeScores: IrishGolfHoleScoreLike[],
  formatConfig: IrishGolfFormatConfig,
  totalPot: number
) {
  const enableOverallGame = !!formatConfig?.enableOverallGame;
  const numGames = enableOverallGame ? 4 : 3;
  const segmentPot = totalPot / numGames;
  const allHoleOutcomes = computeIrishGolfHoleOutcomes(teams, holeScores, formatConfig);

  return IRISH_GOLF_SEGMENTS.map((segment) => {
    const formatId = getIrishGolfSegmentFormatId(segment.segmentIndex, formatConfig);
    const higherIsBetter = isHigherScoreBetter(formatId);
    const scoringMode = getSegmentMatchPlayEnabled(
      segment.segmentIndex,
      formatId,
      formatConfig
    )
      ? "match_play"
      : "aggregate";
    const holeOutcomes = allHoleOutcomes.filter(
      (outcome) => outcome.segmentIndex === segment.segmentIndex
    );

    let teamTotals = createZeroTeamTotals(teams);
    let winningTeamIds: string[] = [];

    if (scoringMode === "match_play") {
      const completedHoleResults = holeOutcomes
        .filter((outcome) => outcome.isComplete)
        .map((outcome) => ({
          holeNumber: outcome.holeNumber,
          higherIsBetter: outcome.higherIsBetter,
          teamScores: teams.map((team) => ({
            teamId: team.id,
            grossScore: outcome.teamValues.get(team.id) ?? null,
          })),
        }));

      const standings = computeIrishGolfMatchPlayStandings(
        completedHoleResults,
        getSegmentCarryOverEnabled(segment.segmentIndex, formatConfig)
      );

      teamTotals = new Map(
        teams.map((team) => [team.id, standings.points[team.id] ?? 0])
      );
      winningTeamIds = getWinningTeamIdsFromTotals(
        teamTotals,
        true,
        completedHoleResults.length > 0
      );
    } else {
      teamTotals = new Map(
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
      winningTeamIds = getWinningTeamIdsFromTotals(
        teamTotals,
        higherIsBetter,
        hasScores
      );
    }

    return {
      segmentIndex: segment.segmentIndex,
      label: segment.label,
      formatId,
      scoringMode,
      higherIsBetter,
      teamTotals,
      winningTeamIds,
      payoutPerWinningTeam:
        winningTeamIds.length > 0 ? segmentPot / winningTeamIds.length : 0,
      segmentPot,
      completedHoles: holeOutcomes.filter((outcome) => outcome.isComplete).length,
      holeOutcomes,
    } satisfies IrishGolfSegmentSummary;
  });
}

export function computeIrishGolfOverallSummary(
  teams: IrishGolfTeamLike[],
  holeScores: IrishGolfHoleScoreLike[],
  formatConfig: IrishGolfFormatConfig,
  totalPot: number
): IrishGolfOverallSummary | null {
  if (!formatConfig?.enableOverallGame) return null;

  const overallPot = totalPot / 4;
  const scoringMode =
    formatConfig?.overallGameMatchPlay === true ? "match_play" : "aggregate";
  const higherIsBetter = false;
  const allHoleOutcomes = computeIrishGolfHoleOutcomes(teams, holeScores, formatConfig);

  let teamTotals = createZeroTeamTotals(teams);
  let winningTeamIds: string[] = [];

  if (scoringMode === "match_play") {
    const completedHoleResults = allHoleOutcomes
      .filter((outcome) => outcome.isComplete)
      .map((outcome) => ({
        holeNumber: outcome.holeNumber,
        higherIsBetter: outcome.higherIsBetter,
        teamScores: teams.map((team) => ({
          teamId: team.id,
          grossScore: outcome.teamValues.get(team.id) ?? null,
        })),
      }));

    const standings = computeIrishGolfMatchPlayStandings(
      completedHoleResults,
      formatConfig?.overallGameCarryOver === true
    );

    teamTotals = new Map(
      teams.map((team) => [team.id, standings.points[team.id] ?? 0])
    );
    winningTeamIds = getWinningTeamIdsFromTotals(
      teamTotals,
      true,
      completedHoleResults.length > 0
    );
  } else {
    teamTotals = new Map(
      teams.map((team) => [
        team.id,
        allHoleOutcomes.reduce((sum, outcome) => {
          const value = outcome.teamValues.get(team.id);
          return sum + (value ?? 0);
        }, 0),
      ])
    );
    const hasScores = allHoleOutcomes.some((outcome) =>
      teams.some((team) => outcome.teamValues.get(team.id) !== null)
    );
    winningTeamIds = getWinningTeamIdsFromTotals(
      teamTotals,
      higherIsBetter,
      hasScores
    );
  }

  return {
    label: "Overall 18 Holes",
    scoringMode,
    higherIsBetter,
    teamTotals,
    winningTeamIds,
    payoutPerWinningTeam: winningTeamIds.length > 0 ? overallPot / winningTeamIds.length : 0,
    overallPot,
    completedHoles: allHoleOutcomes.filter((outcome) => outcome.isComplete).length,
  };
}
