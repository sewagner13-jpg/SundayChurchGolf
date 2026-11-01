"use client";

import { useEffect, useRef, useState } from "react";
import { getRoundBurgerOrders, updateRoundBurgerOrder } from "@/actions/burger-orders";
import { createBurgerRefresh } from "@/lib/burger-refresh";
import { BurgerListView, type BurgerListSnapshot } from "@/components/burger-list-view";

export function SharedBurgerList({ roundId, prompt = false }: { roundId: string; prompt?: boolean }) {
  const [snapshot, setSnapshot] = useState<BurgerListSnapshot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const savingRef = useRef(false);
  const controller = useRef<ReturnType<typeof createBurgerRefresh<BurgerListSnapshot>> | null>(null);
  const activeRound = useRef<string | null>(null);

  useEffect(() => { if (prompt) setExpanded(true); }, [prompt]);
  useEffect(() => {
    activeRound.current = roundId;
    setSnapshot(null);
    setError(null);
    const reader = createBurgerRefresh(
      () => getRoundBurgerOrders(roundId),
      (data) => { setSnapshot(data); setError(null); },
      () => setError("Could not refresh the shared list. Displayed names may be out of date.")
    );
    controller.current = reader;
    void reader.refresh();
    const interval = window.setInterval(() => { void reader.refresh(); }, 10000);
    const focus = () => { void reader.refresh(); };
    window.addEventListener("focus", focus);
    return () => {
      activeRound.current = null;
      reader.stop();
      window.clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, [roundId]);

  async function change(playerId: string, selected: boolean) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setNotice("Saving burger mark…");
    const reader = controller.current;
    reader?.pause();
    try {
      const data = await updateRoundBurgerOrder(roundId, playerId, selected);
      if (activeRound.current !== roundId) return;
      setSnapshot(data);
      setNotice("Saved. Other viewers refresh automatically within 10 seconds.");
    } catch {
      if (activeRound.current !== roundId) return;
      setError("Burger mark was not confirmed saved. Refresh the list before trying again.");
      setNotice("");
    } finally {
      savingRef.current = false;
      reader?.resume();
      if (activeRound.current === roundId) setSaving(false);
    }
  }

  return <section aria-label="Shared burger list" className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
    {snapshot ? <BurgerListView {...snapshot} expanded={expanded} saving={saving}
      onExpand={() => { setExpanded(!expanded); void controller.current?.refresh(); }} onChange={change} />
      : <p>Loading shared burger list…</p>}
    {notice && <p role="status" className="mt-2 text-xs">{notice}</p>}
    {error && <div role="alert" className="mt-2 text-red-800"><p>{error}</p>
      <button type="button" disabled={saving} onClick={() => { setNotice(""); void controller.current?.refresh(); }} className="underline">Refresh list</button>
    </div>}
  </section>;
}
