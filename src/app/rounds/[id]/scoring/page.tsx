"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmModal } from "@/components/modal";
import { getRound } from "@/actions/rounds";
import { upsertHoleScore, getHoleView, finishRound } from "@/actions/scoring";
import { getScoringOrder, areAllHolesComplete } from "@/lib/scoring-engine";
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
    // Check localStorage for team selection in blind mode
    if (round && isBlind && isLive) {
      const stored = localStorage.getItem(`round-${id}-team`);
      if (stored && round.teams.some((t) => t.id === stored)) {
        setMyTeamId(stored);
      } else {
        setShowTeamSelect(true);
      }
    }
  }, [round, id]);

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

  const scoringOrder = round ? getScoringOrder(round.startingHole) : [];
  const currentIndex = scoringOrder.indexOf(currentHole);
  const isFirstHole = currentIndex === 0;
  const isLastHole = currentIndex === 17;

  const canAdvance = holeData?.isComplete ?? false;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save score");
    }
    setSaving(false);
  };

  const handleClear = async (teamId: string) => {
    await handleScoreEntry(teamId, "BLANK");
  };

  const handlePrevHole = () => {
    if (currentIndex > 0) {
      setCurrentHole(scoringOrder[currentIndex - 1]);
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
    }
  };

  const handleHolePick = (hole: number) => {
    const targetIndex = scoringOrder.indexOf(hole);

    // In blind mode, restrict navigation
    if (isBlind && round?.blindRevealMode === "REVEAL_AFTER_ROUND") {
      // Only allow current hole
      if (hole !== currentHole) {
        setError("Cannot browse holes in blind mode");
        setShowHolePicker(false);
        return;
      }
    }

    // Check if we can jump forward
    if (targetIndex > currentIndex) {
      // Need to verify all holes in between are complete
      for (let i = currentIndex; i < targetIndex; i++) {
        // For now, just block forward navigation if current isn't complete
        if (!canAdvance) {
          setError("Enter scores for this hole before moving on.");
          setShowHolePicker(false);
          return;
        }
      }
    }

    setCurrentHole(hole);
    setShowHolePicker(false);
    setError(null);
  };

  const handleTeamSelect = (teamId: string) => {
    localStorage.setItem(`round-${id}-team`, teamId);
    setMyTeamId(teamId);
    setShowTeamSelect(false);
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

  const allHolesComplete = round
    ? scoringOrder.every((hole) => {
        // We'd need to check each hole's completion status
        // For now, check if we're on last hole and it's complete
        return isLastHole && canAdvance;
      })
    : false;

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
            <button
              onClick={() => setShowHolePicker(true)}
              className="px-3 py-1 bg-gray-100 rounded text-sm"
            >
              Holes
            </button>
          </div>

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

      {/* Main Content - Team Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {holeData.teamScores.map((team) => {
          const canEdit =
            !isBlind || !isLive || myTeamId === team.teamId;
          const showValue = team.entryType !== null;

          return (
            <Card key={team.teamId} className="overflow-hidden">
              <div className="bg-green-700 text-white px-4 py-2 flex justify-between items-center">
                <span className="font-bold">Team {team.teamNumber}</span>
                {team.wasEdited && (
                  <span className="text-xs bg-red-500 px-2 py-0.5 rounded">
                    Edited
                  </span>
                )}
              </div>

              <div className="p-4">
                <p className="text-sm text-gray-600 mb-3">
                  {team.players.map((p) => p.name).join(", ")}
                </p>

                {/* Score Display */}
                <div className="text-center mb-4">
                  <div className="text-5xl font-bold h-16 flex items-center justify-center">
                    {!showValue ? (
                      isBlind && !canEdit ? (
                        team.hasEntry ? (
                          <span className="text-gray-400 text-lg">
                            Score Entered
                          </span>
                        ) : (
                          <span className="text-gray-400 text-lg">
                            Not Entered
                          </span>
                        )
                      ) : (
                        <span className="text-gray-300">-</span>
                      )
                    ) : team.entryType === "X" ? (
                      <span className="text-gray-500">X</span>
                    ) : (
                      <span className="text-green-600">{team.value}</span>
                    )}
                  </div>
                </div>

                {/* Score Entry Buttons */}
                {canEdit && (
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() =>
                        handleScoreEntry(team.teamId, "VALUE", 1)
                      }
                      disabled={saving}
                      className="text-xl"
                    >
                      +1
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() =>
                        handleScoreEntry(team.teamId, "VALUE", 2)
                      }
                      disabled={saving}
                      className="text-xl"
                    >
                      +2
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() =>
                        handleScoreEntry(
                          team.teamId,
                          "VALUE",
                          (team.value ?? 0) + 1
                        )
                      }
                      disabled={saving || team.entryType !== "VALUE"}
                      className="text-xl"
                    >
                      +
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => handleScoreEntry(team.teamId, "X")}
                      disabled={saving}
                      className="text-xl"
                    >
                      X
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClear(team.teamId)}
                      disabled={saving}
                      className="col-span-2"
                    >
                      Clear
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (
                          team.entryType === "VALUE" &&
                          team.value &&
                          team.value > 1
                        ) {
                          handleScoreEntry(
                            team.teamId,
                            "VALUE",
                            team.value - 1
                          );
                        }
                      }}
                      disabled={
                        saving ||
                        team.entryType !== "VALUE" ||
                        !team.value ||
                        team.value <= 1
                      }
                      className="col-span-2"
                    >
                      Undo (-1)
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {/* Hole Result (if visible) */}
        {holeData.result && holeData.isComplete && !isLive && (
          <Card className="bg-gray-50">
            <div className="p-4 text-center">
              {holeData.result.isTie ? (
                <p className="text-lg font-medium text-gray-600">
                  Tie - Carryover
                </p>
              ) : (
                <p className="text-lg font-medium text-green-600">
                  Team{" "}
                  {
                    holeData.teamScores.find(
                      (t) => t.teamId === holeData.result?.winnerTeamId
                    )?.teamNumber
                  }{" "}
                  Wins!
                </p>
              )}
              {holeData.payout && (
                <p className="text-sm text-gray-600">
                  Payout: ${holeData.payout}
                </p>
              )}
            </div>
          </Card>
        )}
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

      {/* Team Selection Modal (Blind Mode) */}
      {showTeamSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold mb-4">Which team are you on?</h2>
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
