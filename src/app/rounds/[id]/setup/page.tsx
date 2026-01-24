"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Select } from "@/components/select";
import { Modal, ConfirmModal } from "@/components/modal";
import { getRound, setRoundPlayers, startRound, deleteRound } from "@/actions/rounds";
import { generateTeams, swapTeamMembers, getTeamsWithMissingHandicaps } from "@/actions/teams";
interface Player {
  id: string;
  fullName: string;
  nickname: string | null;
  handicapIndex: number | string | null;
  isActive: boolean;
}

interface RoundPlayer {
  id: string;
  playerId: string;
  teamId: string | null;
  player: Player;
}

interface Team {
  id: string;
  teamNumber: number;
  handicapTotal: number | string | null;
  roundPlayers: RoundPlayer[];
}

interface Round {
  id: string;
  status: string;
  teamSize: number | null;
  teamMode: string | null;
  course: { name: string };
  format: { name: string };
  date: Date;
  buyInPerPlayer: number;
  teams: Team[];
  roundPlayers: RoundPlayer[];
}

export default function RoundSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [round, setRound] = useState<Round | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(
    new Set()
  );
  const [step, setStep] = useState<"players" | "teams">("players");
  const [teamSize, setTeamSize] = useState("2");
  const [teamMode, setTeamMode] = useState<"RANDOM" | "BALANCED">("RANDOM");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [startingHole, setStartingHole] = useState<1 | 10>(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapPlayer1, setSwapPlayer1] = useState<string | null>(null);
  const [missingHandicaps, setMissingHandicaps] = useState<Player[]>([]);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [roundData, playersRes] = await Promise.all([
        getRound(id),
        fetch("/api/players").then((r) => {
          if (!r.ok) throw new Error("Failed to fetch players");
          return r.json();
        }),
      ]);

      if (!roundData) {
        router.push("/");
        return;
      }

      if (roundData.status !== "DRAFT") {
        router.push(`/rounds/${id}/scoring`);
        return;
      }

      setRound(roundData as Round);
      const activePlayers = playersRes.filter((p: Player) => p.isActive);
      setAllPlayers(activePlayers);

      if (activePlayers.length === 0) {
        setError("No active players found. Please add players first.");
      }

      // Set selected players from round
      const selected = new Set(
        roundData.roundPlayers.map((rp) => rp.playerId)
      );
      setSelectedPlayerIds(selected);

      // Check if teams exist
      if (roundData.teams.length > 0) {
        setStep("teams");
        if (roundData.teamSize) setTeamSize(String(roundData.teamSize));
        if (roundData.teamMode)
          setTeamMode(roundData.teamMode as "RANDOM" | "BALANCED");
      }

      // Check for missing handicaps
      const missing = await getTeamsWithMissingHandicaps(id);
      setMissingHandicaps(missing);

      setLoading(false);
    } catch (err) {
      console.error("Setup page load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load round");
      setLoading(false);
    }
  }

  const togglePlayer = (playerId: string) => {
    const newSelected = new Set(selectedPlayerIds);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      if (newSelected.size >= 12) {
        setError("Maximum 12 players allowed");
        return;
      }
      newSelected.add(playerId);
    }
    setSelectedPlayerIds(newSelected);
    setError(null);
  };

  const handleSavePlayers = async () => {
    if (selectedPlayerIds.size < 2) {
      setError("Minimum 2 players required");
      return;
    }

    setActionLoading(true);
    try {
      await setRoundPlayers(id, Array.from(selectedPlayerIds));
      await loadData();
      setStep("teams");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save players");
    }
    setActionLoading(false);
  };

  const handleGenerateTeams = async () => {
    const size = Number(teamSize);
    if (selectedPlayerIds.size % size !== 0) {
      setError(
        `Cannot create even teams: ${selectedPlayerIds.size} players is not divisible by team size ${size}`
      );
      return;
    }

    if (selectedPlayerIds.size === 0) {
      setError("No players selected. Please select players first.");
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await generateTeams(id, size, teamMode);
      await loadData();
    } catch (err) {
      console.error("Generate teams error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate teams"
      );
    }
    setActionLoading(false);
  };

  const handlePlayerSwapClick = (playerId: string) => {
    if (!swapMode) return;

    if (!swapPlayer1) {
      setSwapPlayer1(playerId);
    } else if (swapPlayer1 === playerId) {
      setSwapPlayer1(null);
    } else {
      // Perform swap
      performSwap(swapPlayer1, playerId);
    }
  };

  const performSwap = async (p1: string, p2: string) => {
    setActionLoading(true);
    try {
      await swapTeamMembers(id, p1, p2);
      await loadData();
      setSwapPlayer1(null);
      setSwapMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to swap players");
    }
    setActionLoading(false);
  };

  const handleStartRound = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await startRound(id, startingHole);
      router.push(`/rounds/${id}/scoring`);
    } catch (err) {
      console.error("Start round error:", err);
      setError(err instanceof Error ? err.message : "Failed to start round");
      setActionLoading(false);
    }
  };

  const handleDeleteRound = async () => {
    try {
      await deleteRound(id);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete round");
    }
  };

  if (loading) {
    return <p className="text-center py-8">Loading round setup...</p>;
  }

  if (!round) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Round not found</p>
        <Button onClick={() => router.push("/")}>Go Home</Button>
      </div>
    );
  }

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const canGenerateTeams = selectedPlayerIds.size % Number(teamSize) === 0;
  const hasTeams = round.teams.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Round Setup</h1>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowDeleteModal(true)}
        >
          Delete
        </Button>
      </div>

      <Card>
        <CardContent>
          <p className="text-sm text-gray-600">
            {formatDate(round.date)} • {round.course.name}
          </p>
          <p className="text-sm text-gray-600">
            ${round.buyInPerPlayer} buy-in • {round.format.name}
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Step Tabs */}
      <div className="flex border-b">
        <button
          className={`flex-1 py-2 text-center font-medium ${
            step === "players"
              ? "border-b-2 border-green-600 text-green-600"
              : "text-gray-500"
          }`}
          onClick={() => setStep("players")}
        >
          1. Players ({selectedPlayerIds.size})
        </button>
        <button
          className={`flex-1 py-2 text-center font-medium ${
            step === "teams"
              ? "border-b-2 border-green-600 text-green-600"
              : "text-gray-500"
          }`}
          onClick={() => selectedPlayerIds.size >= 2 && setStep("teams")}
          disabled={selectedPlayerIds.size < 2}
        >
          2. Teams
        </button>
      </div>

      {step === "players" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>Select Players ({selectedPlayerIds.size}/12)</CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {allPlayers.map((player) => (
                  <label
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded border cursor-pointer ${
                      selectedPlayerIds.has(player.id)
                        ? "bg-green-50 border-green-500"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedPlayerIds.has(player.id)}
                        onChange={() => togglePlayer(player.id)}
                        className="w-5 h-5"
                      />
                      <span className="font-medium">
                        {player.nickname || player.fullName}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {player.handicapIndex
                        ? `${player.handicapIndex} HCP`
                        : "No HCP"}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleSavePlayers}
            className="w-full"
            disabled={
              actionLoading || selectedPlayerIds.size < 2
            }
          >
            {actionLoading ? "Saving..." : "Continue to Teams"}
          </Button>
        </div>
      )}

      {step === "teams" && (
        <div className="space-y-4">
          {/* Team Generation Options */}
          {!hasTeams && (
            <Card>
              <CardHeader>Team Settings</CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="Team Size"
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                  options={[
                    { value: "2", label: "2 players per team" },
                    { value: "3", label: "3 players per team" },
                    { value: "4", label: "4 players per team" },
                  ]}
                />

                <Select
                  label="Team Mode"
                  value={teamMode}
                  onChange={(e) =>
                    setTeamMode(e.target.value as "RANDOM" | "BALANCED")
                  }
                  options={[
                    { value: "RANDOM", label: "Random" },
                    { value: "BALANCED", label: "Balanced (by handicap)" },
                  ]}
                />

                {teamMode === "BALANCED" && missingHandicaps.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-400 text-yellow-800 px-3 py-2 rounded text-sm">
                    Warning: {missingHandicaps.length} player(s) missing
                    handicap. Balance may be imperfect.
                  </div>
                )}

                {!canGenerateTeams && (
                  <p className="text-sm text-red-600">
                    {selectedPlayerIds.size} players cannot be evenly divided
                    into teams of {teamSize}
                  </p>
                )}

                <Button
                  onClick={handleGenerateTeams}
                  className="w-full"
                  disabled={actionLoading || !canGenerateTeams}
                >
                  {actionLoading ? "Generating..." : "Generate Teams"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Team Display */}
          {hasTeams && (
            <>
              <div className="flex gap-2 justify-between items-center">
                <span className="text-sm text-gray-600">
                  {round.teams.length} teams of {round.teamSize}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant={swapMode ? "danger" : "secondary"}
                    size="sm"
                    onClick={() => {
                      setSwapMode(!swapMode);
                      setSwapPlayer1(null);
                    }}
                  >
                    {swapMode ? "Cancel Swap" : "Swap Players"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleGenerateTeams}
                    disabled={actionLoading}
                  >
                    {round.teamMode === "BALANCED"
                      ? "Rebalance"
                      : "Regenerate"}
                  </Button>
                </div>
              </div>

              {swapMode && (
                <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                  {swapPlayer1
                    ? "Tap another player to swap with"
                    : "Tap first player to swap"}
                </p>
              )}

              <div className="space-y-3">
                {round.teams.map((team) => {
                  // Calculate total handicap from players if not stored
                  const calculatedTotal = team.roundPlayers.reduce((sum, rp) => {
                    const hcp = rp.player.handicapIndex;
                    return sum + (typeof hcp === 'number' ? hcp : 0);
                  }, 0);
                  const storedTotal = team.handicapTotal != null ? Number(team.handicapTotal) : null;
                  const displayTotal = storedTotal ?? calculatedTotal;

                  return (
                  <Card key={team.id}>
                    <CardHeader className="flex justify-between items-center">
                      <span>Team {team.teamNumber}</span>
                      <span className="text-sm font-normal text-green-700 bg-green-50 px-2 py-0.5 rounded">
                        Total: {displayTotal.toFixed(1)} HCP
                      </span>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {team.roundPlayers.map((rp) => (
                          <div
                            key={rp.id}
                            className={`flex justify-between items-center p-2 rounded ${
                              swapMode
                                ? swapPlayer1 === rp.playerId
                                  ? "bg-blue-100 border border-blue-500 cursor-pointer"
                                  : "bg-gray-50 hover:bg-gray-100 cursor-pointer"
                                : ""
                            }`}
                            onClick={() =>
                              handlePlayerSwapClick(rp.playerId)
                            }
                          >
                            <span>
                              {rp.player.nickname || rp.player.fullName}
                            </span>
                            <span className="text-sm text-gray-500">
                              {rp.player.handicapIndex ?? "-"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>

              <Button
                onClick={() => setShowStartModal(true)}
                className="w-full"
                size="lg"
              >
                Start Round
              </Button>
            </>
          )}
        </div>
      )}

      {/* Start Round Modal */}
      <Modal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        title="Start Round"
      >
        <div className="space-y-4">
          <p>Choose starting hole:</p>
          <div className="flex gap-4">
            <label className="flex-1">
              <input
                type="radio"
                name="startingHole"
                value="1"
                checked={startingHole === 1}
                onChange={() => setStartingHole(1)}
                className="sr-only"
              />
              <div
                className={`p-4 text-center rounded border-2 cursor-pointer ${
                  startingHole === 1
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200"
                }`}
              >
                <span className="text-2xl font-bold">Hole 1</span>
              </div>
            </label>
            <label className="flex-1">
              <input
                type="radio"
                name="startingHole"
                value="10"
                checked={startingHole === 10}
                onChange={() => setStartingHole(10)}
                className="sr-only"
              />
              <div
                className={`p-4 text-center rounded border-2 cursor-pointer ${
                  startingHole === 10
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200"
                }`}
              >
                <span className="text-2xl font-bold">Hole 10</span>
              </div>
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowStartModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleStartRound}
              disabled={actionLoading}
            >
              {actionLoading ? "Starting..." : "Start Round"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteRound}
        title="Delete Round"
        message="Are you sure you want to delete this round? This cannot be undone."
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}
