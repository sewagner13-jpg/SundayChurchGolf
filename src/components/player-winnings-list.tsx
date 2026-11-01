import type { PlayerWinnings } from "@/lib/player-winnings";

function money(cents: number) {
  return `${cents < 0 ? "−" : ""}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function PlayerWinningsList({ rows }: { rows: PlayerWinnings[] }) {
  return (
    <ul className="space-y-3" aria-label="Player winnings">
      {rows.map(player => (
        <li key={player.roundPlayerId}>
          <article aria-label={`${player.playerName} winnings`} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <header className="flex items-center justify-between gap-3 bg-green-50 px-4 py-4">
              <h2 className="min-w-0 break-words text-lg font-bold text-gray-900">{player.playerName}</h2>
              <p className="shrink-0 text-2xl font-bold tabular-nums text-green-800" aria-label={`Total won ${money(player.totalCents)}`}>{money(player.totalCents)}</p>
            </header>
            <div className="px-4 py-3">
              {player.items.length === 0 ? <p className="text-sm text-gray-500">No bets won</p> : (
                <dl className="space-y-2 text-sm">
                  {player.items.map(item => (
                    <div key={item.id} className={`flex items-start justify-between gap-4 ${item.kind === "adjustment" ? "border-t border-gray-200 pt-2 text-amber-800" : "text-gray-700"}`}>
                      <dt>{item.label}</dt>
                      <dd className="shrink-0 font-semibold tabular-nums">{money(item.amountCents)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
