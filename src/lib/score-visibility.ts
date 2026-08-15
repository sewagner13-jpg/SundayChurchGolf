export function canRevealTeamScore({
  visibility,
  roundStatus,
  blindRevealMode,
  teamId,
  teamIdContext,
  holeComplete,
}: {
  visibility: string;
  roundStatus: string;
  blindRevealMode: string;
  teamId: string;
  teamIdContext?: string | null;
  holeComplete: boolean;
}) {
  if (visibility !== "BLIND" || roundStatus !== "LIVE") return true;
  if (teamId === teamIdContext) return true;
  return blindRevealMode === "REVEAL_AFTER_HOLE" && holeComplete;
}

export function canRevealHoleOutcome({
  visibility,
  roundStatus,
  blindRevealMode,
  holeComplete,
}: {
  visibility: string;
  roundStatus: string;
  blindRevealMode: string;
  holeComplete: boolean;
}) {
  if (visibility !== "BLIND" || roundStatus !== "LIVE") return true;
  return blindRevealMode === "REVEAL_AFTER_HOLE" && holeComplete;
}
