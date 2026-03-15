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

export interface IrishGolfSegmentSummary {
  segmentIndex: number;
  label: string;
  formatId: string | null;
  teamTotals: Map<string, number>;
  winningTeamIds: string[];
  payoutPerWinningTeam: number;
  segmentPot: number;
}

const IRISH_GOLF_SEGMENTS = [
  { segmentIndex: 0, label: "Holes 1-6", holes: [1, 2, 3, 4, 5, 6] },
  { segmentIndex: 1, label: "Holes 7-12", holes: [7, 8, 9, 10, 11, 12] },
  { segmentIndex: 2, label: "Holes 13-18", holes: [13, 14, 15, 16, 17, 18] },
] as const;

function getIrishGolfSegmentFormatId(
  segmentIndex: number,
  formatConfig: Record<string, unknown> | null | undefined
) {
  if (segmentIndex === 0) {
    return (formatConfig?.segment1FormatId as string | undefined) ?? null;
  }
  if (segmentIndex === 1) {
    return (formatConfig?.segment2FormatId as string | undefined) ?? null;
  }
  return (formatConfig?.segment3FormatId as string | undefined) ?? null;
}

export function computeIrishGolfSegmentSummaries(
  teams: IrishGolfTeamLike[],
  holeScores: IrishGolfHoleScoreLike[],
  formatConfig: Record<string, unknown> | null | undefined,
  totalPot: number
) {
  const segmentPot = totalPot / 3;

  return IRISH_GOLF_SEGMENTS.map((segment) => {
    const formatId = getIrishGolfSegmentFormatId(segment.segmentIndex, formatConfig);
    const formatDefinition = formatId ? getFormatById(formatId) : undefined;
    const isPointsStyle =
      formatDefinition?.formatCategory === "points" ||
      formatDefinition?.formatCategory === "match";

    const teamTotals = new Map<string, number>();
    for (const team of teams) {
      const total = segment.holes.reduce((sum, holeNumber) => {
        const holeScore = holeScores.find(
          (score) =>
            score.teamId === team.id &&
            score.holeNumber === holeNumber &&
            score.entryType !== "BLANK"
        );
        const numericScore = holeScore?.grossScore ?? holeScore?.value ?? null;
        return sum + (numericScore ?? 0);
      }, 0);
      teamTotals.set(team.id, total);
    }

    const totals = [...teamTotals.values()];
    const winningScore = totals.length
      ? isPointsStyle
        ? Math.max(...totals)
        : Math.min(...totals)
      : null;
    const winningTeamIds =
      winningScore === null
        ? []
        : teams
            .filter((team) => teamTotals.get(team.id) === winningScore)
            .map((team) => team.id);

    return {
      segmentIndex: segment.segmentIndex,
      label: segment.label,
      formatId,
      teamTotals,
      winningTeamIds,
      payoutPerWinningTeam:
        winningTeamIds.length > 0 ? segmentPot / winningTeamIds.length : 0,
      segmentPot,
    } satisfies IrishGolfSegmentSummary;
  });
}
