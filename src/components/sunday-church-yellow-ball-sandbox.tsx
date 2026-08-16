"use client";

import { useMemo, useState } from "react";

import { HandicapStrokeCard } from "@/components/handicap-stroke-card";
import { SundayChurchYellowBallGrid } from "@/components/sunday-church-yellow-ball-grid";
import {
  computeSundayChurchYellowBallHoleData,
  getSundayChurchYellowBallCarrier,
  type SundayChurchYellowBallHoleData,
} from "@/lib/sunday-church-yellow-ball-skins";

const PLAYERS = [
  { playerId: "a1", name: "Albert", teamId: "team-a", handicap: 6 },
  { playerId: "a2", name: "Eddie", teamId: "team-a", handicap: 9 },
  { playerId: "a3", name: "Griff", teamId: "team-a", handicap: 12 },
  { playerId: "a4", name: "Mike", teamId: "team-a", handicap: 15 },
  { playerId: "b1", name: "Jim", teamId: "team-b", handicap: 7 },
  { playerId: "b2", name: "David", teamId: "team-b", handicap: 10 },
  { playerId: "b3", name: "Tony", teamId: "team-b", handicap: 13 },
  { playerId: "b4", name: "Sean", teamId: "team-b", handicap: 16 },
] as const;
const TEAMS = [
  { id: "team-a", teamNumber: 1, label: "Team Alpha" },
  { id: "team-b", teamNumber: 2, label: "Team Bravo" },
];
const HOLES = Array.from({ length: 18 }, (_, index) => ({
  holeNumber: index + 1,
  par: index === 4 || index === 17 ? 5 : 4,
  handicapRank: index + 1,
}));
const HANDICAPS = Object.fromEntries(
  PLAYERS.map((player) => [player.playerId, player.handicap])
);
const NAMES = new Map<string, string>(
  PLAYERS.map((player) => [player.playerId, player.name])
);

type TeamInputs = Record<
  string,
  { yellowGross: string; scrambleGross: string; manualCarrierId?: string }
>;
type SavedScores = Record<number, Record<string, SundayChurchYellowBallHoleData>>;

function teamPlayers(teamId: string) {
  return PLAYERS.filter((player) => player.teamId === teamId);
}

function startingInputs(holeNumber: number): TeamInputs {
  if (holeNumber === 1) {
    return {
      "team-a": { yellowGross: "4", scrambleGross: "4" },
      "team-b": { yellowGross: "5", scrambleGross: "4" },
    };
  }
  if (holeNumber === 2) {
    return {
      "team-a": { yellowGross: "4", scrambleGross: "4" },
      "team-b": { yellowGross: "5", scrambleGross: "4" },
    };
  }
  return {
    "team-a": { yellowGross: "", scrambleGross: "" },
    "team-b": { yellowGross: "", scrambleGross: "" },
  };
}

export function SundayChurchYellowBallSandbox() {
  const [ordersLocked, setOrdersLocked] = useState(false);
  const [orders] = useState<Record<string, string[]>>({
    "team-a": ["a1", "a2", "a3", "a4"],
    "team-b": ["b1", "b2", "b3", "b4"],
  });
  const [currentHole, setCurrentHole] = useState(1);
  const [inputs, setInputs] = useState<TeamInputs>(() => startingInputs(1));
  const [savedScores, setSavedScores] = useState<SavedScores>({});
  const [feedback, setFeedback] = useState("");
  const courseHole = HOLES[currentHole - 1];

  const hole17Carrier = (teamId: string) =>
    savedScores[17]?.[teamId]?.designatedPlayerId ?? null;
  const getCarrier = (teamId: string) => {
    try {
      return getSundayChurchYellowBallCarrier({
        holeNumber: currentHole,
        yellowBallOrder: orders[teamId],
        designatedPlayerId: inputs[teamId]?.manualCarrierId,
        previousDesignatedPlayerId: hole17Carrier(teamId),
      });
    } catch {
      return null;
    }
  };
  const preview = (teamId: string) => {
    const input = inputs[teamId];
    const carrierId = getCarrier(teamId);
    if (!carrierId || !input?.yellowGross || !input.scrambleGross) return null;
    try {
      return computeSundayChurchYellowBallHoleData({
        designatedPlayerId: carrierId,
        yellowBallGrossScore: Number(input.yellowGross),
        scrambleGrossScore: Number(input.scrambleGross),
        playerHandicapIndexes: HANDICAPS,
        handicapRank: courseHole.handicapRank,
        useYellowBallHandicaps: true,
      });
    } catch {
      return null;
    }
  };

  const scoring = useMemo(() => {
    const holeResults = HOLES.map((hole) => {
      const scores = savedScores[hole.holeNumber];
      if (!scores || TEAMS.some((team) => !scores[team.id])) {
        return { holeNumber: hole.holeNumber, winnerTeamId: null, isTie: false };
      }
      const lowest = Math.min(...TEAMS.map((team) => scores[team.id].combinedScore));
      const winners = TEAMS.filter(
        (team) => scores[team.id].combinedScore === lowest
      );
      if (winners.length !== 1) {
        return { holeNumber: hole.holeNumber, winnerTeamId: null, isTie: true };
      }
      return { holeNumber: hole.holeNumber, winnerTeamId: winners[0].id, isTie: false };
    });
    return { holeResults };
  }, [savedScores]);
  const resultMap = new Map(
    scoring.holeResults.map((result) => [result.holeNumber, result])
  );
  const gridData = {
    teams: TEAMS.map((team) => ({
      teamId: team.id,
      teamNumber: team.teamNumber,
      label: team.label,
      players: teamPlayers(team.id).map((player) => player.name),
    })),
    holes: HOLES.map((hole) => {
      const result = resultMap.get(hole.holeNumber);
      return {
        holeNumber: hole.holeNumber,
        par: hole.par,
        isTie: result?.isTie ?? false,
        winnerTeamIds: result?.winnerTeamId ? [result.winnerTeamId] : [],
        teamScores: TEAMS.map((team) => {
          const data = savedScores[hole.holeNumber]?.[team.id];
          return {
            teamId: team.id,
            yellowBall: data
              ? {
                  designatedPlayerName: NAMES.get(data.designatedPlayerId) ?? "Yellow ball",
                  yellowBallNetScore: data.yellowBallNetScore,
                  scrambleGrossScore: data.scrambleGrossScore,
                  combinedScore: data.combinedScore,
                  handicapApplied: data.handicapApplied,
                }
              : null,
          };
        }),
      };
    }),
  };

  const changeHole = (holeNumber: number) => {
    setCurrentHole(holeNumber);
    setInputs(() => {
      const next = startingInputs(holeNumber);
      for (const team of TEAMS) {
        const saved = savedScores[holeNumber]?.[team.id];
        if (saved) {
          next[team.id] = {
            yellowGross: String(saved.yellowBallGrossScore),
            scrambleGross: String(saved.scrambleGrossScore),
            manualCarrierId: saved.designatedPlayerId,
          };
        }
      }
      return next;
    });
    setFeedback("");
  };
  const updateInput = (teamId: string, key: string, value: string) => {
    setInputs((current) => ({
      ...current,
      [teamId]: { ...current[teamId], [key]: value.replace(/\D/g, "") },
    }));
  };
  const selectCarrier = (teamId: string, playerId: string) => {
    setInputs((current) => ({
      ...current,
      [teamId]: { ...current[teamId], manualCarrierId: playerId },
    }));
  };
  const saveHole = () => {
    const next = Object.fromEntries(
      TEAMS.map((team) => [team.id, preview(team.id)])
    ) as Record<string, SundayChurchYellowBallHoleData | null>;
    if (Object.values(next).some((score) => !score)) {
      setFeedback("Choose each carrier and enter both gross scores for both teams.");
      return;
    }
    setSavedScores((current) => ({
      ...current,
      [currentHole]: next as Record<string, SundayChurchYellowBallHoleData>,
    }));
    const first = next["team-a"]!;
    const second = next["team-b"]!;
    if (first.combinedScore === second.combinedScore) {
      setFeedback(`Hole ${currentHole} tied. Two tie, all tie; the skin carries.`);
    } else {
      const winner = first.combinedScore < second.combinedScore ? "Team Alpha" : "Team Bravo";
      const pendingCarry = currentHole === 2 && savedScores[1] ? 2 : 1;
      setFeedback(`${winner} wins ${pendingCarry} skin${pendingCarry === 1 ? "" : "s"} on Hole ${currentHole}.`);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-4">
      <header className="border-b border-gray-300 pb-4">
        <h1 className="text-2xl font-bold text-gray-950">Sunday Church Yellow Ball Skins Sandbox</h1>
        <p className="mt-1 text-sm text-gray-600">$30 buy-in x 8 players = $240 pot. Sandbox data only.</p>
      </header>

      <HandicapStrokeCard
        players={teamPlayers("team-a").map(({ playerId, name }) => ({
          playerId,
          name,
        }))}
        playerHandicapIndexes={HANDICAPS}
        holes={HOLES}
        currentHole={currentHole}
        strokeDisplay="dots"
        title="Yellow Ball Handicap Shots"
      />

      {!ordersLocked ? (
        <section className="py-5">
          <h2 className="text-lg font-bold">Lock Yellow Ball Orders</h2>
          <p className="text-sm text-gray-600">Each four-player order repeats on holes 1-16.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {TEAMS.map((team) => (
              <div key={team.id} className="border-y border-gray-300 py-2">
                <h3 className="font-semibold">{team.label}</h3>
                {orders[team.id].map((playerId, index) => (
                  <p key={playerId} className="border-b border-gray-200 py-2 text-sm">
                    <strong>{index + 1}</strong> {NAMES.get(playerId)} - Holes {index + 1}, {index + 5}, {index + 9}, {index + 13}
                  </p>
                ))}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setOrdersLocked(true)} className="mt-4 bg-gray-900 px-4 py-3 font-semibold text-white">
            Lock Both Orders
          </button>
        </section>
      ) : (
        <>
          <section className="py-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-gray-600">Enter gross scores. Handicap applies only to yellow ball.</p>
                <h2 className="text-xl font-bold">Hole {currentHole} - Par {courseHole.par} - HCP {courseHole.handicapRank}</h2>
              </div>
            </div>
            <div className="mt-3 flex max-w-full gap-1 overflow-x-auto pb-2">
              {HOLES.map((hole) => (
                <button key={hole.holeNumber} type="button" aria-label={`Hole ${hole.holeNumber}`} onClick={() => changeHole(hole.holeNumber)} className={`h-9 min-w-9 border text-sm ${hole.holeNumber === currentHole ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white"}`}>
                  {hole.holeNumber}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {TEAMS.map((team) => {
                const teamPreview = preview(team.id);
                const carrierId = getCarrier(team.id);
                return (
                  <article key={team.id} className="border border-gray-300 p-3">
                    <h3 className="font-bold">{team.label}</h3>
                    {currentHole >= 17 ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {teamPlayers(team.id).map((player) => {
                          const disabled = currentHole === 18 && player.playerId === hole17Carrier(team.id);
                          return (
                            <button key={player.playerId} type="button" aria-label={`${team.label} carrier ${player.name}`} disabled={disabled} onClick={() => selectCarrier(team.id, player.playerId)} className={`border px-2 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400 ${inputs[team.id]?.manualCarrierId === player.playerId ? "border-yellow-500 bg-yellow-300" : "border-gray-300"}`}>
                              {player.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 border-l-4 border-yellow-400 bg-yellow-50 px-2 py-2 text-sm">Yellow ball: <strong>{NAMES.get(carrierId ?? "")}</strong></p>
                    )}
                    {currentHole === 18 && (
                      <p className="mt-2 text-xs text-gray-600">Hole 18 must use a different yellow-ball player than Hole 17.</p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="text-sm font-medium">Yellow-ball gross<input aria-label={`${team.label} yellow-ball gross`} inputMode="numeric" value={inputs[team.id]?.yellowGross ?? ""} onChange={(event) => updateInput(team.id, "yellowGross", event.target.value)} className="mt-1 h-11 w-full border border-gray-300 px-2 text-center text-lg" /></label>
                      <label className="text-sm font-medium">Scramble gross<input aria-label={`${team.label} scramble gross`} inputMode="numeric" value={inputs[team.id]?.scrambleGross ?? ""} onChange={(event) => updateInput(team.id, "scrambleGross", event.target.value)} className="mt-1 h-11 w-full border border-gray-300 px-2 text-center text-lg" /></label>
                    </div>
                    <div className="mt-3 grid grid-cols-3 border border-gray-200 bg-gray-50 text-center text-sm">
                      <p className="p-2"><span className="block text-xs text-gray-500">Shots</span><strong>{teamPreview?.strokesReceived ?? "-"}</strong></p>
                      <p className="border-x p-2"><span className="block text-xs text-gray-500">Yellow net</span><strong>{teamPreview?.yellowBallNetScore ?? "-"}</strong></p>
                      <p className="p-2"><span className="block text-xs text-gray-500">Team total</span><strong>{teamPreview ? `${teamPreview.combinedScore}${teamPreview.handicapApplied ? "•" : ""}` : "-"}</strong></p>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <button type="button" onClick={saveHole} className="bg-gray-900 px-4 py-3 font-semibold text-white">Save Gross Scores</button>
              <p role="status" className="text-sm font-medium text-gray-800">{feedback}</p>
            </div>
          </section>

          <section className="border-t border-gray-300 py-5">
            <h2 className="mb-3 text-lg font-bold">Live Team Scores</h2>
            <SundayChurchYellowBallGrid data={gridData} currentHole={currentHole} />
          </section>
        </>
      )}
    </main>
  );
}
