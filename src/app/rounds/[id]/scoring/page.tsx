"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmModal } from "@/components/modal";
import { getRound } from "@/actions/rounds";
import {
  upsertHoleScore,
  getHoleView,
  finishRound,
  getTeamScorecard,
  getTeamsProgress,
  getLiveSkinsStatus,
  markTeamFinished,
  getTeamFinishStatus,
} from "@/actions/scoring";
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

interface TeamProgress {
  teamId: string;
  teamNumber: number;
  players: { id: string; name: string }[];
  holesScored: number;
  scoredHoles: number[];
}

interface TeamFinishStatus {
  teamId: string;
  teamNumber: number;
  players: { id: string; name: string }[];
  holesScored: number;
  finishedScoring: boolean;
}

interface SkinStatus {
  holeNumber: number;
  par: number;
  teamsScored: number;
  totalTeams: number;
  isComplete: boolean;
  result: {
    winnerTeamId: string | null;
    winnerTeamNumber: number | null;
    isTie: boolean;
    carryover: boolean;
    skinsWon: number;
    holePayout: number;
  } | null;
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
  teams: {
    id: string;
    teamNumber: number;
    roundPlayers: {
      id: string;
      playerId: string;
      player: { id: string; fullName: string; nickname: string | null };
    }[];
  }[];
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
  const [teamsProgress, setTeamsProgress] = useState<TeamProgress[]>([]);
  const [skinsStatus, setSkinsStatus] = useState<SkinStatus[]>([]);
  const [showSkinsStatus, setShowSkinsStatus] = useState(false);
  const [showMarkFinishedModal, setShowMarkFinishedModal] = useState(false);
  const [teamFinishStatus, setTeamFinishStatus] = useState<TeamFinishStatus[]>([]);

  const isLive = round?.status === "LIVE";

  useEffect(() => {
    loadRound();
  }, [id]);

  useEffect(() => {
    if (round && myTeamId) {
      loadHoleData();
      loadTeamsProgress();
    }
  }, [round, currentHole, myTeamId]);

  useEffect(() => {
    // Require team selection for scoring
    if (round && isLive) {
      const stored = localStorage.getItem(`round-${id}-team`);
      if (stored && round.teams.some((t) => t.id === stored)) {
        setMyTeamId(stored);
        // Load this team's saved hole position
        const savedHole = localStorage.getItem(`round-${id}-team-${stored}-hole`);
        if (savedHole) {
          setCurrentHole(parseInt(savedHole, 10));
        } else {
          setCurrentHole(round.startingHole ?? 1);
        }
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

  async function loadTeamsProgress() {
    if (!round) return;
    try {
      const progress = await getTeamsProgress(id);
      setTeamsProgress(progress);
      // Also load finish status
      const finishStatus = await getTeamFinishStatus(id);
      setTeamFinishStatus(finishStatus);
    } catch (err) {
      console.error("Failed to load teams progress");
    }
  }

  async function loadSkinsStatus() {
    if (!round) return;
    try {
      const status = await getLiveSkinsStatus(id, round.startingHole);
      setSkinsStatus(status);
      setShowSkinsStatus(true);
    } catch (err) {
      setError("Failed to load skins status");
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

  // Can advance once MY team has entered a score (not waiting for others)
  const myTeamScore = holeData?.teamScores.find((t) => t.teamId === myTeamId);
  const canAdvance = myTeamScore?.hasEntry ?? false;

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
      await loadTeamsProgress();
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
      const prevHole = scoringOrder[currentIndex - 1];
      setCurrentHole(prevHole);
      if (myTeamId) {
        localStorage.setItem(`round-${id}-team-${myTeamId}-hole`, String(prevHole));
      }
      setCustomScore("");
    }
  };

  const handleNextHole = () => {
    if (!canAdvance) {
      setError("Enter your team's score before moving on.");
      return;
    }
    if (currentIndex < 17) {
      const nextHole = scoringOrder[currentIndex + 1];
      setCurrentHole(nextHole);
      if (myTeamId) {
        localStorage.setItem(`round-${id}-team-${myTeamId}-hole`, String(nextHole));
      }
      setError(null);
      setCustomScore("");
    }
  };

  const handleHolePick = (hole: number) => {
    const targetIndex = scoringOrder.indexOf(hole);

    // Check if we can jump forward - only need our team's score
    if (targetIndex > currentIndex && !canAdvance) {
      setError("Enter your team's score before moving on.");
      setShowHolePicker(false);
      return;
    }

    setCurrentHole(hole);
    if (myTeamId) {
      localStorage.setItem(`round-${id}-team-${myTeamId}-hole`, String(hole));
    }
    setShowHolePicker(false);
    setError(null);
    setCustomScore("");
  };

  const handleTeamSelect = (teamId: string) => {
    localStorage.setItem(`round-${id}-team`, teamId);
    setMyTeamId(teamId);

    // Load saved hole for this team or start at beginning
    const savedHole = localStorage.getItem(`round-${id}-team-${teamId}-hole`);
    if (savedHole && round) {
      setCurrentHole(parseInt(savedHole, 10));
    } else if (round) {
      setCurrentHole(round.startingHole ?? 1);
    }

    setShowTeamSelect(false);
  };

  const changeTeam = () => {
    localStorage.removeItem(`round-${id}-team`);
    setMyTeamId(null);
    setShowTeamSelect(true);
  };

  const handleMarkTeamFinished = async () => {
    if (!myTeamId) return;
    setSaving(true);
    try {
      const result = await markTeamFinished(id, myTeamId);
      await loadTeamsProgress();
      setShowMarkFinishedModal(false);
      if (result.allTeamsFinished) {
        // All teams are done, show finish round modal
        setShowFinishModal(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark team finished");
    }
    setSaving(false);
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

  // Check if all teams have completed all holes
  const allTeamsComplete = teamsProgress.every((t) => t.holesScored === 18);

  // Check if my team has finished scoring
  const myTeamFinishStatus = teamFinishStatus.find((t) => t.teamId === myTeamId);
  const myTeamFinished = myTeamFinishStatus?.finishedScoring ?? false;
  const myTeamHasAll18 = myTeamFinishStatus?.holesScored === 18;

  // Check if all teams have marked themselves finished
  const allTeamsMarkedFinished = teamFinishStatus.every((t) => t.finishedScoring);

  if (loading) {
    return <p className="text-center py-8">Loading...</p>;
  }

  if (!round) {
    return <p className="text-center py-8">Round not found</p>;
  }

  // Show team selection modal if needed (before checking holeData)
  if (showTeamSelect) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 m-4 max-w-sm w-full">
          <h2 className="text-xl font-bold mb-4">Which team are you scoring for?</h2>
          <div className="space-y-2">
            {round.teams.map((team) => {
              const playerNames = team.roundPlayers
                .map((rp) => rp.player.nickname || rp.player.fullName)
                .join(", ");
              return (
                <button
                  key={team.id}
                  onClick={() => {
                    handleTeamSelect(team.id);
                    setShowTeamSelect(false);
                  }}
                  className="w-full p-4 border rounded hover:bg-gray-50 text-left"
                >
                  <span className="font-bold">Team {team.teamNumber}</span>
                  <p className="text-sm text-gray-600 mt-1">{playerNames}</p>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => router.push("/")}
            className="w-full mt-4 p-3 text-gray-600 border rounded hover:bg-gray-50"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Still loading hole data after team selection
  if (!holeData) {
    return <p className="text-center py-8">Loading hole data...</p>;
  }

  const holeInfo = round.course.holes.find((h) => h.holeNumber === currentHole);

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
                Scoring for <strong>Team {myTeamNumber}</strong>
              </span>
              <button
                onClick={changeTeam}
                className="text-green-600 underline text-xs"
              >
                Change
              </button>
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

        {/* Other Teams Progress - Just show what hole they're on */}
        <Card>
          <div className="p-4">
            <h3 className="font-medium text-gray-700 mb-3">Other Teams</h3>
            <div className="space-y-2">
              {teamFinishStatus
                .filter((t) => t.teamId !== myTeamId)
                .map((team) => (
                  <div
                    key={team.teamId}
                    className="flex justify-between items-center py-2 border-b last:border-b-0"
                  >
                    <div>
                      <span className="font-medium text-sm">Team {team.teamNumber}</span>
                      <p className="text-xs text-gray-500">
                        {team.players.map((p) => p.name).join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-600">
                        {team.holesScored}/18 holes
                      </span>
                      {team.finishedScoring && (
                        <span className="ml-2 text-xs text-green-600 font-medium">
                          ✓ Done
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </Card>

        {/* Live Skins Status Button */}
        <button
          onClick={loadSkinsStatus}
          className="w-full py-3 bg-yellow-100 text-yellow-800 rounded-lg font-medium text-sm"
        >
          View Live Skins Status
        </button>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">
            Hole {currentIndex + 1} of 18
          </span>
          <div className="flex gap-2">
            {/* Mark Team Finished button - show when team has 18 holes and not finished */}
            {myTeamHasAll18 && !myTeamFinished && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowMarkFinishedModal(true)}
                disabled={saving}
              >
                Mark Team Done
              </Button>
            )}
            {/* Show finished status */}
            {myTeamFinished && (
              <span className="text-sm text-green-600 font-medium flex items-center">
                ✓ Team Finished
              </span>
            )}
            {/* Finish Round - only when all teams marked finished */}
            {allTeamsMarkedFinished && allTeamsComplete && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowFinishModal(true)}
                disabled={saving}
              >
                Finish Round
              </Button>
            )}
          </div>
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
            disabled={isLastHole}
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
              {scoringOrder.map((hole, idx) => {
                const myProgress = teamsProgress.find((t) => t.teamId === myTeamId);
                const hasScored = myProgress?.scoredHoles.includes(hole);
                return (
                  <button
                    key={hole}
                    onClick={() => handleHolePick(hole)}
                    className={`p-3 rounded font-medium ${
                      hole === currentHole
                        ? "bg-green-600 text-white"
                        : hasScored
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    {hole}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Green = scored
            </p>
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
                const progress = teamsProgress.find((t) => t.teamId === team.id);
                return (
                  <button
                    key={team.id}
                    onClick={() => handleTeamSelect(team.id)}
                    className="w-full p-4 text-left border rounded hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Team {team.teamNumber}</span>
                      <span className="text-sm text-gray-500">
                        {progress?.holesScored ?? 0}/18
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {progress?.players.map((p) => p.name).join(", ")}
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

      {/* Live Skins Status Modal */}
      {showSkinsStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSkinsStatus(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-4 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">Live Skins</h2>
            <p className="text-xs text-gray-500 mb-3">Updates as teams score each hole</p>

            {/* Running totals by team */}
            {skinsStatus.some((h) => h.result?.winnerTeamNumber) && (
              <div className="mb-3 p-2 bg-gray-50 rounded text-sm">
                <p className="font-medium text-xs text-gray-500 mb-1">RUNNING TOTALS</p>
                {Array.from(
                  skinsStatus.reduce((acc, hole) => {
                    if (hole.result?.winnerTeamNumber && hole.result.holePayout > 0) {
                      const t = hole.result.winnerTeamNumber;
                      acc.set(t, (acc.get(t) ?? 0) + hole.result.holePayout);
                    }
                    return acc;
                  }, new Map<number, number>())
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([teamNum, total]) => (
                    <div key={teamNum} className="flex justify-between">
                      <span>Team {teamNum}</span>
                      <span className="font-bold text-green-700">${Math.round(total)}</span>
                    </div>
                  ))}
              </div>
            )}

            <div className="space-y-1">
              {skinsStatus.map((hole) => (
                <div
                  key={hole.holeNumber}
                  className={`flex justify-between items-center py-2 px-3 rounded ${
                    !hole.isComplete
                      ? "bg-gray-50"
                      : hole.result?.isTie
                      ? "bg-yellow-50 border border-yellow-200"
                      : hole.result?.winnerTeamNumber
                      ? "bg-green-50 border border-green-200"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium w-8">#{hole.holeNumber}</span>
                    <span className="text-xs text-gray-400">P{hole.par}</span>
                    {hole.result?.carryover && hole.result.skinsWon > 1 && (
                      <span className="text-xs font-bold text-orange-600 bg-orange-100 px-1 rounded">
                        {hole.result.skinsWon} skins
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-right">
                    {!hole.isComplete ? (
                      <span className="text-gray-400">
                        {hole.teamsScored}/{hole.totalTeams}
                      </span>
                    ) : hole.result?.isTie ? (
                      <span className="text-yellow-600 font-medium">
                        Tie — carries
                      </span>
                    ) : hole.result?.winnerTeamNumber ? (
                      <div>
                        <span className="text-green-700 font-bold">
                          Team {hole.result.winnerTeamNumber}
                        </span>
                        <span className="text-green-600 text-xs ml-2">
                          ${Math.round(hole.result.holePayout)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="secondary"
              className="w-full mt-4"
              onClick={() => setShowSkinsStatus(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Mark Team Finished Confirmation */}
      <ConfirmModal
        isOpen={showMarkFinishedModal}
        onClose={() => setShowMarkFinishedModal(false)}
        onConfirm={handleMarkTeamFinished}
        title="Mark Team Finished"
        message={`Mark Team ${myTeamNumber} as finished scoring? Make sure all 18 holes are correct before confirming.`}
        confirmText={saving ? "Saving..." : "Mark Done"}
      />

      {/* Finish Round Confirmation */}
      <ConfirmModal
        isOpen={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        onConfirm={handleFinish}
        title="Finish Round"
        message="All teams have finished scoring. Finalize results and calculate payouts?"
        confirmText="Finish Round"
      />
    </div>
  );
}
