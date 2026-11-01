"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVisibleCrossHoleScores } from "../actions/visible-cross-hole-scores";
import { createHoleScoreRefresh, type SavedHoleScore } from "../lib/hole-score-refresh";

interface Snapshot {
  key: string; hidden: boolean; scores: SavedHoleScore[]; loading: boolean; lastUpdated: number | null; error: string | null;
}

/** Polls saved current-hole scores without touching the editable local scoring form. */
export function useHoleScoreSnapshot({ roundId, holeNumber, visibility, enabled }: {
  roundId: string; holeNumber: number; visibility?: string; enabled: boolean;
}) {
  const allowed = enabled && visibility === "OPEN";
  const key = `${roundId}:${holeNumber}:${allowed}`;
  const [snapshot, setSnapshot] = useState<Snapshot>({key, hidden: !allowed, scores: [], loading: allowed, lastUpdated: null, error: null});
  const controller = useRef<ReturnType<typeof createHoleScoreRefresh> | null>(null);
  useEffect(() => {
    setSnapshot({key, hidden: !allowed, scores: [], loading: allowed, lastUpdated: null, error: null});
    if (!allowed) { controller.current = null; return; }
    const reader = createHoleScoreRefresh({roundId, holeNumber, visibility, enabled},
      () => getVisibleCrossHoleScores(roundId, holeNumber), {
        onLoading: () => setSnapshot(previous => ({...previous, loading: true})),
        onData: result => setSnapshot({key, hidden: result.hidden, scores: result.scores, loading: false, lastUpdated: Date.now(), error: null}),
        onError: () => setSnapshot(previous => ({...previous, scores: [], lastUpdated: null, loading: false, error: "Could not refresh scores. Saved scores are hidden until refresh succeeds."})),
      });
    controller.current = reader;
    void reader.refresh();
    const timer = window.setInterval(() => { void reader.refresh(); }, 10000);
    const focus = () => { void reader.refresh(); };
    window.addEventListener("focus", focus);
    return () => { reader.stop(); window.clearInterval(timer); window.removeEventListener("focus", focus); if (controller.current === reader) controller.current = null; };
  }, [roundId, holeNumber, visibility, enabled, allowed, key]);
  const refresh = useCallback(() => controller.current?.refresh(), []);
  // Prevent a previous hole/visibility snapshot being painted before the effect cleans up.
  const current = snapshot.key === key && allowed ? snapshot : {key, hidden: !allowed, scores: [], loading: allowed, lastUpdated: null, error: null};
  return {...current, hidden: !allowed || current.hidden, refresh};
}
