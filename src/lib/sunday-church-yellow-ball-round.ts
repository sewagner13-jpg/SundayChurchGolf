import {
  SUNDAY_CHURCH_YELLOW_BALL_SKINS_FORMAT_ID,
  getSundayChurchYellowBallConfig,
  validateSundayChurchYellowBallSetup,
} from "@/lib/sunday-church-yellow-ball-skins";

interface YellowBallRoundPlayer {
  playerId: string;
  player: { handicapIndex: unknown };
}

export function assertSundayChurchYellowBallDedicatedScoreAction(formatId: string) {
  if (formatId === SUNDAY_CHURCH_YELLOW_BALL_SKINS_FORMAT_ID) {
    throw new Error("Use the Sunday Church Yellow Ball gross-score entry form for this round.");
  }
}

export function assertSundayChurchYellowBallRoundStart(round: {
  formatId: string;
  teamSize: number | null;
  teams: Array<{
    teamNumber: number;
    roundPlayers: Array<{ playerId: string }>;
  }>;
  roundPlayers: YellowBallRoundPlayer[];
  formatConfig: unknown;
}) {
  const { formatId, teamSize, teams, roundPlayers, formatConfig } = round;
  if (formatId !== SUNDAY_CHURCH_YELLOW_BALL_SKINS_FORMAT_ID) return;

  const config = getSundayChurchYellowBallConfig(
    formatConfig as Record<string, unknown> | null
  );
  const errors = validateSundayChurchYellowBallSetup({
    teams: teams.map((team) => ({
      id: `Team ${team.teamNumber}`,
      playerIds: team.roundPlayers.map((roundPlayer) => roundPlayer.playerId),
    })),
    playerHandicapIndexes: Object.fromEntries(
      roundPlayers.map((roundPlayer) => [
        roundPlayer.playerId,
        roundPlayer.player.handicapIndex === null
          ? null
          : Number(roundPlayer.player.handicapIndex),
      ])
    ),
    useYellowBallHandicaps: config.useYellowBallHandicaps,
  });
  if (teamSize !== 4) {
    errors.unshift("Sunday Church Yellow Ball Skins requires teams of four players.");
  }
  if (errors.length > 0) throw new Error(errors[0]);
}

export function assertSundayChurchYellowBallLiveConfigChange(round: {
  formatId: string;
  formatConfig: unknown;
  holeScores: unknown[];
}, nextConfig: Record<string, unknown> | undefined) {
  if (
    round.formatId === SUNDAY_CHURCH_YELLOW_BALL_SKINS_FORMAT_ID &&
    nextConfig !== undefined &&
    round.holeScores.length > 0 &&
    getSundayChurchYellowBallConfig(nextConfig).useYellowBallHandicaps !==
      getSundayChurchYellowBallConfig(
        round.formatConfig as Record<string, unknown> | null
      ).useYellowBallHandicaps
  ) {
    throw new Error("Handicap scoring cannot change after scoring begins.");
  }
}
