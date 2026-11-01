import React from "react";

export interface BurgerListSnapshot {
  players: { playerId: string; playerName: string }[];
  selectedPlayerIds: string[];
}

export function BurgerListView({ players, selectedPlayerIds, expanded, saving, onExpand, onChange }: BurgerListSnapshot & {
  expanded: boolean;
  saving: boolean;
  onExpand: () => void;
  onChange: (playerId: string, selected: boolean) => void;
}) {
  const selected = new Set(selectedPlayerIds);
  const marked = players.filter((player) => selected.has(player.playerId));
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Burger List ({marked.length})</h2>
        <button type="button" aria-expanded={expanded} onClick={onExpand} className="min-h-12 rounded-xl border border-orange-300 bg-white px-4 py-3 text-sm font-semibold text-orange-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700">
          {expanded ? "Close list" : "Mark burgers"}
        </button>
      </div>
      <p className="mt-2 text-sm text-orange-950">Shared with everyone in this round. Marks save automatically.</p>
      <div aria-live="polite" className="mt-3">
        {marked.length ? <ul aria-label="Players ordering burgers" className="flex flex-wrap gap-2">
          {marked.map((player) => <li key={player.playerId} className="max-w-full break-words rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-950">{player.playerName}</li>)}
        </ul> : <p>No burger orders selected yet.</p>}
      </div>
      {expanded && <div className="mt-3 max-h-80 space-y-1 overflow-y-auto rounded border border-orange-200 bg-white p-2">
        {players.map((player) => <label key={player.playerId} className={`flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 py-3 ${selected.has(player.playerId) ? "bg-orange-50 text-orange-950" : "text-gray-900"}`}>
          <span>{player.playerName}</span>
          <input type="checkbox" aria-label={`Burger for ${player.playerName}`} checked={selected.has(player.playerId)} disabled={saving}
            onChange={(event) => onChange(player.playerId, event.target.checked)} className="h-6 w-6 shrink-0 accent-orange-700" />
        </label>)}
      </div>}
    </>
  );
}
