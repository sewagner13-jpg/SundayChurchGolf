"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Select } from "@/components/select";
import { Modal, ConfirmModal } from "@/components/modal";
import {
  getRound,
  setRoundPlayers,
  startRound,
  deleteRound,
  updateRoundDraft,
} from "@/actions/rounds";
import { generateTeams, swapTeamMembers, getTeamsWithMissingHandicaps, lockTeams, unlockTeams, getTeamLockStatus, getTeammateHistoryForRound } from "@/actions/teams";
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
  formatId?: string;
  formatConfig?: Record<string, unknown> | null;
  course: { name: string };
  format: { name: string };
  date: Date;
  buyInPerPlayer: number;
  teams: Team[];
  roundPlayers: RoundPlayer[];
}

interface PriorWeekTeammateHistory {
  previousRoundDate: string | null;
  teammatesByPlayerId: Record<
    string,
    { playerId: string; name: string }[]
  >;
}

interface VegasMatchup {
  teamId: string;
  opponentTeamId: string;
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
  const [isLocked, setIsLocked] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [lockCodeInput, setLockCodeInput] = useState("");
  const [teammateHistory, setTeammateHistory] =
    useState<PriorWeekTeammateHistory>({
      previousRoundDate: null,
      teammatesByPlayerId: {},
    });
  const [vegasMatchups, setVegasMatchups] = useState<Record<string, string>>({});

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

      console.log("Loaded round data:", {
        roundId: roundData.id,
        roundPlayersCount: roundData.roundPlayers.length,
        teamsCount: roundData.teams.length,
        activePlayersCount: activePlayers.length,
      });

      if (activePlayers.length === 0) {
        setError("No active players found. Please add players first.");
      }

      // Set selected players from round
      const selected = new Set(
        roundData.roundPlayers.map((rp) => rp.playerId)
      );
      setSelectedPlayerIds(selected);
      console.log("Selected players from DB:", selected.size);

      // Check if teams exist
      if (roundData.teams.length > 0) {
        setStep("teams");
        if (roundData.teamSize) setTeamSize(String(roundData.teamSize));
        if (roundData.teamMode)
          setTeamMode(roundData.teamMode as "RANDOM" | "BALANCED");
      } else if (roundData.format?.name === "Vegas") {
        setTeamSize("2");
      }

      const existingMatchups =
        ((roundData.formatConfig as { vegasMatchups?: VegasMatchup[] } | null)
          ?.vegasMatchups ?? []) as VegasMatchup[];
      if (existingMatchups.length > 0) {
        setVegasMatchups(
          Object.fromEntries(
            existingMatchups.map((matchup) => [
              matchup.teamId,
              matchup.opponentTeamId,
            ])
          )
        );
      } else if (roundData.format?.name === "Vegas" && roundData.teams.length > 0) {
        const defaultMatchups: Record<string, string> = {};
        for (let index = 0; index < roundData.teams.length; index += 2) {
          const team = roundData.teams[index];
          const opponent = roundData.teams[index + 1];
          if (team && opponent) {
            defaultMatchups[team.id] = opponent.id;
            defaultMatchups[opponent.id] = team.id;
          }
        }
        setVegasMatchups(defaultMatchups);
      } else {
        setVegasMatchups({});
      }

      // Check for missing handicaps
      const missing = await getTeamsWithMissingHandicaps(id);
      setMissingHandicaps(missing);

      // Check lock status
      const lockStatus = await getTeamLockStatus(id);
      setIsLocked(lockStatus.isLocked);

      // Load prior-week teammate history so repeated pairings are visible in setup
      const priorWeekHistory = await getTeammateHistoryForRound(id);
      setTeammateHistory(priorWeekHistory);

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
    setError(null);
    try {
      console.log("Saving players:", Array.from(selectedPlayerIds));
      await setRoundPlayers(id, Array.from(selectedPlayerIds));
      console.log("Players saved successfully, reloading data...");
      await loadData();
      console.log("Data reloaded, switching to teams step");
      setStep("teams");
    } catch (err) {
      console.error("Save players error:", err);
      setError(err instanceof Error ? err.message : "Failed to save players");
    }
    setActionLoading(false);
  };

  const handleGenerateTeams = async () => {
    const size = isVegasRound ? 2 : Number(teamSize);
    console.log("Generate teams called:", { size, selectedCount: selectedPlayerIds.size, teamMode });

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
      console.log("Calling generateTeams action...");
      await generateTeams(id, size, teamMode);
      console.log("Teams generated, reloading data...");
      await loadData();
      console.log("Data reloaded after team generation");
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
      if (isVegasRound) {
        if (!hasValidVegasMatchups) {
          throw new Error("Select an opponent for every Vegas team before starting");
        }
        await saveVegasMatchups();
      }
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

  const handleLockTeams = async () => {
    if (!/^\d{4}$/.test(lockCodeInput)) {
      setError("Lock code must be exactly 4 digits");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await lockTeams(id, lockCodeInput);
      setIsLocked(true);
      setShowLockModal(false);
      setLockCodeInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lock teams");
    }
    setActionLoading(false);
  };

  const handleUnlockTeams = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await unlockTeams(id, lockCodeInput);
      setIsLocked(false);
      setShowUnlockModal(false);
      setLockCodeInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock teams");
    }
    setActionLoading(false);
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

  const currentRound = round;
  const isVegasRound = currentRound.format.name === "Vegas";

  const setVegasOpponent = (teamId: string, opponentTeamId: string) => {
    setVegasMatchups((current) => {
      const next = { ...current };
      const previousOpponentId = next[teamId];
      if (!opponentTeamId) {
        delete next[teamId];
        if (previousOpponentId) {
          delete next[previousOpponentId];
        }
        return next;
      }
      const displacedTeamId = Object.entries(next).find(
        ([currentTeamId, currentOpponentId]) =>
          currentTeamId !== teamId && currentOpponentId === opponentTeamId
      )?.[0];

      next[teamId] = opponentTeamId;
      next[opponentTeamId] = teamId;

      if (previousOpponentId && previousOpponentId !== opponentTeamId) {
        delete next[previousOpponentId];
      }

      if (
        displacedTeamId &&
        displacedTeamId !== opponentTeamId &&
        displacedTeamId !== teamId
      ) {
        delete next[displacedTeamId];
      }

      return next;
    });
  };

  const buildVegasMatchupEntries = (): VegasMatchup[] =>
    currentRound.teams.map((team) => ({
      teamId: team.id,
      opponentTeamId: vegasMatchups[team.id] ?? "",
    }));

  const hasValidVegasMatchups =
    !isVegasRound ||
    (currentRound.teams.length > 0 &&
      currentRound.teams.every((team) => {
        const opponentTeamId = vegasMatchups[team.id];
        return (
          !!opponentTeamId &&
          opponentTeamId !== team.id &&
          vegasMatchups[opponentTeamId] === team.id
        );
      }));

  async function saveVegasMatchups() {
    if (!isVegasRound) return;

    await updateRoundDraft(id, {
      formatConfig: {
        ...(currentRound.formatConfig ?? {}),
        vegasMatchups: buildVegasMatchupEntries(),
      },
    });
  }

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const formatShortDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
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
          } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={() => !isLocked && setStep("players")}
          disabled={isLocked}
        >
          1. Players ({selectedPlayerIds.size})
        </button>
        <button
          className={`flex-1 py-2 text-center font-medium ${
            step === "teams"
              ? "border-b-2 border-green-600 text-green-600"
              : "text-gray-500"
          }`}
          onClick={async () => {
            if (selectedPlayerIds.size >= 2) {
              // Save players first if not already on teams step
              if (step === "players") {
                await handleSavePlayers();
              } else {
                setStep("teams");
              }
            }
          }}
          disabled={selectedPlayerIds.size < 2 || actionLoading}
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
                  disabled={isVegasRound}
                  options={[
                    { value: "2", label: "2 players per team" },
                    { value: "3", label: "3 players per team" },
                    { value: "4", label: "4 players per team" },
                  ]}
                />

                {isVegasRound && (
                  <p className="text-sm text-amber-700">
                    Vegas requires 2-player teams.
                  </p>
                )}

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
              {/* Lock Status Banner */}
              {isLocked && (
                <div className="bg-yellow-50 border border-yellow-400 text-yellow-800 px-4 py-3 rounded flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🔒</span>
                    <span className="font-medium">Teams are locked</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setLockCodeInput("");
                      setShowUnlockModal(true);
                    }}
                  >
                    Unlock
                  </Button>
                </div>
              )}

              <div className="flex gap-2 justify-between items-center">
                <span className="text-sm text-gray-600">
                  {round.teams.length} teams of {round.teamSize}
                </span>
                <div className="flex gap-2">
                  {!isLocked && (
                    <>
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
                    </>
                  )}
                  {!isLocked && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setLockCodeInput("");
                        setShowLockModal(true);
                      }}
                    >
                      🔒 Lock
                    </Button>
                  )}
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
                        {team.roundPlayers.map((rp) => {
                          const priorWeekPartners =
                            teammateHistory.teammatesByPlayerId[rp.playerId] ?? [];
                          const repeatPartners = priorWeekPartners.filter((partner) =>
                            team.roundPlayers.some(
                              (teamPlayer) => teamPlayer.playerId === partner.playerId
                            )
                          );

                          return (
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
                              <div>
                                <span>
                                  {rp.player.nickname || rp.player.fullName}
                                </span>
                                {repeatPartners.length > 0 &&
                                  teammateHistory.previousRoundDate && (
                                    <p className="text-xs text-amber-700">
                                      Prior week ({formatShortDate(teammateHistory.previousRoundDate)}):{" "}
                                      {repeatPartners
                                        .map((partner) => partner.name)
                                        .join(", ")}
                                    </p>
                                  )}
                              </div>
                              <span className="text-sm text-gray-500">
                                {rp.player.handicapIndex ?? "-"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>

              {isVegasRound && (
                <Card>
                  <CardHeader>Vegas Matchups</CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Choose the opponent for each team. Pairings must be reciprocal before the round can start.
                    </p>
                    {round.teams.map((team) => (
                      <Select
                        key={team.id}
                        label={`Team ${team.teamNumber} opponent`}
                        value={vegasMatchups[team.id] ?? ""}
                        onChange={(e) =>
                          setVegasOpponent(team.id, e.target.value)
                        }
                        options={[
                          { value: "", label: "Select opponent" },
                          ...round.teams
                            .filter((candidate) => candidate.id !== team.id)
                            .map((candidate) => ({
                              value: candidate.id,
                              label: `Team ${candidate.teamNumber}`,
                            })),
                        ]}
                        disabled={isLocked || actionLoading}
                      />
                    ))}
                    {!hasValidVegasMatchups && (
                      <p className="text-sm text-red-600">
                        Every team must be paired with exactly one opposing team.
                      </p>
                    )}
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        setActionLoading(true);
                        setError(null);
                        try {
                          if (!hasValidVegasMatchups) {
                            throw new Error(
                              "Every team must be paired with exactly one opponent"
                            );
                          }
                          await saveVegasMatchups();
                          await loadData();
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Failed to save Vegas matchups"
                          );
                        }
                        setActionLoading(false);
                      }}
                      disabled={isLocked || actionLoading || !hasValidVegasMatchups}
                    >
                      Save Matchups
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={() => setShowStartModal(true)}
                className="w-full"
                size="lg"
                disabled={isVegasRound && !hasValidVegasMatchups}
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

      {/* Lock Teams Modal */}
      <Modal
        isOpen={showLockModal}
        onClose={() => setShowLockModal(false)}
        title="Lock Teams"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter a 4-digit code to lock the teams. You will need this code to unlock them later.
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={lockCodeInput}
            onChange={(e) => setLockCodeInput(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter 4-digit code"
            className="w-full p-3 text-center text-2xl font-mono tracking-widest border rounded"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowLockModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleLockTeams}
              disabled={actionLoading || lockCodeInput.length !== 4}
            >
              {actionLoading ? "Locking..." : "Lock Teams"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unlock Teams Modal */}
      <Modal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        title="Unlock Teams"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter the 4-digit code to unlock the teams.
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={lockCodeInput}
            onChange={(e) => setLockCodeInput(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter unlock code"
            className="w-full p-3 text-center text-2xl font-mono tracking-widest border rounded"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowUnlockModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleUnlockTeams}
              disabled={actionLoading || lockCodeInput.length !== 4}
            >
              {actionLoading ? "Unlocking..." : "Unlock Teams"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
