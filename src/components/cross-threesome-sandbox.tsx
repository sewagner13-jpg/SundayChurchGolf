"use client";

import { useMemo, useState } from "react";
import {
  calculateCrossThreesome666PlayerPayouts,
  computeCrossThreesome666GameSummaries,
  getCrossThreesome666Pairings,
} from "@/lib/cross-threesome-666";
import {
  getNetScore,
  getRelativePlayingHandicaps,
  getStrokesReceivedForHole,
} from "@/lib/handicap-scoring";

const PLAYERS = [
  { playerId: "albert", name: "Albert", group: "A", slot: "A1", handicap: 6 },
  { playerId: "eddie", name: "Eddie", group: "A", slot: "A2", handicap: 9 },
  { playerId: "griff", name: "Griff", group: "A", slot: "A3", handicap: 12 },
  { playerId: "jim", name: "Jim", group: "B", slot: "B1", handicap: 10 },
  { playerId: "david", name: "David", group: "B", slot: "B2", handicap: 8 },
  { playerId: "tony", name: "Tony", group: "B", slot: "B3", handicap: 11 },
] as const;

const FORMAT_CONFIG = {
  crossThreesome666: {
    scoreMode: "best_net_ball" as const,
    threesomeA: { A1: "albert", A2: "eddie", A3: "griff" },
    threesomeB: { B1: "jim", B2: "david", B3: "tony" },
  },
};

const HOLES = Array.from({ length: 18 }, (_, index) => ({
  holeNumber: index + 1,
  handicapRank: index + 1,
}));
const HANDICAPS = Object.fromEntries(
  PLAYERS.map((player) => [player.playerId, player.handicap])
);
const RELATIVE_HANDICAPS = getRelativePlayingHandicaps(HANDICAPS);
const PLAYER_NAMES = new Map<string, string>(
  PLAYERS.map((player) => [player.playerId, player.name])
);
const PAIRINGS = getCrossThreesome666Pairings(FORMAT_CONFIG);
const BUY_IN_PER_PLAYER = 30;
const TOTAL_POT = BUY_IN_PER_PLAYER * PLAYERS.length;

function buildDefaultGrossScores() {
  return Object.fromEntries(
    HOLES.map(({ holeNumber }) => {
      const game = PAIRINGS.find((entry) => entry.holeNumbers.includes(holeNumber));
      const scores = Object.fromEntries(PLAYERS.map((player) => [player.playerId, "6"]));

      if (holeNumber % 4 === 0) {
        for (const player of PLAYERS) scores[player.playerId] = "5";
      } else if (game) {
        const winningPair = game.pairs[(holeNumber - 1) % game.pairs.length];
        scores[winningPair.playerIds[0]] = "4";
      }

      return [holeNumber, scores];
    })
  ) as Record<number, Record<string, string>>;
}

function pairName(playerIds: readonly [string, string]) {
  return playerIds.map((playerId) => PLAYER_NAMES.get(playerId) ?? playerId).join(" / ");
}

function strokeLabel(strokes: number | null) {
  if (strokes === null) return "No handicap";
  if (strokes === 0) return "No shot";
  return `${strokes} shot${strokes === 1 ? "" : "s"}`;
}

function money(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export function CrossThreesomeSandbox() {
  const [currentHole, setCurrentHole] = useState(1);
  const [grossScores, setGrossScores] = useState(buildDefaultGrossScores);
  const currentHandicapRank = HOLES[currentHole - 1].handicapRank;
  const playerScores = useMemo(
    () =>
      HOLES.flatMap(({ holeNumber }) =>
        PLAYERS.map((player) => {
          const rawScore = grossScores[holeNumber][player.playerId];
          return {
            playerId: player.playerId,
            holeNumber,
            grossScore: rawScore === "" ? null : Number(rawScore),
          };
        })
      ),
    [grossScores]
  );
  const summaries = computeCrossThreesome666GameSummaries({
    formatConfig: FORMAT_CONFIG,
    playerScores,
    playerHandicapIndexes: HANDICAPS,
    courseHandicapRanks: Object.fromEntries(
      HOLES.map((hole) => [hole.holeNumber, hole.handicapRank])
    ),
    totalPot: TOTAL_POT,
  });
  const playerPayouts = calculateCrossThreesome666PlayerPayouts(summaries);
  const currentGame = summaries.find((game) => game.holeNumbers.includes(currentHole));
  const currentOutcome = currentGame?.holeOutcomes.find(
    (outcome) => outcome.holeNumber === currentHole
  );
  const winningPair = currentOutcome?.winningVirtualTeamId
    ? currentGame?.pairs.find(
        (pair) => pair.virtualTeamId === currentOutcome.winningVirtualTeamId
      )
    : null;
  const resultMessage = !currentOutcome?.isComplete
    ? `Hole ${currentHole} is waiting for all six gross scores.`
    : currentOutcome.isTie
      ? `Two tie, all tie. No team wins hole ${currentHole}.`
      : `${pairName(winningPair!.playerIds)} wins hole ${currentHole}`;

  const updateGrossScore = (playerId: string, value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 2);
    setGrossScores((current) => ({
      ...current,
      [currentHole]: { ...current[currentHole], [playerId]: sanitized },
    }));
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-950">Cross-Threesome 6-6-6 Sandbox</h1>
        <p className="mt-1 text-sm text-gray-600">Sandbox data only. No round records are saved.</p>
      </header>

      <section className="grid gap-4 border-b border-gray-200 py-5 md:grid-cols-2">
        {["A", "B"].map((group) => (
          <div key={group}>
            <h2 className="font-semibold text-gray-900">Threesome {group}</h2>
            <div className="mt-2 divide-y divide-gray-200 border-y border-gray-200">
              {PLAYERS.filter((player) => player.group === group).map((player) => (
                <div key={player.playerId} className="flex items-center justify-between py-2 text-sm">
                  <span><strong>{player.slot}</strong> · {player.name}</span>
                  <span className="text-gray-600">HCP {player.handicap} · Plays {RELATIVE_HANDICAPS[player.playerId]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="border-b border-gray-200 py-5">
        <h2 className="font-semibold text-gray-900">Rotating Pairings</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {PAIRINGS.map((game) => (
            <div key={game.id} className={`border-l-4 px-3 py-2 ${
              game.holeNumbers.includes(currentHole) ? "border-green-700 bg-green-50" : "border-gray-300"
            }`}>
              <p className="font-medium">{game.label}</p>
              {game.pairs.map((pair) => <p key={pair.virtualTeamId} className="text-sm text-gray-700">{pairName(pair.playerIds)}</p>)}
            </div>
          ))}
        </div>
      </section>

      <section className="py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-gray-600">{currentGame?.label} · Match play · two tie, all tie</p>
            <h2 className="text-xl font-bold">Hole {currentHole} · Par 4 · HCP {currentHandicapRank}</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous hole" title="Previous hole" onClick={() => setCurrentHole((hole) => Math.max(1, hole - 1))} disabled={currentHole === 1} className="h-10 w-10 border border-gray-300 bg-white text-lg disabled:opacity-30">←</button>
            <button type="button" aria-label="Next hole" title="Next hole" onClick={() => setCurrentHole((hole) => Math.min(18, hole + 1))} disabled={currentHole === 18} className="h-10 w-10 border border-gray-300 bg-white text-lg disabled:opacity-30">→</button>
          </div>
        </div>

        <div className="mt-4 flex gap-1 overflow-x-auto pb-2">
          {HOLES.map((hole) => (
            <button key={hole.holeNumber} type="button" aria-label={`Hole ${hole.holeNumber}`} onClick={() => setCurrentHole(hole.holeNumber)} className={`h-9 min-w-9 border text-sm font-medium ${hole.holeNumber === currentHole ? "border-green-700 bg-green-700 text-white" : "border-gray-300 bg-white"}`}>{hole.holeNumber}</button>
          ))}
        </div>

        <div className="mt-4 border-y border-emerald-200 bg-emerald-50 px-3 py-3">
          <p className="text-sm font-semibold text-emerald-950">Lowest handicap plays from zero</p>
          <p className="text-sm text-emerald-900"><strong>Enter gross scores only</strong>. Net scores are calculated automatically.</p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead><tr className="border-b border-gray-300 text-left"><th className="py-2">Player</th><th>Group</th><th>Playing HCP</th><th>Gross</th><th>Hole calculation</th></tr></thead>
            <tbody>
              {PLAYERS.map((player) => {
                const grossValue = grossScores[currentHole][player.playerId];
                const gross = grossValue === "" ? null : Number(grossValue);
                const strokes = getStrokesReceivedForHole(RELATIVE_HANDICAPS[player.playerId], currentHandicapRank);
                const net = getNetScore({ grossScore: gross, handicapIndex: RELATIVE_HANDICAPS[player.playerId], handicapRank: currentHandicapRank });
                return (
                  <tr key={player.playerId} className="border-b border-gray-200">
                    <th scope="row" className="py-3 text-left font-medium">{player.name}</th>
                    <td>{player.group}</td><td>{RELATIVE_HANDICAPS[player.playerId]}</td>
                    <td><input aria-label={`Gross score for ${player.name}`} inputMode="numeric" value={grossValue} onChange={(event) => updateGrossScore(player.playerId, event.target.value)} className="w-16 border border-gray-300 px-2 py-1 text-center text-base" /></td>
                    <td className="text-emerald-800">{gross === null || net === null ? strokeLabel(strokes) : `Gross ${gross} · ${strokeLabel(strokes)} · Net ${net}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-y border-gray-200 py-5" aria-live="polite">
        <h2 className={`text-lg font-bold ${currentOutcome?.isTie ? "text-amber-800" : "text-green-800"}`}>{resultMessage}</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {currentOutcome?.pairScores.map((pair) => (
            <div key={pair.virtualTeamId} className={`border px-3 py-2 ${pair.virtualTeamId === currentOutcome.winningVirtualTeamId ? "border-green-600 bg-green-50" : "border-gray-200"}`}>
              <p className="font-medium">{pairName(pair.playerIds)}</p>
              <p className="text-sm text-gray-600">Best net {pair.bestBallScore ?? "Pending"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-5">
        <h2 className="font-semibold">{currentGame?.label} Standings</h2>
        <div className="mt-2 divide-y divide-gray-200 border-y border-gray-200">
          {currentGame?.pairs.map((pair) => (
            <div key={pair.virtualTeamId} className="flex justify-between py-2 text-sm"><span>{pairName(pair.playerIds)}</span><strong>{pair.holesWon} hole{pair.holesWon === 1 ? "" : "s"} won</strong></div>
          ))}
        </div>
      </section>

      <section className="border-t border-gray-200 py-5">
        <h2 className="text-xl font-bold">Payout Breakdown</h2>
        <p className="mt-1 text-sm font-medium text-gray-900">
          {money(BUY_IN_PER_PLAYER)} buy-in × {PLAYERS.length} players = {money(TOTAL_POT)} total pot
        </p>
        <p className="text-sm text-gray-600">
          {summaries.length} games at {money(TOTAL_POT / summaries.length)} each
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {summaries.map((game) => {
            const paidPairs = game.pairs.filter((pair) => pair.payout > 0);
            return (
              <article key={game.id} className="border border-gray-300 p-3">
                <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-2">
                  <h3 className="font-semibold">{game.label}</h3>
                  <span className="text-sm font-medium">{money(game.gamePot)} pot</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                  {game.holeOutcomes.map((outcome) => {
                    const winner = outcome.winningVirtualTeamId
                      ? game.pairs.find(
                          (pair) => pair.virtualTeamId === outcome.winningVirtualTeamId
                        )
                      : null;
                    return (
                      <div key={outcome.holeNumber} className="border border-gray-200 px-1 py-2 text-center">
                        <span className="block font-semibold">H{outcome.holeNumber}</span>
                        <span>{outcome.isTie ? "Tie" : winner ? pairName(winner.playerIds) : "Pending"}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-gray-600">
                  Most holes won takes this game. Co-winners split its pot equally.
                </p>
                <div className="mt-2 space-y-2">
                  {paidPairs.map((pair) => (
                    <p key={pair.virtualTeamId} className="text-sm font-medium text-green-800">
                      {pairName(pair.playerIds)} · {pair.holesWon} holes won · {money(pair.payout)} pair · {money(pair.payout / 2)} each
                    </p>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-5 max-w-md">
          <h3 className="font-semibold">Player Totals</h3>
          <table className="mt-2 w-full border-y border-gray-300 text-sm">
            <tbody>
              {[...PLAYERS]
                .sort(
                  (first, second) =>
                    (playerPayouts.get(second.playerId) ?? 0) -
                      (playerPayouts.get(first.playerId) ?? 0) ||
                    first.name.localeCompare(second.name)
                )
                .map((player) => (
                  <tr key={player.playerId} className="border-b border-gray-200">
                    <th scope="row" className="py-2 text-left font-medium">{player.name}</th>
                    <td className="py-2 text-right font-bold">{money(playerPayouts.get(player.playerId) ?? 0)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
