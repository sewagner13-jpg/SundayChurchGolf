export function getPlayingHandicap(handicapIndex: number | null | undefined) {
  if (handicapIndex === null || handicapIndex === undefined) return null;

  const sign = handicapIndex < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(handicapIndex));
}

export function getRelativePlayingHandicaps(
  playerHandicapIndexes: Record<string, number | null | undefined>
) {
  const playingHandicaps = Object.fromEntries(
    Object.entries(playerHandicapIndexes).map(([playerId, handicapIndex]) => [
      playerId,
      getPlayingHandicap(handicapIndex),
    ])
  ) as Record<string, number | null>;
  const validHandicaps = Object.values(playingHandicaps).filter(
    (handicap): handicap is number => handicap !== null
  );

  if (validHandicaps.length === 0) return playingHandicaps;

  const lowestHandicap = Math.min(...validHandicaps);
  return Object.fromEntries(
    Object.entries(playingHandicaps).map(([playerId, playingHandicap]) => [
      playerId,
      playingHandicap === null ? null : playingHandicap - lowestHandicap,
    ])
  ) as Record<string, number | null>;
}

export function getStrokesReceivedForHole(
  handicapIndex: number | null | undefined,
  handicapRank: number | null | undefined
) {
  const playingHandicap = getPlayingHandicap(handicapIndex);
  if (playingHandicap === null || !handicapRank || handicapRank < 1 || handicapRank > 18) {
    return null;
  }

  const sign = playingHandicap < 0 ? -1 : 1;
  const absoluteHandicap = Math.abs(playingHandicap);
  const baseStrokes = Math.floor(absoluteHandicap / 18);
  const remainder = absoluteHandicap % 18;

  const allocationRank = sign < 0 ? 19 - handicapRank : handicapRank;
  const strokes = baseStrokes + (allocationRank <= remainder ? 1 : 0);
  return strokes === 0 ? 0 : sign * strokes;
}

export function getNetScore({
  grossScore,
  handicapIndex,
  handicapRank,
}: {
  grossScore: number | null;
  handicapIndex: number | null | undefined;
  handicapRank: number | null | undefined;
}) {
  if (grossScore === null) return null;

  const strokesReceived = getStrokesReceivedForHole(handicapIndex, handicapRank);
  return strokesReceived === null ? null : grossScore - strokesReceived;
}


export function getPlayingHandicaps(indexes: Record<string, number | null | undefined>, mode: "relative" | "full" = "relative") {
  return mode === "full"
    ? Object.fromEntries(Object.entries(indexes).map(([id, index]) => [id, getPlayingHandicap(index)]))
    : getRelativePlayingHandicaps(indexes);
}
