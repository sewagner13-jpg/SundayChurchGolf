"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmModal } from "@/components/modal";
import {
  getPlayerScores,
  upsertPlayerScoresForHole,
} from "@/actions/player-scores";
import {
  acknowledgeImportantMessage,
  getRoundChat,
  postRoundMessage,
} from "@/actions/chat";
import { getRound, revertToDraft } from "@/actions/rounds";
import {
  upsertHoleScore,
  getHoleView,
  finishRound,
  getTeamScorecard,
  getTeamsProgress,
  getLiveSkinsStatus,
  markTeamFinished,
} from "@/actions/scoring";
import { FORMAT_DEFINITIONS } from "@/lib/format-definitions";
import { getIrishGolfSegmentFormatId } from "@/lib/format-scoring";
import { getScoringOrder } from "@/lib/scoring-order";
import { HoleEntryType } from "@prisma/client";

interface TeamScore {
  teamId: string;
  teamNumber: number;
  players: { id: string; name: string }[];
  entryType: HoleEntryType | null;
  value: number | null;
  grossScore: number | null;
  holeData: Record<string, unknown> | null;
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
  grossScore: number | null;
  displayScore: string | null;
}

interface TeamProgress {
  teamId: string;
  teamNumber: number;
  players: { id: string; name: string }[];
  holesScored: number;
  scoredHoles: number[];
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
  formatId: string;
  formatConfig: Record<string, unknown> | null;
  format: {
    id: string;
    name: string;
  };
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

interface PlayerHoleInputState {
  playerId: string;
  name: string;
  grossScore: string;
  driveSelected: boolean;
  moneyBallLost: boolean;
  wolfPartnerSelected: boolean;
  wolfLone: boolean;
}

interface ChatMessage {
  id: string;
  body: string;
  isImportant: boolean;
  createdAt: string;
  senderTeamId: string;
  senderTeamNumber: number;
  acknowledgedByCurrentTeam: boolean;
}

interface PendingImportantMessage {
  id: string;
  body: string;
  createdAt: string;
  senderTeamNumber: number;
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
  const [showEditTeamsModal, setShowEditTeamsModal] = useState(false);
  const [unlockCode, setUnlockCode] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatImportant, setChatImportant] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [pendingImportantMessage, setPendingImportantMessage] =
    useState<PendingImportantMessage | null>(null);
  const [playerInputs, setPlayerInputs] = useState<PlayerHoleInputState[]>([]);

  const isLive = round?.status === "LIVE";

  useEffect(() => {
    loadRound();
  }, [id]);

  useEffect(() => {
    if (round && myTeamId) {
      loadHoleData();
      loadTeamsProgress();
      loadChat();
      loadPlayerInputs();
    }
  }, [round, currentHole, myTeamId]);

  useEffect(() => {
    if (!round || !myTeamId) return;

    const intervalId = window.setInterval(() => {
      loadChat();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [round, myTeamId]);

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

  async function loadChat() {
    if (!myTeamId) return;

    try {
      const data = await getRoundChat(id, myTeamId);
      setChatMessages(data.messages as ChatMessage[]);
      setPendingImportantMessage(
        data.pendingImportantMessage as PendingImportantMessage | null
      );
    } catch (err) {
      console.error("Failed to load chat");
    }
  }

  async function loadPlayerInputs() {
    if (!round || !myTeamId || !effectiveFormat?.requiresIndividualScores) {
      setPlayerInputs([]);
      return;
    }

    try {
      const team = round.teams.find((currentTeam) => currentTeam.id === myTeamId);
      if (!team) return;

      const savedScores = await getPlayerScores(id, {
        holeNumber: currentHole,
        teamId: myTeamId,
      });

      const designatedPlayerId =
        effectiveFormat.requiresDesignatedPlayer && team.roundPlayers.length > 0
          ? team.roundPlayers[(currentHole - 1) % team.roundPlayers.length]?.playerId
          : null;
      const designatedScore = designatedPlayerId
        ? savedScores.find((score) => score.playerId === designatedPlayerId)
        : null;
      const selectedWolfPartnerId =
        (designatedScore?.extraData?.wolfPartnerPlayerId as string | undefined) ??
        null;
      const isLoneWolf =
        (designatedScore?.extraData?.wolfLone as boolean) ?? false;

      setPlayerInputs(
        team.roundPlayers.map((roundPlayer) => {
          const saved = savedScores.find(
            (score) => score.playerId === roundPlayer.playerId
          );
          return {
            playerId: roundPlayer.playerId,
            name: roundPlayer.player.nickname || roundPlayer.player.fullName,
            grossScore:
              saved?.grossScore === null || saved?.grossScore === undefined
                ? ""
                : String(saved.grossScore),
            driveSelected:
              (saved?.extraData?.driveSelected as boolean) ??
              roundPlayer.playerId === designatedPlayerId,
            moneyBallLost:
              (saved?.extraData?.moneyBallLost as boolean) ?? false,
            wolfPartnerSelected: roundPlayer.playerId === selectedWolfPartnerId,
            wolfLone:
              roundPlayer.playerId === designatedPlayerId ? isLoneWolf : false,
          };
        })
      );
    } catch (err) {
      setError("Failed to load player scores");
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
  const scoreEntryBlocked = !!pendingImportantMessage;
  const formatDefinition = round
    ? FORMAT_DEFINITIONS.find((definition) => definition.id === round.formatId) ??
      FORMAT_DEFINITIONS.find((definition) => definition.name === round.format.name) ??
      null
    : null;
  const effectiveFormat = round
    ? formatDefinition?.id === "irish_golf_6_6_6"
      ? FORMAT_DEFINITIONS.find(
          (definition) =>
            definition.id ===
            getIrishGolfSegmentFormatId(
              currentHole,
              round.formatConfig ?? {}
            )
        ) ?? formatDefinition
      : formatDefinition
    : null;
  const usesIndividualScores = !!effectiveFormat?.requiresIndividualScores;
  const usesDriveTracking = !!effectiveFormat?.requiresDriveTracking;
  const designatedPlayer =
    myTeamId && round && effectiveFormat?.requiresDesignatedPlayer
      ? round.teams
          .find((team) => team.id === myTeamId)
          ?.roundPlayers[(currentHole - 1) %
            (round.teams.find((team) => team.id === myTeamId)?.roundPlayers.length ?? 1)]
      : null;

  const handleScoreEntry = async (
    teamId: string,
    entryType: HoleEntryType,
    value?: number
  ) => {
    if (scoreEntryBlocked) {
      setError("Acknowledge the important alert before entering a score.");
      return;
    }

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
    if (scoreEntryBlocked) {
      setError("Acknowledge the important alert before entering a score.");
      return;
    }

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

  const updatePlayerInput = (
    playerId: string,
    updates: Partial<PlayerHoleInputState>
  ) => {
    setPlayerInputs((current) =>
      current.map((input) =>
        input.playerId === playerId ? { ...input, ...updates } : input
      )
    );
  };

  const handleDriveSelection = (playerId: string) => {
    setPlayerInputs((current) =>
      current.map((input) => ({
        ...input,
        driveSelected: input.playerId === playerId,
      }))
    );
  };

  const handleWolfPartnerSelection = (playerId: string | null) => {
    setPlayerInputs((current) =>
      current.map((input) => ({
        ...input,
        wolfPartnerSelected: playerId !== null && input.playerId === playerId,
        wolfLone:
          input.playerId === designatedPlayer?.playerId ? playerId === null : false,
      }))
    );
  };

  const handleSavePlayerScores = async () => {
    if (!myTeamId || !usesIndividualScores) return;
    if (scoreEntryBlocked) {
      setError("Acknowledge the important alert before entering a score.");
      return;
    }

    if (playerInputs.some((input) => input.grossScore.trim() === "")) {
      setError("Enter a gross score for every player on your team.");
      return;
    }

    if (
      usesDriveTracking &&
      !playerInputs.some((input) => input.driveSelected)
    ) {
      setError("Select the player whose drive was used.");
      return;
    }

    if (effectiveFormat?.id === "wolf_team" && designatedPlayer) {
      const hasPartner = playerInputs.some((input) => input.wolfPartnerSelected);
      const designatedInput = playerInputs.find(
        (input) => input.playerId === designatedPlayer.playerId
      );
      if (!hasPartner && !designatedInput?.wolfLone) {
        setError("Choose a wolf partner or mark this hole as lone wolf.");
        return;
      }
    }

    setSaving(true);
    try {
      await upsertPlayerScoresForHole(
        id,
        myTeamId,
        currentHole,
        playerInputs.map((input) => ({
          playerId: input.playerId,
          grossScore: Number.parseInt(input.grossScore, 10),
          extraData: {
            driveSelected: input.driveSelected,
            moneyBallLost: input.moneyBallLost,
            wolfPartnerSelected: input.wolfPartnerSelected,
            ...(input.playerId === designatedPlayer?.playerId
              ? {
                  wolfPartnerPlayerId:
                    playerInputs.find((candidate) => candidate.wolfPartnerSelected)
                      ?.playerId ?? null,
                  wolfLone: input.wolfLone,
                }
              : {}),
          },
        }))
      );
      await loadHoleData();
      await loadTeamsProgress();
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save player scores"
      );
    }
    setSaving(false);
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
    if (scoreEntryBlocked) {
      setError("Acknowledge the important alert before continuing.");
      return;
    }

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
    if (scoreEntryBlocked) {
      setError("Acknowledge the important alert before continuing.");
      setShowHolePicker(false);
      return;
    }

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
    if (scoreEntryBlocked) {
      setError("Acknowledge the important alert before continuing.");
      return;
    }
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

  const handleRevertToDraft = async () => {
    if (!unlockCode.trim()) {
      setUnlockError("Please enter the unlock code");
      return;
    }
    setSaving(true);
    setUnlockError(null);
    try {
      await revertToDraft(id, unlockCode.trim());
      router.push(`/rounds/${id}/setup`);
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : "Failed to unlock");
      setSaving(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!myTeamId) return;

    setChatSending(true);
    try {
      await postRoundMessage(id, myTeamId, chatDraft, chatImportant);
      setChatDraft("");
      setChatImportant(false);
      await loadChat();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
    setChatSending(false);
  };

  const handleAcknowledgeImportant = async () => {
    if (!myTeamId || !pendingImportantMessage) return;

    setSaving(true);
    try {
      await acknowledgeImportantMessage(id, myTeamId, pendingImportantMessage.id);
      await loadChat();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to acknowledge alert");
    }
    setSaving(false);
  };

  // Check if all teams have completed all holes
  const allTeamsComplete = teamsProgress.every((t) => t.holesScored === 18);

  // Check if my team has finished scoring
  const myTeamProgress = teamsProgress.find((t) => t.teamId === myTeamId);
  const myTeamFinished = myTeamProgress?.finishedScoring ?? false;
  const myTeamHasAll18 = myTeamProgress?.holesScored === 18;

  // Check if all teams have marked themselves finished
  const allTeamsMarkedFinished = teamsProgress.every((t) => t.finishedScoring);

  const formatChatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

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
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => router.push("/")}
              className="flex-1 p-3 text-gray-600 border rounded hover:bg-gray-50"
            >
              ← Home
            </button>
            <button
              onClick={() => setShowEditTeamsModal(true)}
              className="flex-1 p-3 text-orange-600 border border-orange-300 rounded hover:bg-orange-50"
            >
              Edit Teams
            </button>
          </div>
        </div>

        {/* Edit Teams Unlock Modal */}
        {showEditTeamsModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                setShowEditTeamsModal(false);
                setUnlockCode("");
                setUnlockError(null);
              }}
            />
            <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
              <h2 className="text-lg font-bold mb-2">Edit Teams</h2>
              <p className="text-sm text-gray-600 mb-4">
                Enter the unlock code to go back to team setup. This will clear all scores.
              </p>
              <input
                type="text"
                placeholder="Unlock code"
                value={unlockCode}
                onChange={(e) => setUnlockCode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-3"
                autoFocus
              />
              {unlockError && (
                <p className="text-red-600 text-sm mb-3">{unlockError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowEditTeamsModal(false);
                    setUnlockCode("");
                    setUnlockError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleRevertToDraft}
                  disabled={saving}
                >
                  {saving ? "..." : "Unlock"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Still loading hole data after team selection
  if (!holeData) {
    return <p className="text-center py-8">Loading hole data...</p>;
  }

  const holeInfo = round.course.holes.find((h) => h.holeNumber === currentHole);
  const currentDisplayScore =
    (myTeamScore?.holeData?.displayScore as string | undefined) ?? null;
  const currentScoreLabel = usesIndividualScores
    ? effectiveFormat?.formatCategory === "points" ||
      effectiveFormat?.formatCategory === "match"
      ? "points"
      : effectiveFormat?.id === "vegas"
      ? "team number"
      : "team score"
    : "under par";

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
                disabled={scoreEntryBlocked}
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
        {pendingImportantMessage && (
          <div className="bg-amber-50 border-2 border-amber-400 text-amber-900 px-4 py-4 rounded-lg shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  Important Alert
                </p>
                <p className="mt-1 font-medium">
                  Team {pendingImportantMessage.senderTeamNumber}:
                </p>
                <p className="mt-1">{pendingImportantMessage.body}</p>
                <p className="mt-2 text-xs text-amber-700">
                  {formatChatTime(pendingImportantMessage.createdAt)}
                </p>
              </div>
              <Button onClick={handleAcknowledgeImportant} disabled={saving}>
                OK
              </Button>
            </div>
          </div>
        )}

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

              {effectiveFormat && effectiveFormat.id !== formatDefinition?.id && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Irish Golf segment: <strong>{effectiveFormat.name}</strong>
                </div>
              )}

              {designatedPlayer && effectiveFormat?.requiresDesignatedPlayer && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Designated player on this hole:{" "}
                  <strong>
                    {designatedPlayer.player.nickname ||
                      designatedPlayer.player.fullName}
                  </strong>
                </div>
              )}

              {/* Current Score Display */}
              <div className="text-center mb-6">
                <div className="text-6xl font-bold h-20 flex items-center justify-center">
                  {myTeamScore.entryType === null ? (
                    <span className="text-gray-300">-</span>
                  ) : myTeamScore.entryType === "X" ? (
                    <span className="text-gray-500">X</span>
                  ) : currentDisplayScore ? (
                    <span className="text-green-600">{currentDisplayScore}</span>
                  ) : usesIndividualScores ? (
                    <span className="text-green-600">{myTeamScore.value}</span>
                  ) : (
                    <span className="text-green-600">+{myTeamScore.value}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {myTeamScore.entryType === "X"
                    ? "Par or worse"
                    : currentDisplayScore
                    ? `${currentScoreLabel}: ${currentDisplayScore}`
                    : usesIndividualScores
                    ? myTeamScore.value === null
                      ? "Enter player scores"
                      : `${myTeamScore.value} ${currentScoreLabel}`
                    : myTeamScore.entryType === "VALUE"
                    ? `${myTeamScore.value} under par`
                    : "Enter your score"}
                </p>
              </div>

              {usesIndividualScores ? (
                <div className="space-y-4">
                  {playerInputs.map((input) => {
                    const isDesignated =
                      effectiveFormat?.requiresDesignatedPlayer &&
                      designatedPlayer?.playerId === input.playerId;

                    return (
                      <div
                        key={input.playerId}
                        className="rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium">{input.name}</p>
                            {isDesignated && (
                              <p className="text-xs text-amber-700">
                                Designated player this hole
                              </p>
                            )}
                          </div>
                          <input
                            type="number"
                            min="1"
                            value={input.grossScore}
                            onChange={(e) =>
                              updatePlayerInput(input.playerId, {
                                grossScore: e.target.value,
                              })
                            }
                            disabled={scoreEntryBlocked}
                            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-right text-lg"
                          />
                        </div>
                        <div className="mt-3 space-y-2">
                          {usesDriveTracking && (
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="radio"
                                name={`drive-${currentHole}`}
                                checked={input.driveSelected}
                                onChange={() => handleDriveSelection(input.playerId)}
                                disabled={scoreEntryBlocked}
                              />
                              Selected drive
                            </label>
                          )}
                          {effectiveFormat?.id === "money_ball" && isDesignated && (
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={input.moneyBallLost}
                                onChange={(e) =>
                                  updatePlayerInput(input.playerId, {
                                    moneyBallLost: e.target.checked,
                                  })
                                }
                                disabled={scoreEntryBlocked}
                              />
                              Money Ball was lost
                            </label>
                          )}
                          {effectiveFormat?.id === "wolf_team" &&
                            !isDesignated && (
                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="radio"
                                  name={`wolf-partner-${currentHole}`}
                                  checked={input.wolfPartnerSelected}
                                  onChange={() =>
                                    handleWolfPartnerSelection(input.playerId)
                                  }
                                  disabled={scoreEntryBlocked}
                                />
                                Wolf partner
                              </label>
                            )}
                          {effectiveFormat?.id === "wolf_team" && isDesignated && (
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={input.wolfLone}
                                onChange={(e) =>
                                  handleWolfPartnerSelection(
                                    e.target.checked ? null : playerInputs.find(
                                      (candidate) => candidate.wolfPartnerSelected
                                    )?.playerId ?? null
                                  )
                                }
                                disabled={scoreEntryBlocked}
                              />
                              Lone wolf
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {effectiveFormat?.id === "wolf_team" && designatedPlayer && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                      {(() => {
                        const selectedPartner = playerInputs.find(
                          (input) => input.wolfPartnerSelected
                        );
                        const designatedInput = playerInputs.find(
                          (input) => input.playerId === designatedPlayer.playerId
                        );
                        if (designatedInput?.wolfLone) {
                          return "Wolf is playing alone against the field.";
                        }
                        if (selectedPartner) {
                          return `Wolf partnered with ${selectedPartner.name} on this hole.`;
                        }
                        return "Choose the wolf partner or mark the wolf as alone.";
                      })()}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleSavePlayerScores}
                      disabled={saving || scoreEntryBlocked}
                      className="text-lg h-12"
                    >
                      Save Scores
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => loadPlayerInputs()}
                      disabled={saving}
                      className="text-lg h-12"
                    >
                      Reset Inputs
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[1, 2, 3, 4].map((num) => (
                      <Button
                        key={num}
                        variant={myTeamScore.value === num ? "primary" : "secondary"}
                        size="lg"
                        onClick={() => handleScoreEntry(myTeamId, "VALUE", num)}
                        disabled={saving || scoreEntryBlocked}
                        className="text-2xl h-14"
                      >
                        +{num}
                      </Button>
                    ))}
                  </div>

                  <div className="flex gap-2 mb-4">
                    <input
                      type="number"
                      min="1"
                      placeholder="Other score..."
                      value={customScore}
                      onChange={(e) => setCustomScore(e.target.value)}
                      disabled={scoreEntryBlocked}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-lg"
                    />
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={handleCustomScoreSubmit}
                      disabled={saving || !customScore || scoreEntryBlocked}
                      className="px-6"
                    >
                      Set
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={myTeamScore.entryType === "X" ? "primary" : "secondary"}
                      size="lg"
                      onClick={() => handleScoreEntry(myTeamId, "X")}
                      disabled={saving || scoreEntryBlocked}
                      className="text-xl h-12"
                    >
                      X (Par or worse)
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => handleClear(myTeamId)}
                      disabled={saving || myTeamScore.entryType === null || scoreEntryBlocked}
                      className="text-xl h-12"
                    >
                      Clear
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        )}

        {/* Other Teams Progress - Just show what hole they're on */}
        <Card>
          <div className="p-4">
            <h3 className="font-medium text-gray-700 mb-3">Other Teams</h3>
            <div className="space-y-2">
              {teamsProgress
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

        {effectiveFormat?.formatCategory === "skins" && (
          <button
            onClick={loadSkinsStatus}
            className="w-full py-3 bg-yellow-100 text-yellow-800 rounded-lg font-medium text-sm"
          >
            View Live Skins Status
          </button>
        )}

        <Card>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-800">Round Chat</h3>
              <span className="text-xs text-gray-500">
                {chatMessages.length} messages
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-3">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No chat yet. Send the first message to everyone in this round.
                </p>
              ) : (
                chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg border px-3 py-2 ${
                      message.isImportant
                        ? "border-amber-300 bg-amber-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          Team {message.senderTeamNumber}
                        </span>
                        {message.isImportant && (
                          <span className="text-[10px] uppercase tracking-wide bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                            Important
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatChatTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-800">{message.body}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <textarea
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Send a message to everyone in this round..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={chatImportant}
                    onChange={(e) => setChatImportant(e.target.checked)}
                  />
                  Mark as Important
                </label>
                <span className="text-xs text-gray-500">
                  {chatDraft.trim().length}/280
                </span>
              </div>
              <Button
                onClick={handleSendChatMessage}
                disabled={chatSending || !chatDraft.trim() || !myTeamId}
                className="w-full"
              >
                {chatSending ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </div>
        </Card>
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
                disabled={saving || scoreEntryBlocked}
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
            disabled={isFirstHole || scoreEntryBlocked}
          >
            ← Previous
          </Button>
          <Button
            variant={canAdvance ? "primary" : "secondary"}
            className="flex-1"
            onClick={handleNextHole}
            disabled={isLastHole || scoreEntryBlocked}
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
                        ) : hole?.displayScore ? (
                          <span className="text-green-600 font-bold">
                            {hole.displayScore}
                          </span>
                        ) : hole?.entryType === "VALUE" ? (
                          <span className="text-green-600 font-bold">
                            {usesIndividualScores ? hole.grossScore ?? hole.value : `+${hole.value}`}
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
