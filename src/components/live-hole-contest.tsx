"use client";

import { useEffect, useRef, useState } from "react";
import { getLiveHoleContest, saveLiveHoleContestWinner } from "@/actions/live-hole-contests";
import { createBurgerRefresh } from "@/lib/burger-refresh";
import { PAR3_CONTEST_TYPE_OPTIONS } from "@/lib/par3-contests";

type Snapshot = Awaited<ReturnType<typeof getLiveHoleContest>>;
interface Props { roundId: string; holeNumber: number; disabled?: boolean }

/** Remount the isolated shared control when navigating holes; scoring inputs stay untouched. */
export function LiveHoleContest(props: Props) {
  return <HoleContestControl key={`${props.roundId}:${props.holeNumber}`} {...props} />;
}

function HoleContestControl({ roundId, holeNumber, disabled = false }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [synchronized, setSynchronized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const mounted = useRef(false);
  const savingRef = useRef(false);
  const controller = useRef<ReturnType<typeof createBurgerRefresh<Snapshot>> | null>(null);

  useEffect(() => {
    mounted.current = true;
    const reader = createBurgerRefresh(
      () => getLiveHoleContest(roundId, holeNumber),
      (data) => { setSnapshot(data); setSynchronized(true); },
      () => { setSynchronized(false); setError("Could not refresh the shared winner. Refresh before changing it."); },
    );
    controller.current = reader;
    void reader.refresh();
    const interval = window.setInterval(() => { void reader.refresh(); }, 10000);
    const focus = () => { void reader.refresh(); };
    window.addEventListener("focus", focus);
    return () => {
      mounted.current = false;
      reader.stop();
      window.clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, [roundId, holeNumber]);

  async function change(value: string) {
    if (!snapshot || savingRef.current || disabled || !snapshot.editable || !synchronized) return;
    const winnerPlayerId = value || null;
    if (winnerPlayerId === snapshot.winnerPlayerId) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setNotice("Saving shared winner…");
    const reader = controller.current;
    reader?.pause();
    let failed = false;
    try {
      const saved = await saveLiveHoleContestWinner(roundId, holeNumber, winnerPlayerId, snapshot.winnerPlayerId);
      if (!mounted.current) return;
      setSnapshot(saved);
      setSynchronized(true);
      setNotice("Saved. Other groups see this winner within 10 seconds.");
    } catch (caught) {
      failed = true;
      if (!mounted.current) return;
      setSynchronized(false);
      setNotice("");
      setError(caught instanceof Error ? caught.message : "Winner was not confirmed saved. Refresh and choose again.");
    } finally {
      savingRef.current = false;
      reader?.resume();
      if (mounted.current) {
        setSaving(false);
        if (failed) void reader?.refresh();
      }
    }
  }

  if (snapshot && !snapshot.contest) return null;
  const label = PAR3_CONTEST_TYPE_OPTIONS.find((option) => option.value === snapshot?.contest?.contestType)?.label ?? "Hole contest";
  const winnerName = snapshot?.players.find((player) => player.playerId === snapshot.winnerPlayerId)?.playerName;
  return <section aria-label={`Shared hole ${holeNumber} contest`} className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
    <h3 className="font-semibold">Hole {holeNumber}: {label}</h3>
    <p className="mt-1 text-xs">Shared with every group. Leave the current winner or choose a new leader.</p>
    {snapshot ? <>
      <p className="mt-2">Current winner: <strong>{winnerName ?? "No winner yet"}</strong></p>
      <label className="mt-3 block font-medium" htmlFor={`contest-winner-${roundId}-${holeNumber}`}>Hole winner</label>
      <select id={`contest-winner-${roundId}-${holeNumber}`} value={snapshot.winnerPlayerId ?? ""}
        disabled={disabled || saving || !snapshot.editable || !synchronized}
        onChange={(event) => { void change(event.target.value); }}
        className="mt-1 min-h-11 w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-base disabled:opacity-60">
        <option value="">No winner yet</option>
        {snapshot.players.map((player) => <option key={player.playerId} value={player.playerId}>{player.playerName}</option>)}
      </select>
      <p className="mt-1 text-xs">Changes save immediately. Prizes are applied when the round finishes.</p>
    </> : <p role="status" className="mt-2">Loading shared winner…</p>}
    {notice && <p role="status" className="mt-2 text-xs">{notice}</p>}
    {error && <div role="alert" className="mt-2 text-red-800">
      <p>{error}</p>
      <button type="button" disabled={saving} className="min-h-11 underline" onClick={() => {
        setError(null); setNotice(""); void controller.current?.refresh();
      }}>Refresh shared winner</button>
    </div>}
  </section>;
}
