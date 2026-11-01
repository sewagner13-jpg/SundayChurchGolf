/** Saved server records only. Never mix this snapshot with local score-entry drafts. */
export interface SavedHoleScore {
  roundId: string; teamId: string; playerId: string; holeNumber: number; grossScore: number | null;
}
export interface VisibleHoleScores { hidden: boolean; scores: SavedHoleScore[]; }
export interface HoleScoreScope {
  roundId: string; holeNumber: number; visibility?: string; enabled: boolean;
}
export function createHoleScoreRefresh(
  scope: HoleScoreScope,
  read: () => Promise<VisibleHoleScores>,
  callbacks: {
    onData: (snapshot: VisibleHoleScores) => void;
    onError: (error: unknown) => void;
    onLoading?: () => void;
  }
) {
  let stopped = false;
  let inFlight = false;
  return {
    async refresh() {
      if (stopped || inFlight || !scope.enabled || scope.visibility !== "OPEN") return;
      inFlight = true;
      callbacks.onLoading?.();
      try {
        const result = await read();
        if (stopped) return;
        if (result.hidden) { callbacks.onData({hidden: true, scores: []}); return; }
        const scores = result.scores;
        if (scores.some(score => score.roundId !== scope.roundId || score.holeNumber !== scope.holeNumber)) {
          throw new Error("Score response did not match the requested round and hole");
        }
        callbacks.onData({hidden: false, scores});
      } catch (error) {
        if (!stopped) callbacks.onError(error);
      } finally {
        inFlight = false;
      }
    },
    stop() { stopped = true; },
  };
}
