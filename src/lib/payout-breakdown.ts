import { type Par3PayoutTarget } from "@/lib/par3-contests";

interface TeamLike {
  id: string;
  roundPlayers: Array<{
    playerId: string;
  }>;
}

interface Par3ResultLike {
  holeNumber: number;
  winnerPlayerId: string | null;
  payoutAmount?: number | null;
  payoutTarget?: Par3PayoutTarget;
}

interface RoundPlayerLike {
  id: string;
  playerId: string;
  player: {
    fullName: string;
    nickname: string | null;
  };
  team: {
    id: string;
    teamNumber: number;
  } | null;
}

interface TeamPayoutLike extends TeamLike {
  teamNumber: number;
  totalPayout: number;
  roundPlayers: Array<{
    id: string;
    playerId: string;
    player: {
      fullName: string;
      nickname: string | null;
    };
  }>;
}

export interface FinalPlayerPayoutRow {
  roundPlayerId: string;
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamNumber: number | null;
  mainGamePayout: number;
  par3Payout: number;
  totalPayout: number;
}

export function computePar3PlayerBonuses(
  teams: TeamLike[],
  par3Results: Par3ResultLike[]
) {
  const bonuses = new Map<string, number>();
  const playerTeamMap = new Map<string, TeamLike>();

  for (const team of teams) {
    for (const roundPlayer of team.roundPlayers) {
      playerTeamMap.set(roundPlayer.playerId, team);
      bonuses.set(roundPlayer.playerId, bonuses.get(roundPlayer.playerId) ?? 0);
    }
  }

  for (const result of par3Results) {
    if (!result.winnerPlayerId) continue;
    const payout = result.payoutAmount ?? 0;
    if (payout <= 0) continue;

    if ((result.payoutTarget ?? "PLAYER") === "PLAYER") {
      bonuses.set(
        result.winnerPlayerId,
        (bonuses.get(result.winnerPlayerId) ?? 0) + payout
      );
      continue;
    }

    const team = playerTeamMap.get(result.winnerPlayerId);
    if (!team || team.roundPlayers.length === 0) continue;

    const split = payout / team.roundPlayers.length;
    for (const roundPlayer of team.roundPlayers) {
      bonuses.set(
        roundPlayer.playerId,
        (bonuses.get(roundPlayer.playerId) ?? 0) + split
      );
    }
  }

  return bonuses;
}

export function computeSharedPar3TeamBonuses(
  teams: TeamLike[],
  par3Results: Par3ResultLike[]
) {
  const teamBonuses = new Map<string, number>();
  const playerTeamMap = new Map<string, TeamLike>();

  for (const team of teams) {
    teamBonuses.set(team.id, 0);
    for (const roundPlayer of team.roundPlayers) {
      playerTeamMap.set(roundPlayer.playerId, team);
    }
  }

  for (const result of par3Results) {
    if (!result.winnerPlayerId) continue;
    if ((result.payoutTarget ?? "PLAYER") !== "TEAM") continue;

    const payout = result.payoutAmount ?? 0;
    if (payout <= 0) continue;

    const team = playerTeamMap.get(result.winnerPlayerId);
    if (!team) continue;

    teamBonuses.set(team.id, (teamBonuses.get(team.id) ?? 0) + payout);
  }

  return teamBonuses;
}

export function computeFinalPlayerPayoutRows(
  teams: TeamPayoutLike[],
  roundPlayers: RoundPlayerLike[],
  par3Results: Par3ResultLike[]
) {
  const par3Bonuses = computePar3PlayerBonuses(teams, par3Results);
  const sharedPar3ByTeam = computeSharedPar3TeamBonuses(teams, par3Results);

  const baseMainGameShareByPlayer = new Map<string, number>();
  for (const team of teams) {
    const sharedPar3 = sharedPar3ByTeam.get(team.id) ?? 0;
    const mainGameTeamPayout = Math.max(0, team.totalPayout - sharedPar3);
    const split =
      team.roundPlayers.length > 0 ? mainGameTeamPayout / team.roundPlayers.length : 0;

    for (const roundPlayer of team.roundPlayers) {
      baseMainGameShareByPlayer.set(roundPlayer.playerId, split);
    }
  }

  return roundPlayers.map((roundPlayer) => {
    const mainGamePayout = baseMainGameShareByPlayer.get(roundPlayer.playerId) ?? 0;
    const par3Payout = par3Bonuses.get(roundPlayer.playerId) ?? 0;

    return {
      roundPlayerId: roundPlayer.id,
      playerId: roundPlayer.playerId,
      playerName: roundPlayer.player.nickname || roundPlayer.player.fullName,
      teamId: roundPlayer.team?.id ?? null,
      teamNumber: roundPlayer.team?.teamNumber ?? null,
      mainGamePayout,
      par3Payout,
      totalPayout: mainGamePayout + par3Payout,
    } satisfies FinalPlayerPayoutRow;
  });
}
