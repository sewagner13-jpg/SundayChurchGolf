"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Input } from "@/components/input";
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
import {
  PAR3_CONTEST_TYPE_OPTIONS,
  PAR3_FUNDING_OPTIONS,
  PAR3_PAYOUT_TARGET_OPTIONS,
  createDefaultPar3ContestConfig,
  getActivePar3Contests,
  getPar3ContestConfig,
  type Par3ContestConfig,
  type Par3ContestType,
  type Par3FundingType,
  type Par3PayoutTarget,
} from "@/lib/par3-contests";
import {
  FORMAT_DEFINITIONS,
  IRISH_GOLF_ELIGIBLE_SEGMENT_FORMATS,
  type FormatConfigOption,
} from "@/lib/format-definitions";
import { isHandicapStale } from "@/lib/ghin";
interface Player {
  id: string;
  fullName: string;
  nickname: string | null;
  handicapIndex: number | string | null;
  lastVerifiedDate?: Date | string | null;
  isActive: boolean;
}

interface RoundPlayer {
  id: string;
  playerId: string;
  teamId: string | null;
  eventHandicapIndex?: number | null;
  eventHandicapLockedAt?: Date | null;
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
  name?: string | null;
  status: string;
  courseId: string;
  teamSize: number | null;
  teamMode: string | null;
  formatId?: string;
  formatConfig?: Record<string, unknown> | null;
  visibility: "OPEN" | "BLIND";
  blindRevealMode?: "REVEAL_AFTER_ROUND" | "REVEAL_AFTER_HOLE";
  course: { name: string; holes: { holeNumber: number; par: number }[] };
  format: { name: string };
  date: Date;
  buyInPerPlayer: number;
  teams: Team[];
  roundPlayers: RoundPlayer[];
}

interface HistoricalTeammateRound {
  roundDate: string;
  teammatesByPlayerId: Record<
    string,
    { playerId: string; name: string }[]
  >;
}

interface TeamPairHistory {
  playerIds: [string, string];
  playerNames: [string, string];
  roundsTogether: number;
  winsTogether: number;
}

interface TeamHistoryInsight {
  teamId: string;
  exactTeamRoundsPlayed: number;
  exactTeamWins: number;
  pairHistories: TeamPairHistory[];
}

interface TeamSetupHistory {
  recentRounds: HistoricalTeammateRound[];
  teamInsightsByTeamId: Record<string, TeamHistoryInsight>;
}

interface VegasMatchup {
  teamId: string;
  opponentTeamId: string;
}

interface CourseOption {
  id: string;
  name: string;
}

interface EnrichedFormat {
  id: string;
  name: string;
  gameDescription?: string;
  supportedTeamSizes?: number[];
  configOptions?: FormatConfigOption[];
  requiresDriveTracking?: boolean;
  definitionId?: string | null;
}

function getDriveMinimumSummary(
  formatConfig: Record<string, unknown> | null | undefined
): { enabled: boolean; requiredDrivesPerPlayer: number | null } {
  const enabled = !!formatConfig?.enableDriveMinimums;
  const requiredValue = formatConfig?.requiredDrivesPerPlayer;
  return {
    enabled,
    requiredDrivesPerPlayer:
      typeof requiredValue === "number" && Number.isFinite(requiredValue)
        ? requiredValue
        : null,
  };
}

function buildDefaultFormatConfig(
  format: EnrichedFormat | null
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const option of format?.configOptions ?? []) {
    if (option.defaultValue !== undefined) {
      config[option.key] = option.defaultValue;
    }
  }
  if (config.enableDriveMinimums === undefined) {
    config.enableDriveMinimums = false;
  }
  if (config.requiredDrivesPerPlayer === undefined) {
    config.requiredDrivesPerPlayer = 4;
  }
  return config;
}

function sanitizeEditableFormatConfig(
  formatConfig: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!formatConfig) {
    return {
      enableDriveMinimums: false,
      requiredDrivesPerPlayer: 4,
    };
  }
  const { par3Contest, vegasMatchups, ...editableConfig } = formatConfig;
  void par3Contest;
  void vegasMatchups;
  return {
    enableDriveMinimums:
      typeof editableConfig.enableDriveMinimums === "boolean"
        ? editableConfig.enableDriveMinimums
        : false,
    requiredDrivesPerPlayer:
      typeof editableConfig.requiredDrivesPerPlayer === "number"
        ? editableConfig.requiredDrivesPerPlayer
        : 4,
    ...editableConfig,
  };
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
  const [showEditRoundModal, setShowEditRoundModal] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapPlayer1, setSwapPlayer1] = useState<string | null>(null);
  const [missingHandicaps, setMissingHandicaps] = useState<Player[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [lockCodeInput, setLockCodeInput] = useState("");
  const [teammateHistory, setTeammateHistory] =
    useState<TeamSetupHistory>({
      recentRounds: [],
      teamInsightsByTeamId: {},
    });
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [formats, setFormats] = useState<EnrichedFormat[]>([]);
  const [vegasMatchups, setVegasMatchups] = useState<Record<string, string>>({});
  const [par3ContestConfig, setPar3ContestConfig] =
    useState<Par3ContestConfig | null>(null);
  const [editRoundName, setEditRoundName] = useState("");
  const [editRoundDate, setEditRoundDate] = useState("");
  const [editCourseId, setEditCourseId] = useState("");
  const [editFormatId, setEditFormatId] = useState("");
  const [editBuyIn, setEditBuyIn] = useState("");
  const [editVisibility, setEditVisibility] = useState<"OPEN" | "BLIND">("OPEN");
  const [editBlindRevealMode, setEditBlindRevealMode] = useState<
    "REVEAL_AFTER_ROUND" | "REVEAL_AFTER_HOLE"
  >("REVEAL_AFTER_ROUND");
  const [editFormatConfig, setEditFormatConfig] = useState<Record<string, unknown>>(
    {}
  );
  const [draftDriveMinimumsEnabled, setDraftDriveMinimumsEnabled] = useState(false);
  const [draftRequiredDrivesPerPlayer, setDraftRequiredDrivesPerPlayer] = useState("4");

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [roundData, playersRes, coursesRes, formatsRes] = await Promise.all([
        getRound(id),
        fetch("/api/players").then((r) => {
          if (!r.ok) throw new Error("Failed to fetch players");
          return r.json();
        }),
        fetch("/api/courses").then((r) => {
          if (!r.ok) throw new Error("Failed to fetch courses");
          return r.json();
        }),
        fetch("/api/formats").then((r) => {
          if (!r.ok) throw new Error("Failed to fetch formats");
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
      setCourses(coursesRes);
      setFormats(formatsRes);
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

      const par3HoleNumbers = (roundData.course?.holes ?? [])
        .filter((hole) => hole.par === 3)
        .map((hole) => hole.holeNumber);
      const existingPar3Config = getPar3ContestConfig(
        roundData.formatConfig as Record<string, unknown> | null
      );
      setPar3ContestConfig(
        existingPar3Config ?? createDefaultPar3ContestConfig(par3HoleNumbers)
      );

      setEditRoundName(roundData.name ?? "");
      setEditRoundDate(new Date(roundData.date).toISOString().split("T")[0]);
      setEditCourseId(roundData.courseId);
      setEditFormatId(roundData.formatId ?? "");
      setEditBuyIn(String(roundData.buyInPerPlayer));
      setEditVisibility(roundData.visibility as "OPEN" | "BLIND");
      setEditBlindRevealMode(
        (roundData.blindRevealMode as "REVEAL_AFTER_ROUND" | "REVEAL_AFTER_HOLE") ??
          "REVEAL_AFTER_ROUND"
      );
      const editableFormatConfig = sanitizeEditableFormatConfig(
        roundData.formatConfig as Record<string, unknown> | null
      );
      setEditFormatConfig(editableFormatConfig);
      setDraftDriveMinimumsEnabled(
        (editableFormatConfig.enableDriveMinimums as boolean) ?? false
      );
      setDraftRequiredDrivesPerPlayer(
        String(
          (editableFormatConfig.requiredDrivesPerPlayer as number | undefined) ?? 4
        )
      );

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
      await savePar3ContestConfig();
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
  const selectedEditFormat =
    formats.find((format) => format.id === editFormatId) ?? null;
  const isEditIrishGolf = selectedEditFormat?.name === "Irish Golf / 6-6-6";
  const editEligibleSegmentFormats = formats.filter(
    (format) =>
      format.definitionId !== null &&
      IRISH_GOLF_ELIGIBLE_SEGMENT_FORMATS.includes(format.definitionId ?? "")
  );
  const par3HoleNumbers = currentRound.course.holes
    .filter((hole) => hole.par === 3)
    .map((hole) => hole.holeNumber);
  const activePar3Contests = getActivePar3Contests(par3ContestConfig);
  const staleRoundPlayers = currentRound.roundPlayers.filter((roundPlayer) =>
    isHandicapStale(
      roundPlayer.eventHandicapLockedAt
        ? roundPlayer.eventHandicapLockedAt
        : roundPlayer.player.lastVerifiedDate
    )
  );
  const driveMinimumSummary = getDriveMinimumSummary(currentRound.formatConfig);

  const openEditRoundModal = () => {
    const editableFormatConfig = sanitizeEditableFormatConfig(
      currentRound.formatConfig
    );
    setEditRoundName(currentRound.name ?? "");
    setEditRoundDate(new Date(currentRound.date).toISOString().split("T")[0]);
    setEditCourseId(currentRound.courseId);
    setEditFormatId(currentRound.formatId ?? "");
    setEditBuyIn(String(currentRound.buyInPerPlayer));
    setEditVisibility(currentRound.visibility);
    setEditBlindRevealMode(
      currentRound.blindRevealMode ?? "REVEAL_AFTER_ROUND"
    );
    setEditFormatConfig(editableFormatConfig);
    setShowEditRoundModal(true);
  };

  const handleEditFormatChange = (nextFormatId: string) => {
    const nextFormat = formats.find((format) => format.id === nextFormatId) ?? null;
    const driveConfig = {
      enableDriveMinimums: !!editFormatConfig.enableDriveMinimums,
      requiredDrivesPerPlayer:
        typeof editFormatConfig.requiredDrivesPerPlayer === "number"
          ? editFormatConfig.requiredDrivesPerPlayer
          : 4,
    };
    setEditFormatId(nextFormatId);
    setEditFormatConfig({
      ...buildDefaultFormatConfig(nextFormat),
      ...driveConfig,
    });
  };

  const updateEditFormatConfig = (key: string, value: unknown) => {
    setEditFormatConfig((current) => ({ ...current, [key]: value }));
  };

  const updateDraftDriveMinimums = (enabled: boolean, requiredDrives?: string) => {
    const normalizedRequired = requiredDrives ?? draftRequiredDrivesPerPlayer;
    setDraftDriveMinimumsEnabled(enabled);
    if (requiredDrives !== undefined) {
      setDraftRequiredDrivesPerPlayer(requiredDrives);
    }
    const parsedRequired = Number(normalizedRequired);
    const safeRequired = Number.isFinite(parsedRequired) && parsedRequired > 0
      ? parsedRequired
      : 4;
    setEditFormatConfig((current) => ({
      ...current,
      enableDriveMinimums: enabled,
      requiredDrivesPerPlayer: safeRequired,
    }));
  };

  const buildEditedRoundFormatConfig = (formatDefinitionId: string) => {
    const editableConfig = { ...editFormatConfig };
    const mergedConfig: Record<string, unknown> = { ...editableConfig };

    if (par3ContestConfig) {
      mergedConfig.par3Contest = par3ContestConfig;
    }

    if (formatDefinitionId === "vegas") {
      mergedConfig.vegasMatchups = buildVegasMatchupEntries();
    }

    return mergedConfig;
  };

  const handleSaveRoundDetails = async () => {
    if (!editCourseId || !editFormatId) {
      setError("Course and format are required.");
      return;
    }

    const parsedBuyIn = Number(editBuyIn);
    if (!Number.isFinite(parsedBuyIn) || parsedBuyIn <= 0) {
      setError("Buy-in must be greater than 0.");
      return;
    }

    if (
      editFormatConfig.enableDriveMinimums &&
      (!Number.isFinite(Number(editFormatConfig.requiredDrivesPerPlayer)) ||
        Number(editFormatConfig.requiredDrivesPerPlayer) <= 0)
    ) {
      setError("Minimum drives per player must be greater than 0.");
      return;
    }

    if (isEditIrishGolf) {
      if (
        !editFormatConfig.segment1FormatId ||
        !editFormatConfig.segment2FormatId ||
        !editFormatConfig.segment3FormatId
      ) {
        setError(
          "Irish Golf / 6-6-6 requires a format selected for all three segments."
        );
        return;
      }
    }

    if (hasTeams && selectedEditFormat?.supportedTeamSizes) {
      const currentTeamSize = currentRound.teamSize;
      if (
        currentTeamSize !== null &&
        !selectedEditFormat.supportedTeamSizes.includes(currentTeamSize)
      ) {
        setError(
          `${selectedEditFormat.name} does not support teams of ${currentTeamSize}. Choose a compatible format or regenerate teams.`
        );
        return;
      }
    }

    setActionLoading(true);
    setError(null);
    try {
      await updateRoundDraft(id, {
        name: editRoundName.trim() || undefined,
        date: new Date(editRoundDate),
        courseId: editCourseId,
        formatId: editFormatId,
        buyInPerPlayer: parsedBuyIn,
        visibility: editVisibility,
        blindRevealMode:
          editVisibility === "BLIND" ? editBlindRevealMode : undefined,
        formatConfig: buildEditedRoundFormatConfig(editFormatId),
      });
      setShowEditRoundModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update round");
    }
    setActionLoading(false);
  };

  const handleSaveDriveMinimumSettings = async () => {
    const parsedRequired = Number(draftRequiredDrivesPerPlayer);
    if (
      draftDriveMinimumsEnabled &&
      (!Number.isFinite(parsedRequired) || parsedRequired <= 0)
    ) {
      setError("Minimum drives per player must be greater than 0.");
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const nextFormatConfig = {
        ...(currentRound.formatConfig ?? {}),
        enableDriveMinimums: draftDriveMinimumsEnabled,
        requiredDrivesPerPlayer: draftDriveMinimumsEnabled
          ? parsedRequired
          : parsedRequired || 4,
      };
      await updateRoundDraft(id, {
        formatConfig: nextFormatConfig,
      });
      syncLocalRoundFormatConfig(nextFormatConfig);
      const nextEditableConfig = sanitizeEditableFormatConfig(
        nextFormatConfig
      );
      setEditFormatConfig(nextEditableConfig);
      setDraftDriveMinimumsEnabled(
        (nextEditableConfig.enableDriveMinimums as boolean) ?? false
      );
      setDraftRequiredDrivesPerPlayer(
        String(
          (nextEditableConfig.requiredDrivesPerPlayer as number | undefined) ?? 4
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save drive minimum settings"
      );
    }
    setActionLoading(false);
  };

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

  const buildDraftFormatConfig = () => ({
    ...(currentRound.formatConfig ?? {}),
    ...(par3ContestConfig ? { par3Contest: par3ContestConfig } : {}),
    ...(isVegasRound ? { vegasMatchups: buildVegasMatchupEntries() } : {}),
  });

  const syncLocalRoundFormatConfig = (nextFormatConfig: Record<string, unknown>) => {
    setRound((current) =>
      current
        ? {
            ...current,
            formatConfig: nextFormatConfig,
          }
        : current
    );
  };

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

    const nextFormatConfig = buildDraftFormatConfig();
    await updateRoundDraft(id, {
      formatConfig: nextFormatConfig,
    });
    syncLocalRoundFormatConfig(nextFormatConfig);
  }

  async function savePar3ContestConfig() {
    if (!par3ContestConfig) return;

    const nextFormatConfig = buildDraftFormatConfig();
    await updateRoundDraft(id, {
      formatConfig: nextFormatConfig,
    });
    syncLocalRoundFormatConfig(nextFormatConfig);
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
          {driveMinimumSummary.enabled && (
            <p className="mt-1 text-sm text-amber-800">
              Drive minimums enabled
              {driveMinimumSummary.requiredDrivesPerPlayer !== null
                ? `: ${driveMinimumSummary.requiredDrivesPerPlayer} per player`
                : ""}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={openEditRoundModal}>
              Edit Round
            </Button>
            <Link href={`/rounds/${id}/sunday-setup`}>
              <Button variant="secondary" size="sm">
                Sunday Setup
              </Button>
            </Link>
            {staleRoundPlayers.length > 0 && (
              <span className="text-sm text-amber-700">
                {staleRoundPlayers.length} selected player
                {staleRoundPlayers.length === 1 ? "" : "s"} still need handicap
                verification.
              </span>
            )}
          </div>
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
                <div className="space-y-3 rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                  <p className="font-semibold">Drive Minimums</p>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draftDriveMinimumsEnabled}
                      onChange={(e) =>
                        updateDraftDriveMinimums(e.target.checked)
                      }
                      disabled={actionLoading}
                      className="h-4 w-4"
                    />
                    <span>Require a minimum number of drives from each player</span>
                  </label>
                  <p>
                    This can be used with any format. If enabled, scoring will
                    require the scorer to mark whose drive was used on each hole.
                  </p>
                  {draftDriveMinimumsEnabled && (
                    <Input
                      label="Minimum Drives Per Player"
                      type="number"
                      min="1"
                      value={draftRequiredDrivesPerPlayer}
                      onChange={(e) =>
                        updateDraftDriveMinimums(true, e.target.value)
                      }
                      disabled={actionLoading}
                    />
                  )}
                  <Button
                    variant="secondary"
                    onClick={handleSaveDriveMinimumSettings}
                    disabled={actionLoading}
                  >
                    Save Drive Minimums
                  </Button>
                </div>
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
                  const teamInsight = teammateHistory.teamInsightsByTeamId[team.id];

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
                          const repeatHistory = teammateHistory.recentRounds
                            .map((historyRound) => {
                              const historicalPartners =
                                historyRound.teammatesByPlayerId[rp.playerId] ?? [];
                              const repeatPartners = historicalPartners.filter((partner) =>
                                team.roundPlayers.some(
                                  (teamPlayer) => teamPlayer.playerId === partner.playerId
                                )
                              );

                              if (repeatPartners.length === 0) {
                                return null;
                              }

                              return {
                                roundDate: historyRound.roundDate,
                                repeatPartners,
                              };
                            })
                            .filter(
                              (
                                entry
                              ): entry is {
                                roundDate: string;
                                repeatPartners: { playerId: string; name: string }[];
                              } => entry !== null
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
                                {repeatHistory.map((history) => (
                                    <p
                                      key={`${rp.playerId}-${history.roundDate}`}
                                      className="text-xs text-amber-700"
                                    >
                                      {formatShortDate(history.roundDate)}:{" "}
                                      {history.repeatPartners
                                        .map((partner) => partner.name)
                                        .join(", ")}
                                    </p>
                                  ))}
                              </div>
                              <span className="text-sm text-gray-500">
                                {rp.player.handicapIndex ?? "-"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {teamInsight && (
                        <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                          {(teamInsight.exactTeamRoundsPlayed > 0 ||
                            teamInsight.exactTeamWins > 0) && (
                            <p className="text-xs text-gray-600">
                              This exact team has played together{" "}
                              <span className="font-semibold">
                                {teamInsight.exactTeamRoundsPlayed}
                              </span>{" "}
                              time
                              {teamInsight.exactTeamRoundsPlayed === 1 ? "" : "s"}{" "}
                              and finished top team{" "}
                              <span className="font-semibold">
                                {teamInsight.exactTeamWins}
                              </span>{" "}
                              time{teamInsight.exactTeamWins === 1 ? "" : "s"}.
                            </p>
                          )}
                          {teamInsight.pairHistories.filter((pair) => pair.roundsTogether > 0)
                            .length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-600">
                                Pair history on this team
                              </p>
                              {teamInsight.pairHistories
                                .filter((pair) => pair.roundsTogether > 0)
                                .slice(0, 4)
                                .map((pair) => (
                                  <p
                                    key={pair.playerIds.join("|")}
                                    className="text-xs text-gray-500"
                                  >
                                    {pair.playerNames.join(" + ")}:{" "}
                                    {pair.roundsTogether} round
                                    {pair.roundsTogether === 1 ? "" : "s"}{" "}
                                    together, {pair.winsTogether} top-team finish
                                    {pair.winsTogether === 1 ? "" : "es"}
                                  </p>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>

              {par3HoleNumbers.length > 0 && par3ContestConfig && (
                <Card>
                  <CardHeader>Par 3 Contest</CardHeader>
                  <CardContent className="space-y-4">
                    <label className="flex items-center justify-between rounded border border-gray-200 px-3 py-2">
                      <div>
                        <p className="font-medium">Enable Par 3 contest</p>
                        <p className="text-sm text-gray-500">
                          Pick the side game for each par 3 and how it pays out.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={par3ContestConfig.enabled}
                        onChange={(e) =>
                          setPar3ContestConfig((current) =>
                            current
                              ? { ...current, enabled: e.target.checked }
                              : current
                          )
                        }
                        className="h-5 w-5"
                        disabled={isLocked || actionLoading}
                      />
                    </label>

                    {par3ContestConfig.enabled && (
                      <>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Select
                            label="Funding"
                            value={par3ContestConfig.fundingType}
                            onChange={(e) =>
                              setPar3ContestConfig((current) =>
                                current
                                  ? {
                                      ...current,
                                      fundingType: e.target.value as Par3FundingType,
                                    }
                                  : current
                              )
                            }
                            options={PAR3_FUNDING_OPTIONS}
                            disabled={isLocked || actionLoading}
                          />
                          <Input
                            label="Amount Per Player"
                            type="number"
                            min="0"
                            step="1"
                            value={par3ContestConfig.amountPerPlayer}
                            onChange={(e) =>
                              setPar3ContestConfig((current) =>
                                current
                                  ? {
                                      ...current,
                                      amountPerPlayer: Number(e.target.value) || 0,
                                    }
                                  : current
                              )
                            }
                            disabled={isLocked || actionLoading}
                          />
                        </div>

                        <div className="space-y-3">
                          {par3ContestConfig.holes.map((holeConfig) => (
                            <div
                              key={holeConfig.holeNumber}
                              className="rounded-lg border border-gray-200 p-3"
                            >
                              <p className="mb-3 font-medium">
                                Hole {holeConfig.holeNumber}
                              </p>
                              <div className="grid gap-4 md:grid-cols-2">
                                <Select
                                  label="Competition"
                                  value={holeConfig.contestType}
                                  onChange={(e) =>
                                    setPar3ContestConfig((current) =>
                                      current
                                        ? {
                                            ...current,
                                            holes: current.holes.map((hole) =>
                                              hole.holeNumber === holeConfig.holeNumber
                                                ? {
                                                    ...hole,
                                                    contestType: e.target.value as
                                                      | Par3ContestType
                                                      | "NONE",
                                                  }
                                                : hole
                                            ),
                                          }
                                        : current
                                    )
                                  }
                                  options={PAR3_CONTEST_TYPE_OPTIONS}
                                  disabled={isLocked || actionLoading}
                                />
                                <Select
                                  label="Payout Applies To"
                                  value={holeConfig.payoutTarget}
                                  onChange={(e) =>
                                    setPar3ContestConfig((current) =>
                                      current
                                        ? {
                                            ...current,
                                            holes: current.holes.map((hole) =>
                                              hole.holeNumber === holeConfig.holeNumber
                                                ? {
                                                    ...hole,
                                                    payoutTarget: e.target.value as Par3PayoutTarget,
                                                  }
                                                : hole
                                            ),
                                          }
                                        : current
                                    )
                                  }
                                  options={PAR3_PAYOUT_TARGET_OPTIONS}
                                  disabled={isLocked || actionLoading}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-600">
                          {activePar3Contests.length > 0
                            ? `${activePar3Contests.length} par 3 contest hole${activePar3Contests.length === 1 ? "" : "s"} configured. Enter winners after the round on the summary page.`
                            : "Choose at least one par 3 hole competition if this side game is enabled."}
                        </p>
                      </>
                    )}

                    <Button
                      variant="secondary"
                      onClick={async () => {
                        setActionLoading(true);
                        setError(null);
                        try {
                          await savePar3ContestConfig();
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Failed to save Par 3 contest"
                          );
                        }
                        setActionLoading(false);
                      }}
                      disabled={isLocked || actionLoading}
                    >
                      {actionLoading ? "Saving..." : "Save Par 3 Contest"}
                    </Button>
                  </CardContent>
                </Card>
              )}

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

      <Modal
        isOpen={showEditRoundModal}
        onClose={() => setShowEditRoundModal(false)}
        title="Edit Round"
      >
        <div className="space-y-4">
          <Input
            label="Round Name (optional)"
            type="text"
            value={editRoundName}
            onChange={(e) => setEditRoundName(e.target.value)}
            placeholder="e.g., Week 1"
          />

          <Input
            label="Date"
            type="date"
            value={editRoundDate}
            onChange={(e) => setEditRoundDate(e.target.value)}
            required
          />

          <Select
            label="Course"
            value={editCourseId}
            onChange={(e) => setEditCourseId(e.target.value)}
            options={courses.map((course) => ({
              value: course.id,
              label: course.name,
            }))}
            required
          />

          <Select
            label="Format"
            value={editFormatId}
            onChange={(e) => handleEditFormatChange(e.target.value)}
            options={formats.map((format) => ({
              value: format.id,
              label: format.name,
            }))}
            required
          />

          {selectedEditFormat?.gameDescription && (
            <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              {selectedEditFormat.gameDescription}
            </div>
          )}

          {hasTeams &&
            selectedEditFormat?.supportedTeamSizes &&
            currentRound.teamSize !== null &&
            !selectedEditFormat.supportedTeamSizes.includes(currentRound.teamSize) && (
              <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                This format does not support your current teams of{" "}
                {currentRound.teamSize}. Save is blocked until you choose a
                compatible format or regenerate teams.
              </div>
            )}

          {selectedEditFormat?.configOptions &&
            selectedEditFormat.configOptions.length > 0 && (
              <div className="space-y-3 rounded border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Format Options
                </p>
                {selectedEditFormat.configOptions.map((option) => {
                  if (
                    isEditIrishGolf &&
                    [
                      "segment1FormatId",
                      "segment2FormatId",
                      "segment3FormatId",
                    ].includes(option.key)
                  ) {
                    return null;
                  }

                  if (
                    ["enableDriveMinimums", "requiredDrivesPerPlayer"].includes(
                      option.key
                    )
                  ) {
                    return null;
                  }

                  if (option.type === "boolean") {
                    return (
                      <label
                        key={option.key}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={!!editFormatConfig[option.key]}
                          onChange={(e) =>
                            updateEditFormatConfig(option.key, e.target.checked)
                          }
                          className="h-4 w-4"
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  }

                  if (option.type === "number") {
                    return (
                      <Input
                        key={option.key}
                        label={option.label}
                        type="number"
                        min="1"
                        value={String(
                          editFormatConfig[option.key] ??
                            option.defaultValue ??
                            ""
                        )}
                        onChange={(e) =>
                          updateEditFormatConfig(
                            option.key,
                            Number(e.target.value)
                          )
                        }
                      />
                    );
                  }

                  if (option.type === "select" && option.options) {
                    return (
                      <Select
                        key={option.key}
                        label={option.label}
                        value={String(
                          editFormatConfig[option.key] ??
                            option.defaultValue ??
                            ""
                        )}
                        onChange={(e) =>
                          updateEditFormatConfig(option.key, e.target.value)
                        }
                        options={option.options.map((choice) => ({
                          value: choice.value,
                          label: choice.label,
                        }))}
                      />
                    );
                  }

                  return null;
                })}
              </div>
            )}

          <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Drive Minimums
            </p>
            <label className="flex items-center gap-2 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={!!editFormatConfig.enableDriveMinimums}
                onChange={(e) =>
                  updateEditFormatConfig("enableDriveMinimums", e.target.checked)
                }
                className="h-4 w-4"
              />
              <span>Require a minimum number of drives from each player</span>
            </label>
            <p className="text-sm text-amber-900">
              This works with any format and turns on drive selection during
              scoring.
            </p>
            {!!editFormatConfig.enableDriveMinimums && (
              <Input
                label="Minimum Drives Per Player"
                type="number"
                min="1"
                value={String(editFormatConfig.requiredDrivesPerPlayer ?? 4)}
                onChange={(e) =>
                  updateEditFormatConfig(
                    "requiredDrivesPerPlayer",
                    Number(e.target.value)
                  )
                }
              />
            )}
          </div>

          {isEditIrishGolf && (
            <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                6-6-6 Segment Formats
              </p>
              {(
                [
                  { key: "segment1FormatId", label: "Holes 1-6 Format" },
                  { key: "segment2FormatId", label: "Holes 7-12 Format" },
                  { key: "segment3FormatId", label: "Holes 13-18 Format" },
                ] as const
              ).map(({ key, label }) => (
                <Select
                  key={key}
                  label={label}
                  value={String(editFormatConfig[key] ?? "")}
                  onChange={(e) =>
                    updateEditFormatConfig(key, e.target.value)
                  }
                  options={[
                    { value: "", label: "Select a format..." },
                    ...editEligibleSegmentFormats.map((format) => ({
                      value: format.definitionId ?? format.id,
                      label: format.name,
                    })),
                  ]}
                  required
                />
              ))}
            </div>
          )}

          <Input
            label="Buy-in per Player ($)"
            type="number"
            min="1"
            value={editBuyIn}
            onChange={(e) => setEditBuyIn(e.target.value)}
            required
          />

          <Select
            label="Visibility"
            value={editVisibility}
            onChange={(e) =>
              setEditVisibility(e.target.value as "OPEN" | "BLIND")
            }
            options={[
              { value: "OPEN", label: "Open (all teams see scores)" },
              { value: "BLIND", label: "Blind (hidden until revealed)" },
            ]}
          />

          {editVisibility === "BLIND" && (
            <Select
              label="Blind Reveal Mode"
              value={editBlindRevealMode}
              onChange={(e) =>
                setEditBlindRevealMode(
                  e.target.value as
                    | "REVEAL_AFTER_ROUND"
                    | "REVEAL_AFTER_HOLE"
                )
              }
              options={[
                {
                  value: "REVEAL_AFTER_ROUND",
                  label: "Reveal after round ends",
                },
                {
                  value: "REVEAL_AFTER_HOLE",
                  label: "Reveal after each hole",
                },
              ]}
            />
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowEditRoundModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveRoundDetails}
              disabled={actionLoading}
            >
              {actionLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>

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
