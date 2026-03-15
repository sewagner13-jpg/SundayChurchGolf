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
