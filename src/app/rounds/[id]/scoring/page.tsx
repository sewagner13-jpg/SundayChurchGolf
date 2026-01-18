"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmModal } from "@/components/modal";
import { getRound } from "@/actions/rounds";
import { upsertHoleScore, getHoleView, finishRound, getTeamScorecard } from "@/actions/scoring";
import { getScoringOrder } from "@/lib/scoring-engine";
import { HoleEntryType } from "@prisma/client";

interface TeamScore {
  teamId: string;
  teamNumber: number;
  players: { id: string; name: string }[];
  entryType: HoleEntryType | null;
  value: number | null;
  wasEdited: boolean;
  hasEntry: boolean;
}

interface HoleViewData {
  holeNumber: number;
  par: number;
  handicapRank: number;
  isComplete: boolean;
  teamScores: TeamScore[];
  result: { winnerTeamId: string | null; isTie: boolean } | null;
  payout: number | null;
}

interface ScorecardHole {
  holeNumber: number;
  par: number;
  entryType: string | null;
  value: number | null;
}

interface Round {
  id: string;
  status: string;
  visibility: string;
  blindRevealMode: string;
  startingHole: number;
  course: {
    name: string;
    holes: { holeNumber: number; par: number; handicapRank: number }[];
  };
  teams: { id: string; teamNumber: number }[];
}

export default function LiveScoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [round, setRound] = useState<Round | null>(null);
  const [currentHole, setCurrentHole] = useState<number>(1);
  const [holeData, setHoleData] = useState<HoleViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHolePicker, setShowHolePicker] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [showTeamSelect, setShowTeamSelect] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [scorecard, setScorecard] = useState<ScorecardHole[]>([]);
  const [customScore, setCustomScore] = useState<string>("");

  const isBlind = round?.visibility === "BLIND";
  const isLive = round?.status === "LIVE";

  useEffect(() => {
    loadRound();
  }, [id]);

  useEffect(() => {
    if (round) {
      loadHoleData();
    }
  }, [round, currentHole, myTeamId]);

  useEffect(() => {
    // Always require team selection for scoring
    if (round && isLive) {
      const stored = localStorage.getItem(`round-${id}-team`);
      if (stored && round.teams.some((t) => t.id === stored)) {
        setMyTeamId(stored);
      } else {
        setShowTeamSelect(true);
      }
    }
  }, [round, id, isLive]);

  async function loadRound() {
    try {
      const data = await getRound(id);
      if (!data) {
        router.push("/");
        return;
      }

      if (data.status === "DRAFT") {
        router.push(`/rounds/${id}/setup`);
        return;
      }

      if (data.status === "FINISHED") {
        router.push(`/rounds/${id}/summary`);
        return;
      }

      setRound(data as Round);
      setCurrentHole(data.startingHole ?? 1);
      setLoading(false);
    } catch (err) {
      setError("Failed to load round");
      setLoading(false);
    }
  }

  async function loadHoleData() {
    if (!round) return;

    try {
      const data = await getHoleView(id, currentHole, myTeamId);
      setHoleData(data as HoleViewData);
    } catch (err) {
      setError("Failed to load hole data");
    }
  }

  async function loadScorecard() {
    if (!myTeamId) return;
    try {
      const data = await getTeamScorecard(id, myTeamId);
      setScorecard(data);
      setShowScorecard(true);
    } catch (err) {
      setError("Failed to load scorecard");
    }
  }

  const scoringOrder = round ? getScoringOrder(round.startingHole) : [];
  const currentIndex = scoringOrder.indexOf(currentHole);
  const isFirstHole = currentIndex === 0;
  const isLastHole = currentIndex === 17;

  const canAdvance = holeData?.isComplete ?? false;

  const myTeamScore = holeData?.teamScores.find((t) => t.teamId === myTeamId);
  const myTeamNumber = round?.teams.find((t) => t.id === myTeamId)?.teamNumber;

  const handleScoreEntry = async (
    teamId: string,
    entryType: HoleEntryType,
    value?: number
  ) => {
    setSaving(true);
    try {
      await upsertHoleScore(id, teamId, currentHole, {
        entryType,
        value: entryType === "VALUE" ? value : undefined,
      });
      await loadHoleData();
      setCustomScore("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save score");
    }
    setSaving(false);
  };

  const handleCustomScoreSubmit = () => {
    const value = parseInt(customScore);
    if (isNaN(value) || value < 1) {
      setError("Please enter a valid positive number");
      return;
    }
    if (myTeamId) {
      handleScoreEntry(myTeamId, "VALUE", value);
    }
  };

  const handleClear = async (teamId: string) => {
    await handleScoreEntry(teamId, "BLANK");
  };

  const handlePrevHole = () => {
    if (currentIndex > 0) {
      setCurrentHole(scoringOrder[currentIndex - 1]);
      setCustomScore("");
    }
  };

  const handleNextHole = () => {
    if (!canAdvance) {
      setError("Enter scores for all teams before moving on.");
      return;
    }
    if (currentIndex < 17) {
      setCurrentHole(scoringOrder[currentIndex + 1]);
      setError(null);
      setCustomScore("");
    }
  };

  const handleHolePick = (hole: number) => {
    const targetIndex = scoringOrder.indexOf(hole);

    // In blind mode, restrict navigation
    if (isBlind && round?.blindRevealMode === "REVEAL_AFTER_ROUND") {
      if (hole !== currentHole) {
        setError("Cannot browse holes in blind mode");
        setShowHolePicker(false);
        return;
      }
    }

    // Check if we can jump forward
    if (targetIndex > currentIndex && !canAdvance) {
      setError("Enter scores for this hole before moving on.");
      setShowHolePicker(false);
      return;
    }

    setCurrentHole(hole);
    setShowHolePicker(false);
    setError(null);
    setCustomScore("");
  };

  const handleTeamSelect = (teamId: string) => {
    localStorage.setItem(`round-${id}-team`, teamId);
    setMyTeamId(teamId);
    setShowTeamSelect(false);
  };

  const changeTeam = () => {
    localStorage.removeItem(`round-${id}-team`);
    setMyTeamId(null);
    setShowTeamSelect(true);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await finishRound(id);
      router.push(`/rounds/${id}/summary`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish round");
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-center py-8">Loading...</p>;
  }

  if (!round || !holeData) {
    return <p className="text-center py-8">Round not found</p>;
  }

  const holeInfo = round.course.holes.find(
    (h) => h.holeNumber === currentHole
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)]">
      {/* Sticky Header */}
      <div className="sticky top-14 bg-white shadow-md z-40">
        <div className="p-3">
          <div className="flex justify-between items-center mb-2">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              ← Back
            </Button>
            <span className="text-sm text-gray-600">{round.course.name}</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Hole {currentHole}</h1>
              <p className="text-sm text-gray-600">
                Par {holeInfo?.par} • HCP {holeInfo?.handicapRank}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadScorecard}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm"
              >
                Scorecard
              </button>
              <button
                onClick={() => setShowHolePicker(true)}
                className="px-3 py-1 bg-gray-100 rounded text-sm"
              >
                Holes
              </button>
            </div>
          </div>

          {/* Team indicator */}
          {myTeamId && (
            <div className="mt-2 flex items-center justify-between bg-green-100 text-green-800 text-sm px-3 py-2 rounded">
              <span>
                You are scoring for <strong>Team {myTeamNumber}</strong>
              </span>
              <button
                onClick={changeTeam}
                className="text-green-600 underline text-xs"
              >
                Change
              </button>
            </div>
          )}

          {isBlind && isLive && (
            <div className="mt-2 bg-yellow-100 text-yellow-800 text-sm px-3 py-1 rounded">
              Blind Mode Active
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-2 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Content - My Team Scoring */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {myTeamId && myTeamScore && (
          <Card className="overflow-hidden border-2 border-green-500">
            <div className="bg-green-700 text-white px-4 py-3 flex justify-between items-center">
              <span className="font-bold text-lg">Team {myTeamScore.teamNumber}</span>
              {myTeamScore.wasEdited && (
                <span className="text-xs bg-red-500 px-2 py-0.5 rounded">
                  Edited
                </span>
              )}
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                {myTeamScore.players.map((p) => p.name).join(", ")}
              </p>

              {/* Current Score Display */}
              <div className="text-center mb-6">
                <div className="text-6xl font-bold h-20 flex items-center justify-center">
                  {myTeamScore.entryType === null ? (
                    <span className="text-gray-300">-</span>
                  ) : myTeamScore.entryType === "X" ? (
                    <span className="text-gray-500">X</span>
                  ) : (
                    <span className="text-green-600">+{myTeamScore.value}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {myTeamScore.entryType === "X"
                    ? "Par or worse"
                    : myTeamScore.entryType === "VALUE"
                    ? `${myTeamScore.value} under par`
                    : "Enter your score"}
                </p>
              </div>

              {/* Quick Score Buttons */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[1, 2, 3, 4].map((num) => (
                  <Button
                    key={num}
                    variant={myTeamScore.value === num ? "primary" : "secondary"}
                    size="lg"
                    onClick={() => handleScoreEntry(myTeamId, "VALUE", num)}
                    disabled={saving}
                    className="text-2xl h-14"
                  >
                    +{num}
                  </Button>
                ))}
              </div>

              {/* Custom Score Input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="number"
                  min="1"
                  placeholder="Other score..."
                  value={customScore}
                  onChange={(e) => setCustomScore(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-lg"
                />
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleCustomScoreSubmit}
                  disabled={saving || !customScore}
                  className="px-6"
                >
                  Set
                </Button>
              </div>

              {/* X and Clear buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={myTeamScore.entryType === "X" ? "primary" : "secondary"}
                  size="lg"
                  onClick={() => handleScoreEntry(myTeamId, "X")}
                  disabled={saving}
                  className="text-xl h-12"
                >
                  X (Par or worse)
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => handleClear(myTeamId)}
                  disabled={saving || myTeamScore.entryType === null}
                  className="text-xl h-12"
                >
                  Clear
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Other Teams Status (collapsed view) */}
        <Card>
          <div className="p-4">
            <h3 className="font-medium text-gray-700 mb-3">Other Teams</h3>
            <div className="space-y-2">
              {holeData.teamScores
                .filter((t) => t.teamId !== myTeamId)
                .map((team) => (
                  <div
                    key={team.teamId}
                    className="flex justify-between items-center py-2 border-b last:border-b-0"
                  >
                    <span className="text-sm">
                      Team {team.teamNumber}
                    </span>
                    <span className="text-sm">
                      {isBlind ? (
                        team.hasEntry ? (
                          <span className="text-green-600">✓ Entered</span>
                        ) : (
                          <span className="text-gray-400">Waiting...</span>
                        )
                      ) : team.entryType === null ? (
                        <span className="text-gray-400">-</span>
                      ) : team.entryType === "X" ? (
                        <span className="text-gray-500">X</span>
                      ) : (
                        <span className="text-green-600">+{team.value}</span>
                      )}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </Card>

        {/* Hole completion status */}
        <div className="text-center text-sm text-gray-500">
          {canAdvance ? (
            <span className="text-green-600">✓ All teams have entered scores</span>
          ) : (
            <span>Waiting for all teams to enter scores...</span>
          )}
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">
            Hole {currentIndex + 1} of 18
          </span>
          {isLastHole && canAdvance && (
            <Button
              variant="primary"
              onClick={() => setShowFinishModal(true)}
              disabled={saving}
            >
              Finish Round
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handlePrevHole}
            disabled={isFirstHole}
          >
            ← Previous
          </Button>
          <Button
            variant={canAdvance ? "primary" : "secondary"}
            className="flex-1"
            onClick={handleNextHole}
            disabled={isLastHole || !canAdvance}
          >
            Next →
          </Button>
        </div>
      </div>

      {/* Hole Picker Modal */}
      {showHolePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowHolePicker(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-4 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold mb-4">Select Hole</h2>
            <div className="grid grid-cols-6 gap-2">
              {scoringOrder.map((hole, idx) => (
                <button
                  key={hole}
                  onClick={() => handleHolePick(hole)}
                  className={`p-3 rounded font-medium ${
                    hole === currentHole
                      ? "bg-green-600 text-white"
                      : idx <= currentIndex
                      ? "bg-gray-100 hover:bg-gray-200"
                      : "bg-gray-50 text-gray-400"
                  }`}
                >
                  {hole}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              className="w-full mt-4"
              onClick={() => setShowHolePicker(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Team Selection Modal */}
      {showTeamSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold mb-4">Which team are you scoring for?</h2>
            <div className="space-y-2">
              {round.teams.map((team) => {
                const teamData = holeData?.teamScores.find(
                  (t) => t.teamId === team.id
                );
                return (
                  <button
                    key={team.id}
                    onClick={() => handleTeamSelect(team.id)}
                    className="w-full p-4 text-left border rounded hover:bg-gray-50"
                  >
                    <span className="font-bold">Team {team.teamNumber}</span>
                    <p className="text-sm text-gray-600">
                      {teamData?.players.map((p) => p.name).join(", ")}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Team Scorecard Modal */}
      {showScorecard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowScorecard(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-4 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">
              Team {myTeamNumber} Scorecard
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Hole</th>
                  <th className="py-2 text-center">Par</th>
                  <th className="py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {scoringOrder.map((holeNum) => {
                  const hole = scorecard.find((h) => h.holeNumber === holeNum);
                  const holeInfo = round.course.holes.find(
                    (h) => h.holeNumber === holeNum
                  );
                  return (
                    <tr
                      key={holeNum}
                      className={`border-b ${
                        holeNum === currentHole ? "bg-green-50" : ""
                      }`}
                    >
                      <td className="py-2 font-medium">{holeNum}</td>
                      <td className="py-2 text-center text-gray-500">
                        {holeInfo?.par}
                      </td>
                      <td className="py-2 text-right">
                        {hole?.entryType === "X" ? (
                          <span className="text-gray-500">X</span>
                        ) : hole?.entryType === "VALUE" ? (
                          <span className="text-green-600 font-bold">
                            +{hole.value}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Button
              variant="secondary"
              className="w-full mt-4"
              onClick={() => setShowScorecard(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Finish Round Confirmation */}
      <ConfirmModal
        isOpen={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        onConfirm={handleFinish}
        title="Finish Round"
        message="Are you sure you want to finish this round? All results will be finalized."
        confirmText="Finish Round"
      />
    </div>
  );
}
