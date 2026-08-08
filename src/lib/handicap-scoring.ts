export function getPlayingHandicap(handicapIndex: number | null | undefined) {
  if (handicapIndex === null || handicapIndex === undefined) return null;

  const sign = handicapIndex < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(handicapIndex));
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

  return sign * (baseStrokes + (handicapRank <= remainder ? 1 : 0));
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
