import { Card, CardContent, CardHeader } from "@/components/card";
import { SundayChurchYellowBallGrid } from "@/components/sunday-church-yellow-ball-grid";
import { getScoringOrder } from "@/lib/scoring-order";
import { getTeamDisplayLabel } from "@/lib/team-labels";

interface SummaryRound {
  startingHole: number | null;
  course: { holes: Array<{ holeNumber: number; par: number }> };
  teams: Array<{
    id: string;
    teamNumber: number;
    roundPlayers: Array<{
      playerId: string;
      player: { fullName: string; nickname: string | null };
    }>;
  }>;
  holeScores: Array<{
    teamId: string;
    holeNumber: number;
    holeData?: Record<string, unknown> | null;
  }>;
  holeResults: Array<{
    holeNumber: number;
    winnerTeamId: string | null;
    isTie: boolean;
  }>;
}

export function SundayChurchYellowBallSummary({ round }: { round: SummaryRound }) {
  const resultMap = new Map(
    round.holeResults.map((result) => [result.holeNumber, result])
  );
  const data = {
    teams: round.teams.map((team) => ({
      teamId: team.id,
      teamNumber: team.teamNumber,
      label: getTeamDisplayLabel(team.roundPlayers),
      players: team.roundPlayers.map(
        (roundPlayer) =>
          roundPlayer.player.nickname || roundPlayer.player.fullName
      ),
    })),
    holes: getScoringOrder(round.startingHole ?? 1).map((holeNumber) => {
      const courseHole = round.course.holes.find(
        (hole) => hole.holeNumber === holeNumber
      );
      const result = resultMap.get(holeNumber);
      return {
        holeNumber,
        par: courseHole?.par ?? 4,
        isTie: result?.isTie ?? false,
        winnerTeamIds: result?.winnerTeamId ? [result.winnerTeamId] : [],
        teamScores: round.teams.map((team) => {
          const holeData = round.holeScores.find(
            (score) => score.teamId === team.id && score.holeNumber === holeNumber
          )?.holeData as {
            designatedPlayerId?: string;
            yellowBallNetScore?: number;
            scrambleGrossScore?: number;
            combinedScore?: number;
            handicapApplied?: boolean;
          } | null | undefined;
          const carrier = team.roundPlayers.find(
            (roundPlayer) => roundPlayer.playerId === holeData?.designatedPlayerId
          );
          const complete =
            typeof holeData?.yellowBallNetScore === "number" &&
            typeof holeData.scrambleGrossScore === "number" &&
            typeof holeData.combinedScore === "number";
          return {
            teamId: team.id,
            yellowBall: complete
              ? {
                  designatedPlayerName:
                    carrier?.player.nickname ||
                    carrier?.player.fullName ||
                    "Yellow ball",
                  yellowBallNetScore: holeData.yellowBallNetScore as number,
                  scrambleGrossScore: holeData.scrambleGrossScore as number,
                  combinedScore: holeData.combinedScore as number,
                  handicapApplied: holeData.handicapApplied === true,
                }
              : null,
          };
        }),
      };
    }),
  };

  return (
    <Card>
      <CardHeader>Team Scores by Hole</CardHeader>
      <CardContent>
        <SundayChurchYellowBallGrid data={data} />
      </CardContent>
    </Card>
  );
}
