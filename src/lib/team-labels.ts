export interface TeamLabelPlayerLike {
  player: {
    fullName: string;
    nickname: string | null;
  };
}

export function getTeamDisplayLabel(players: TeamLabelPlayerLike[]) {
  return players
    .map((entry) => {
      const preferredName = entry.player.nickname || entry.player.fullName;
      return preferredName.trim().split(/\s+/)[0] ?? preferredName;
    })
    .join(" / ");
}
