"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmModal, Modal } from "@/components/modal";
import {
  getPlayerScores,
  upsertPlayerScoresForHole,
} from "@/actions/player-scores";
import {
  acknowledgeImportantMessage,
  getRoundChat,
  postRoundMessage,
} from "@/actions/chat";
import {
  getRound,
  revertToDraft,
  setRoundLockCode,
  updateRoundBurgerSelections,
  updateLiveRoundFormat,
} from "@/actions/rounds";
import {
  upsertHoleScore,
  getHoleView,
  getLiveLeaderboard,
  finishRound,
  getAllTeamsScorecard,
  getTeamScorecard,
  getTeamsProgress,
  getTeamDriveMinimumProgress,
  getLiveSkinsStatus,
  markTeamFinished,
  saveLoneRangerOrder,
} from "@/actions/scoring";
import { FORMAT_DEFINITIONS } from "@/lib/format-definitions";
import {
  IRISH_GOLF_ELIGIBLE_SEGMENT_FORMATS,
  type FormatConfigOption,
} from "@/lib/format-definitions";
import {
  getIrishGolfSegmentFormatId,
  getMinimumScoresRequired,
} from "@/lib/format-scoring";
import {
  PAR3_CONTEST_TYPE_OPTIONS,
  PAR3_FUNDING_OPTIONS,
  PAR3_PAYOUT_TARGET_OPTIONS,
  createDefaultPar3ContestConfig,
  getPar3ContestConfig,
  getPar3ContestParticipantIds,
  type Par3ContestConfig,
  type Par3ContestType,
  type Par3FundingType,
  type Par3PayoutTarget,
} from "@/lib/par3-contests";
import { getScoringOrder } from "@/lib/scoring-order";
import { getTeamDisplayLabel } from "@/lib/team-labels";
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

interface CombinedScoreboardHole {
  holeNumber: number;
  par: number;
  formatName: string | null;
  scoringMode: "skins" | "aggregate" | "match_play";
  isComplete: boolean;
  isTie: boolean;
  winnerTeamIds: string[];
  winnerLabel: string | null;
  teamScores: Array<{
    teamId: string;
    teamNumber: number;
    label: string;
    entryType: string | null;
    value: number | null;
    grossScore: number | null;
    displayScore: string | null;
    wasEdited: boolean;
  }>;
}

interface CombinedScoreboardData {
  teams: Array<{
    teamId: string;
    teamNumber: number;
    label: string;
    players: string[];
  }>;
  holes: CombinedScoreboardHole[];
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
  lockCode: string | null;
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
  roundPlayers: {
    id: string;
    playerId: string;
    player: { id: string; fullName: string; nickname: string | null };
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
  imageDataUrl: string | null;
  imageName: string | null;
  createdAt: string;
  senderTeamId: string;
  senderTeamNumber: number;
  acknowledgedByCurrentTeam: boolean;
}

interface PendingImportantMessage {
  id: string;
  body: string;
  imageDataUrl: string | null;
  imageName: string | null;
  createdAt: string;
  senderTeamNumber: number;
}

interface LiveLeaderboardEntry {
  teamId: string;
  teamNumber: number;
  label: string;
  holesScored: number;
  metricValue: number | null;
  metricLabel: string;
  totalPayout: number;
  segmentsWon?: number;
}

interface LiveLeaderboardSegment {
  label: string;
  formatName: string;
  completed: boolean;
  leaders: string[];
  payoutPerWinningTeam: number;
}

interface LiveLeaderboardData {
  mode: "skins" | "standard" | "irish_golf";
  title: string;
  scoringLabel: string;
  entries: LiveLeaderboardEntry[];
  segments?: LiveLeaderboardSegment[];
}

interface DriveMinimumProgress {
  enabled: boolean;
  requiredDrives: number;
  excludePar3s?: boolean;
  remainingHoles: number;
  warnings: string[];
  players: Array<{
    playerId: string;
    playerName: string;
    driveCount: number;
    stillNeeded: number;
    metMinimum: boolean;
  }>;
}

interface BurgerOrdersConfig {
  selectedPlayerIds?: string[];
  updatedAt?: string;
}

function getBurgerOrdersConfig(
  formatConfig: Record<string, unknown> | null | undefined
): BurgerOrdersConfig | null {
  const config = formatConfig?.burgerOrders;
  if (!config || typeof config !== "object") return null;
  return config as BurgerOrdersConfig;
}

function buildLiveFormatConfig(
  formatDefinition: (typeof FORMAT_DEFINITIONS)[number] | null,
  formatConfig: Record<string, unknown> | null | undefined
) {
  const nextConfig: Record<string, unknown> = {};

  for (const option of formatDefinition?.configOptions ?? []) {
    if (formatConfig?.[option.key] !== undefined) {
      nextConfig[option.key] = formatConfig[option.key];
    } else if (option.defaultValue !== undefined) {
      nextConfig[option.key] = option.defaultValue;
    }
  }

  nextConfig.enableDriveMinimums =
    typeof formatConfig?.enableDriveMinimums === "boolean"
      ? formatConfig.enableDriveMinimums
      : false;
  nextConfig.requiredDrivesPerPlayer =
    typeof formatConfig?.requiredDrivesPerPlayer === "number"
      ? formatConfig.requiredDrivesPerPlayer
      : 4;
  nextConfig.excludePar3sFromDriveMinimums =
    formatConfig?.excludePar3sFromDriveMinimums === true;

  return nextConfig;
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
  const [showCombinedScoreboard, setShowCombinedScoreboard] = useState(false);
  const [combinedScoreboard, setCombinedScoreboard] =
    useState<CombinedScoreboardData | null>(null);
  const [showOtherTeamScorecards, setShowOtherTeamScorecards] = useState(false);
  const [selectedScorecardTeamId, setSelectedScorecardTeamId] = useState<string | null>(null);
  const [selectedScorecardTeamNumber, setSelectedScorecardTeamNumber] = useState<number | null>(null);
  const [selectedScorecard, setSelectedScorecard] = useState<ScorecardHole[]>([]);
  const [customScore, setCustomScore] = useState<string>("");
  const [teamsProgress, setTeamsProgress] = useState<TeamProgress[]>([]);
  const [skinsStatus, setSkinsStatus] = useState<SkinStatus[]>([]);
  const [showSkinsStatus, setShowSkinsStatus] = useState(false);
  const [showMarkFinishedModal, setShowMarkFinishedModal] = useState(false);
  const [showEditTeamsModal, setShowEditTeamsModal] = useState(false);
  const [showEditFormatModal, setShowEditFormatModal] = useState(false);
  const [showLiveLeaderboard, setShowLiveLeaderboard] = useState(false);
  const [showBurgerModal, setShowBurgerModal] = useState(false);
  const [unlockCode, setUnlockCode] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [formatUnlockCode, setFormatUnlockCode] = useState("");
  const [formatEditError, setFormatEditError] = useState<string | null>(null);
  const [liveFormatConfigDraft, setLiveFormatConfigDraft] = useState<
    Record<string, unknown>
  >({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatImportant, setChatImportant] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatImage, setChatImage] = useState<{
    dataUrl: string;
    mimeType: string;
    fileName: string;
  } | null>(null);
  const [pendingImportantMessage, setPendingImportantMessage] =
    useState<PendingImportantMessage | null>(null);
  const [playerInputs, setPlayerInputs] = useState<PlayerHoleInputState[]>([]);
  const [driveMinimumProgress, setDriveMinimumProgress] =
    useState<DriveMinimumProgress | null>(null);
  const [liveLeaderboard, setLiveLeaderboard] =
    useState<LiveLeaderboardData | null>(null);
  const [burgerSelections, setBurgerSelections] = useState<Set<string>>(new Set());
  const [burgerSaving, setBurgerSaving] = useState(false);
  const [burgerPromptShown, setBurgerPromptShown] = useState(false);

  // Lone Ranger order setup
  const [loneRangerDraftOrder, setLoneRangerDraftOrder] = useState<{ playerId: string; name: string }[]>([]);
  const [loneRangerSaving, setLoneRangerSaving] = useState(false);
  const [freePickPlayerId, setFreePickPlayerId] = useState<string | null>(null);
  const playerInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isLive = round?.status === "LIVE";

  useEffect(() => {
    loadRound();
  }, [id]);

  useEffect(() => {
    if (round && myTeamId) {
      loadHoleData();
      loadTeamsProgress();
      loadDriveMinimumProgress();
      loadLiveLeaderboard();
      loadChat();
      loadPlayerInputs();
      // Seed draft order for lone ranger if needed
      if (effectiveFormat?.id === "lone_ranger") {
        const currentOrder = ((round.formatConfig?.loneRangerOrder as Record<string, string[]>) ?? {})[myTeamId];
        if (!currentOrder) {
          const team = round.teams.find((t) => t.id === myTeamId);
          if (team) {
            setLoneRangerDraftOrder(
              team.roundPlayers.map((rp) => ({
                playerId: rp.playerId,
                name: rp.player.nickname || rp.player.fullName,
              }))
            );
          }
        }
      }
    }
  }, [round, currentHole, myTeamId]);

  useEffect(() => {
    if (!round) return;
    const burgerConfig = getBurgerOrdersConfig(round.formatConfig);
    setBurgerSelections(new Set(burgerConfig?.selectedPlayerIds ?? []));
  }, [round]);

  useEffect(() => {
    if (!round || burgerPromptShown || currentHole < 15) return;
    setShowBurgerModal(true);
    setBurgerPromptShown(true);
  }, [round, currentHole, burgerPromptShown]);

  useEffect(() => {
    if (!round || !myTeamId) return;

    const intervalId = window.setInterval(() => {
      loadChat();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [round, myTeamId]);

  useEffect(() => {
    if (!round || !showLiveLeaderboard) return;

    const intervalId = window.setInterval(() => {
      loadLiveLeaderboard();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [round, showLiveLeaderboard]);

  useEffect(() => {
    if (!round || !showCombinedScoreboard) return;

    const intervalId = window.setInterval(() => {
      loadCombinedScoreboard();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [round, showCombinedScoreboard]);

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
      const currentFormatDefinition =
        FORMAT_DEFINITIONS.find((definition) => definition.id === data.formatId) ??
        FORMAT_DEFINITIONS.find((definition) => definition.name === data.format.name) ??
        null;
      setLiveFormatConfigDraft(
        buildLiveFormatConfig(
          currentFormatDefinition,
          data.formatConfig as Record<string, unknown> | null
        )
      );
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

  async function loadDriveMinimumProgress() {
    if (!round || !myTeamId || !round.formatConfig?.enableDriveMinimums) {
      setDriveMinimumProgress(null);
      return;
    }

    try {
      const progress = await getTeamDriveMinimumProgress(id, myTeamId);
      setDriveMinimumProgress(progress as DriveMinimumProgress);
    } catch {
      setError("Failed to load drive minimum progress");
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

  async function loadLiveLeaderboard() {
    if (!round) return;
    try {
      const leaderboard = await getLiveLeaderboard(id);
      setLiveLeaderboard(leaderboard as LiveLeaderboardData);
    } catch {
      setError("Failed to load live leaderboard");
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

  async function loadCombinedScoreboard() {
    if (!round) return;
    try {
      const data = await getAllTeamsScorecard(id);
      setCombinedScoreboard(data as CombinedScoreboardData);
    } catch {
      setError("Failed to load combined scoreboard");
    }
  }

  async function loadOtherTeamScorecard(teamId: string) {
    if (!round) return;
    try {
      const data = await getTeamScorecard(id, teamId);
      setSelectedScorecard(data);
      setSelectedScorecardTeamId(teamId);
      setSelectedScorecardTeamNumber(
        round.teams.find((team) => team.id === teamId)?.teamNumber ?? null
      );
      setShowOtherTeamScorecards(true);
    } catch (err) {
      setError("Failed to load team scorecard");
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
    if (!round || !myTeamId || (!usesIndividualScores && !usesDriveTracking)) {
      setPlayerInputs([]);
      return;
    }

    try {
      const team = round.teams.find((currentTeam) => currentTeam.id === myTeamId);
      if (!team) return;

      if (!usesIndividualScores && usesDriveTracking) {
        const selectedDrivePlayerId =
          (holeData?.teamScores.find((score) => score.teamId === myTeamId)?.holeData
            ?.drivePlayerId as string | undefined) ?? null;

        setPlayerInputs(
          team.roundPlayers.map((roundPlayer) => ({
            playerId: roundPlayer.playerId,
            name: roundPlayer.player.nickname || roundPlayer.player.fullName,
            grossScore: "",
            driveSelected: roundPlayer.playerId === selectedDrivePlayerId,
            moneyBallLost: false,
            wolfPartnerSelected: false,
            wolfLone: false,
          }))
        );
        return;
      }

      const savedScores = await getPlayerScores(id, {
        holeNumber: currentHole,
        teamId: myTeamId,
      });

      const designatedPlayerId =
        effectiveFormat?.requiresDesignatedPlayer && team.roundPlayers.length > 0
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
  // Formats where the team enters a raw gross stroke count (e.g. scramble = "3", not "+1")
  const isTeamGrossScore =
    !usesIndividualScores &&
    !!effectiveFormat &&
    effectiveFormat.formatCategory !== "skins" &&
    !!effectiveFormat.requiresTeamGrossScore;
  const usesDriveTracking =
    !!effectiveFormat?.requiresDriveTracking ||
    !!round?.formatConfig?.enableDriveMinimums;
  const minimumScoresRequired = effectiveFormat
    ? getMinimumScoresRequired(effectiveFormat.id)
    : null;
  const myTeam = myTeamId ? round?.teams.find((t) => t.id === myTeamId) : null;
  const teamSize = myTeam?.roundPlayers.length ?? 1;
  const totalHoles = round?.course?.holes?.length ?? 18;

  // Lone Ranger: stored per-team order in formatConfig.loneRangerOrder[teamId]
  const loneRangerStoredOrder =
    effectiveFormat?.id === "lone_ranger" && myTeamId
      ? ((round?.formatConfig?.loneRangerOrder as Record<string, string[]>) ?? {})[myTeamId] ?? null
      : null;

  // Holes beyond the last full rotation are "free pick"
  const lastFullRotationHole = Math.floor(totalHoles / teamSize) * teamSize;
  // scoringPosition is 0-based position in scoring order
  const scoringPosition = scoringOrder.indexOf(currentHole); // 0-based
  const isLoneRangerFreePick =
    effectiveFormat?.id === "lone_ranger" &&
    !!loneRangerStoredOrder &&
    scoringPosition >= lastFullRotationHole;

  const designatedPlayer =
    myTeamId && round && effectiveFormat?.requiresDesignatedPlayer
      ? effectiveFormat.id === "lone_ranger" && loneRangerStoredOrder
        ? isLoneRangerFreePick
          ? (freePickPlayerId
              ? myTeam?.roundPlayers.find((rp) => rp.playerId === freePickPlayerId) ?? null
              : null)
          : (myTeam?.roundPlayers.find(
              (rp) => rp.playerId === loneRangerStoredOrder[scoringPosition % teamSize]
            ) ?? null)
        : myTeam?.roundPlayers[(currentHole - 1) % teamSize] ?? null
      : null;

  // Show the Lone Ranger order setup interstitial if no order is stored yet for this team
  const showLoneRangerSetup =
    effectiveFormat?.id === "lone_ranger" &&
    !!myTeamId &&
    !loneRangerStoredOrder &&
    !!myTeam;
  const selectedDrivePlayerId =
    playerInputs.find((input) => input.driveSelected)?.playerId ?? null;
  const getTeamLabel = (teamId: string) => {
    const team = round?.teams.find((entry) => entry.id === teamId);
    return team ? getTeamDisplayLabel(team.roundPlayers) : "Team";
  };
  const isLiveIrishGolf = formatDefinition?.id === "irish_golf_6_6_6";
  const liveEligibleSegmentFormats = FORMAT_DEFINITIONS.filter((definition) =>
    IRISH_GOLF_ELIGIBLE_SEGMENT_FORMATS.includes(definition.id)
  );
  const currentPar3Contest = (() => {
    const par3Contest = round?.formatConfig?.par3Contest as
      | {
          enabled?: boolean;
          holes?: Array<{ holeNumber: number; contestType: string }>;
        }
      | undefined;
    if (!par3Contest?.enabled) return null;
    return (
      par3Contest.holes?.find(
        (holeConfig) =>
          holeConfig.holeNumber === currentHole &&
          holeConfig.contestType !== "NONE"
      ) ?? null
    );
  })();
  const par3ContestLabels: Record<string, string> = {
    CLOSEST_TO_PIN: "Closest to the hole",
    FURTHEST_ON_GREEN: "Furthest from the hole while still on the green",
    LONGEST_PUTT: "Longest putt",
    MOST_PUTTS_USED_SCORE: "Most putts on a counted score",
  };
  const liveRoundPlayers = round
    ? round.teams.flatMap((team) =>
        team.roundPlayers.map((roundPlayer) => ({
          playerId: roundPlayer.playerId,
          name: roundPlayer.player.nickname || roundPlayer.player.fullName,
        }))
      )
    : [];
  const livePar3DraftConfig = getPar3ContestConfig(
    liveFormatConfigDraft as Record<string, unknown>
  );

  useEffect(() => {
    if (round && myTeamId && usesDriveTracking && !usesIndividualScores) {
      loadPlayerInputs();
    }
  }, [holeData, round, myTeamId, usesDriveTracking, usesIndividualScores]);

  const handleScoreEntry = async (
    teamId: string,
    entryType: HoleEntryType,
    value?: number
  ) => {
    if (scoreEntryBlocked) {
      setError("Acknowledge the important alert before entering a score.");
      return;
    }

    if (!usesIndividualScores && usesDriveTracking && !selectedDrivePlayerId) {
      setError("Select the player whose drive was used.");
      return;
    }

    setSaving(true);
    try {
      await upsertHoleScore(id, teamId, currentHole, {
        entryType,
        value: entryType === "VALUE" ? value : undefined,
        selectedDrivePlayerId:
          !usesIndividualScores && usesDriveTracking
            ? selectedDrivePlayerId
            : undefined,
        isTeamGrossScore: isTeamGrossScore || undefined,
      });
      await loadHoleData();
      await loadTeamsProgress();
      await loadDriveMinimumProgress();
      await loadLiveLeaderboard();
      if (showCombinedScoreboard) {
        await loadCombinedScoreboard();
      }
      await loadPlayerInputs();
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
    setSaving(true);
    try {
      await upsertHoleScore(id, teamId, currentHole, {
        entryType: "BLANK",
        selectedDrivePlayerId:
          !usesIndividualScores && usesDriveTracking ? null : undefined,
      });
      await loadHoleData();
      await loadTeamsProgress();
      await loadDriveMinimumProgress();
      await loadLiveLeaderboard();
      if (showCombinedScoreboard) {
        await loadCombinedScoreboard();
      }
      await loadPlayerInputs();
      setCustomScore("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save score");
    }
    setSaving(false);
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

  const focusNextPlayerInput = (playerId: string) => {
    const currentIndex = playerInputs.findIndex((input) => input.playerId === playerId);
    const nextPlayerId = playerInputs[currentIndex + 1]?.playerId;
    if (!nextPlayerId) return;
    window.setTimeout(() => {
      playerInputRefs.current[nextPlayerId]?.focus();
      playerInputRefs.current[nextPlayerId]?.select();
    }, 0);
  };

  const shouldAutoAdvanceScore = (value: string) => {
    if (!/^\d+$/.test(value)) return false;
    if (value.length >= 2) return true;
    return Number(value) > 1;
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

    if (isLoneRangerFreePick && !freePickPlayerId) {
      setError("Select who carries the yellow ball on this hole before entering scores.");
      return;
    }

    if (minimumScoresRequired !== null) {
      const enteredScores = playerInputs.filter(
        (input) => input.grossScore.trim() !== ""
      ).length;
      if (enteredScores < minimumScoresRequired) {
        setError(
          `Enter at least ${minimumScoresRequired} score${
            minimumScoresRequired === 1 ? "" : "s"
          } for this format. Blank scores will be treated as higher than the counted scores.`
        );
        return;
      }
    } else if (playerInputs.some((input) => input.grossScore.trim() === "")) {
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
        })),
        isLoneRangerFreePick && freePickPlayerId ? freePickPlayerId : undefined
      );
      await loadHoleData();
      await loadTeamsProgress();
      await loadDriveMinimumProgress();
      await loadLiveLeaderboard();
      if (showCombinedScoreboard) {
        await loadCombinedScoreboard();
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save player scores"
      );
    }
    setSaving(false);
  };

  const handleSaveLoneRangerOrder = async () => {
    if (!myTeamId || loneRangerDraftOrder.length === 0) return;
    setLoneRangerSaving(true);
    try {
      await saveLoneRangerOrder(id, myTeamId, loneRangerDraftOrder.map((p) => p.playerId));
      // round will reload via revalidatePath — just reload manually
      await loadRound();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save order");
    }
    setLoneRangerSaving(false);
  };

  const moveLoneRangerPlayer = (index: number, direction: -1 | 1) => {
    const newOrder = [...loneRangerDraftOrder];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newOrder.length) return;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    setLoneRangerDraftOrder(newOrder);
  };

  const handlePrevHole = () => {
    if (currentIndex > 0) {
      const prevHole = scoringOrder[currentIndex - 1];
      setCurrentHole(prevHole);
      if (myTeamId) {
        localStorage.setItem(`round-${id}-team-${myTeamId}-hole`, String(prevHole));
      }
      setCustomScore("");
      setFreePickPlayerId(null);
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
      setFreePickPlayerId(null);
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

  const toggleBurgerSelection = (playerId: string) => {
    setBurgerSelections((current) => {
      const next = new Set(current);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const handleSaveBurgerSelections = async () => {
    setBurgerSaving(true);
    setError(null);
    try {
      const selectedPlayerIds = [...burgerSelections];
      await updateRoundBurgerSelections(id, selectedPlayerIds);
      setRound((current) =>
        current
          ? {
              ...current,
              formatConfig: {
                ...(current.formatConfig ?? {}),
                burgerOrders: {
                  selectedPlayerIds,
                  updatedAt: new Date().toISOString(),
                },
              },
            }
          : current
      );
      setShowBurgerModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save burger list");
    }
    setBurgerSaving(false);
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

  const updateLiveFormatDraft = (key: string, value: unknown) => {
    setLiveFormatConfigDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const openEditFormatModal = () => {
    const baseConfig = buildLiveFormatConfig(formatDefinition, round?.formatConfig ?? null);
    const par3HoleNumbers =
      round?.course.holes
        .filter((hole) => hole.par === 3)
        .map((hole) => hole.holeNumber) ?? [];
    const existingPar3Config = getPar3ContestConfig(round?.formatConfig ?? null);
    const participantIds = existingPar3Config
      ? getPar3ContestParticipantIds(
          existingPar3Config,
          liveRoundPlayers.map((player) => player.playerId)
        )
      : liveRoundPlayers.map((player) => player.playerId);
    setFormatUnlockCode("");
    setFormatEditError(null);
    setLiveFormatConfigDraft({
      ...baseConfig,
      par3Contest:
        existingPar3Config
          ? {
              ...existingPar3Config,
              participantPlayerIds: participantIds,
            }
          : createDefaultPar3ContestConfig(par3HoleNumbers, participantIds),
    });
    setShowEditFormatModal(true);
  };

  const handleSaveLiveFormat = async () => {
    const submittedCode = formatUnlockCode.trim();

    if (!submittedCode) {
      setFormatEditError(
        round?.lockCode ? "Enter the lock code" : "Enter a new 4-digit lock code"
      );
      return;
    }

    if (!/^\d{4}$/.test(submittedCode)) {
      setFormatEditError("Lock code must be exactly 4 digits.");
      return;
    }

    if (
      liveFormatConfigDraft.enableDriveMinimums &&
      (!Number.isFinite(Number(liveFormatConfigDraft.requiredDrivesPerPlayer)) ||
        Number(liveFormatConfigDraft.requiredDrivesPerPlayer) <= 0)
    ) {
      setFormatEditError("Minimum drives per player must be greater than 0.");
      return;
    }

    if (isLiveIrishGolf) {
      if (
        !liveFormatConfigDraft.segment1FormatId ||
        !liveFormatConfigDraft.segment2FormatId ||
        !liveFormatConfigDraft.segment3FormatId
      ) {
        setFormatEditError(
          "Irish Golf / 6-6-6 requires a format selected for all three segments."
        );
        return;
      }
    }

    const livePar3Draft = getPar3ContestConfig(
      liveFormatConfigDraft as Record<string, unknown>
    );
    if (livePar3Draft?.enabled) {
      if ((livePar3Draft.participantPlayerIds?.length ?? 0) === 0) {
        setFormatEditError("Choose at least one Par 3 contest participant.");
        return;
      }
    }

    setSaving(true);
    setFormatEditError(null);
    try {
      if (!round?.lockCode) {
        await setRoundLockCode(id, submittedCode);
      }

      await updateLiveRoundFormat(id, submittedCode, {
        formatConfig: {
          ...(round?.formatConfig ?? {}),
          ...liveFormatConfigDraft,
        },
      });
      setShowEditFormatModal(false);
      await loadRound();
      await loadHoleData();
      await loadDriveMinimumProgress();
      await loadLiveLeaderboard();
    } catch (err) {
      setFormatEditError(
        err instanceof Error ? err.message : "Failed to update format settings"
      );
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  const handleSendChatMessage = async () => {
    if (!myTeamId) return;

    setChatSending(true);
    try {
      await postRoundMessage(id, myTeamId, chatDraft, chatImportant, chatImage ?? undefined);
      setChatDraft("");
      setChatImportant(false);
      setChatImage(null);
      await loadChat();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
    setChatSending(false);
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

  const resizeChatImage = async (file: File) => {
    const originalDataUrl = await readFileAsDataUrl(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = originalDataUrl;
      });

      const maxDimension = 1600;
      const scale = Math.min(
        1,
        maxDimension / Math.max(image.width, image.height)
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        return {
          dataUrl: originalDataUrl,
          mimeType: file.type || "image/jpeg",
          fileName: file.name,
        };
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);

      return {
        dataUrl: compressedDataUrl,
        mimeType: "image/jpeg",
        fileName: file.name.replace(/\.[^.]+$/, "") + ".jpg",
      };
    } catch {
      return {
        dataUrl: originalDataUrl,
        mimeType: file.type || "image/jpeg",
        fileName: file.name,
      };
    }
  };

  const handleChatImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const resizedImage = await resizeChatImage(file);
      setChatImage(resizedImage);
      event.target.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load image");
    }
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
                  <span className="font-bold">
                    {getTeamDisplayLabel(team.roundPlayers)}
                  </span>
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
  const burgerSelectionList = round.teams
    .flatMap((team) =>
      team.roundPlayers.map((roundPlayer) => ({
        playerId: roundPlayer.playerId,
        playerName:
          roundPlayer.player.nickname || roundPlayer.player.fullName,
      }))
    )
    .filter((player) => burgerSelections.has(player.playerId));
  const canManageBurgers = currentHole >= 15 || burgerSelections.size > 0;
  const currentDisplayScore =
    (myTeamScore?.holeData?.displayScore as string | undefined) ?? null;
  const currentScoreLabel = usesIndividualScores
    ? effectiveFormat?.formatCategory === "points" ||
      effectiveFormat?.formatCategory === "match"
      ? "points"
      : effectiveFormat?.id === "vegas"
      ? "team number"
      : "team score"
    : isTeamGrossScore
    ? "strokes"
    : "under par";
  const isOpenScoringView = round.visibility !== "BLIND";

  const renderScorecardValue = (hole: ScorecardHole | undefined) => {
    if (hole?.entryType === "X") {
      return <span className="text-gray-500">X</span>;
    }
    if (hole?.displayScore) {
      return <span className="text-green-600 font-bold">{hole.displayScore}</span>;
    }
    if (hole?.entryType === "VALUE") {
      return (
        <span className="text-green-600 font-bold">
          {usesIndividualScores || isTeamGrossScore
            ? hole.grossScore ?? hole.value
            : `+${hole.value}`}
        </span>
      );
    }
    return <span className="text-gray-300">-</span>;
  };

  const renderCombinedScoreValue = (teamScore: CombinedScoreboardHole["teamScores"][number]) => {
    if (teamScore.entryType === "X") {
      return <span className="text-gray-500">X</span>;
    }
    if (teamScore.displayScore) {
      return <span className="font-bold text-green-700">{teamScore.displayScore}</span>;
    }
    if (teamScore.entryType === "VALUE") {
      if (teamScore.grossScore !== null) {
        return <span className="font-bold text-green-700">{teamScore.grossScore}</span>;
      }
      if (teamScore.value !== null) {
        return <span className="font-bold text-green-700">+{teamScore.value}</span>;
      }
    }
    return <span className="text-gray-300">-</span>;
  };

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
            <div className="flex flex-wrap justify-end gap-2">
              {canManageBurgers && (
                <button
                  onClick={() => setShowBurgerModal(true)}
                  className="px-3 py-1 bg-orange-100 text-orange-800 rounded text-sm"
                >
                  Burgers {burgerSelections.size > 0 ? `(${burgerSelections.size})` : ""}
                </button>
              )}
              <button
                onClick={openEditFormatModal}
                className="px-3 py-1 bg-amber-100 text-amber-800 rounded text-sm"
              >
                Edit Format
              </button>
              <button
                onClick={loadScorecard}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm"
              >
                Scorecard
              </button>
              <button
                onClick={() => {
                  loadLiveLeaderboard();
                  setShowLiveLeaderboard(true);
                }}
                className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded text-sm"
              >
                Leaderboard
              </button>
              {isOpenScoringView && (
                <button
                  onClick={() => {
                    loadCombinedScoreboard();
                    setShowCombinedScoreboard(true);
                  }}
                  className="px-3 py-1 bg-violet-100 text-violet-800 rounded text-sm"
                >
                  Scoreboard
                </button>
              )}
              {isOpenScoringView && (
                <button
                  onClick={() => {
                    const firstOtherTeam = round.teams.find(
                      (team) => team.id !== myTeamId
                    );
                    if (firstOtherTeam) {
                      loadOtherTeamScorecard(firstOtherTeam.id);
                    }
                  }}
                  className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-sm"
                >
                  Other Teams
                </button>
              )}
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
                Scoring for <strong>{getTeamLabel(myTeamId)}</strong>
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
        {canManageBurgers && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Burger List</p>
                <p className="text-xs text-orange-800">
                  Hole 15 and later. Use this to tell the first group in who wants burgers.
                </p>
              </div>
              <Button variant="secondary" onClick={() => setShowBurgerModal(true)}>
                Edit List
              </Button>
            </div>
            <p className="mt-2">
              {burgerSelectionList.length > 0
                ? burgerSelectionList.map((player) => player.playerName).join(", ")
                : "No burger orders selected yet."}
            </p>
          </div>
        )}

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
                {pendingImportantMessage.imageDataUrl && (
                  <img
                    src={pendingImportantMessage.imageDataUrl}
                    alt={pendingImportantMessage.imageName ?? "Important message image"}
                    className="mt-3 max-h-64 rounded-lg border border-amber-200"
                  />
                )}
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

        {/* Lone Ranger order setup interstitial */}
        {showLoneRangerSetup && (
          <Card>
            <div className="p-4">
              <div className="mb-3">
                <p className="font-semibold text-gray-800 text-lg">Set Yellow Ball Order</p>
                <p className="text-sm text-gray-500 mt-1">
                  Drag or tap the arrows to set the rotation order before you start scoring.
                  With {teamSize} players and {totalHoles} holes, the order repeats {Math.floor(totalHoles / teamSize)} time{Math.floor(totalHoles / teamSize) !== 1 ? "s" : ""}.
                  {totalHoles % teamSize > 0
                    ? ` The last ${totalHoles % teamSize} hole${totalHoles % teamSize !== 1 ? "s" : ""} (${totalHoles % teamSize === 1 ? "hole" : "holes"} ${totalHoles - (totalHoles % teamSize) + 1}–${totalHoles}) will let you freely pick who carries the yellow ball.`
                    : ""}
                </p>
              </div>
              <div className="space-y-2 mb-4">
                {loneRangerDraftOrder.map((player, index) => (
                  <div
                    key={player.playerId}
                    className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2"
                  >
                    <span className="w-6 h-6 rounded-full bg-yellow-400 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <span className="flex-1 font-medium text-gray-800">{player.name}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveLoneRangerPlayer(index, -1)}
                        className="w-8 h-8 rounded border border-gray-300 bg-white flex items-center justify-center text-sm disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === loneRangerDraftOrder.length - 1}
                        onClick={() => moveLoneRangerPlayer(index, 1)}
                        className="w-8 h-8 rounded border border-gray-300 bg-white flex items-center justify-center text-sm disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-400 mb-4">
                Hole-by-hole: {loneRangerDraftOrder.map((p, i) => (
                  <span key={p.playerId}>{i > 0 ? " → " : ""}{p.name} (H{i + 1}{teamSize < totalHoles ? `, H${i + 1 + teamSize}` : ""}{teamSize * 2 < totalHoles ? `, H${i + 1 + teamSize * 2}` : ""}{teamSize * 3 < totalHoles ? `, H${i + 1 + teamSize * 3}` : ""})</span>
                ))}
              </div>
              <Button
                onClick={handleSaveLoneRangerOrder}
                disabled={loneRangerSaving || loneRangerDraftOrder.length === 0}
                className="w-full"
                size="lg"
              >
                {loneRangerSaving ? "Saving…" : "Lock In Order"}
              </Button>
            </div>
          </Card>
        )}

        {myTeamId && myTeamScore && (
          <Card className="overflow-hidden border-2 border-green-500">
            <div className="bg-green-700 text-white px-4 py-3 flex justify-between items-center">
              <span className="font-bold text-lg">
                {getTeamLabel(myTeamScore.teamId)}
              </span>
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

              {effectiveFormat?.requiresDesignatedPlayer && (
                isLoneRangerFreePick ? (
                  <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3">
                    <p className="text-sm font-semibold text-yellow-800 mb-2">
                      Free pick — who carries the yellow ball on hole {currentHole}?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {myTeam?.roundPlayers.map((rp) => (
                        <button
                          key={rp.playerId}
                          type="button"
                          onClick={() => setFreePickPlayerId(rp.playerId)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                            freePickPlayerId === rp.playerId
                              ? "border-yellow-500 bg-yellow-400 text-white"
                              : "border-yellow-200 bg-white text-gray-700"
                          }`}
                        >
                          {rp.player.nickname || rp.player.fullName}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : designatedPlayer ? (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Yellow ball carrier this hole:{" "}
                    <strong>
                      {designatedPlayer.player.nickname ||
                        designatedPlayer.player.fullName}
                    </strong>
                    {loneRangerStoredOrder && (
                      <span className="ml-2 text-xs text-amber-600">
                        (#{(scoringPosition % teamSize) + 1} in rotation)
                      </span>
                    )}
                  </div>
                ) : null
              )}

              {minimumScoresRequired !== null && (
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  Enter at least {minimumScoresRequired} counting score
                  {minimumScoresRequired === 1 ? "" : "s"}. Any blank player score is
                  treated as worse than the counted score{minimumScoresRequired === 1 ? "" : "s"}.
                </div>
              )}

              {round?.formatConfig?.enableDriveMinimums === true && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Drive minimums are enabled for this round:
                  {" "}
                  <strong>
                    {Number(round.formatConfig.requiredDrivesPerPlayer ?? 4)} per
                    player
                  </strong>
                  {round.formatConfig.excludePar3sFromDriveMinimums === true
                    ? ", excluding par 3 holes."
                    : "."}
                </div>
              )}

              {driveMinimumProgress?.enabled && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold">Drive Minimum Progress</p>
                    <p className="text-xs">
                      {driveMinimumProgress.remainingHoles} hole
                      {driveMinimumProgress.remainingHoles === 1 ? "" : "s"} left
                      {driveMinimumProgress.excludePar3s
                        ? " that count toward the minimum"
                        : ""}
                    </p>
                  </div>
                  <div className="mt-2 space-y-1">
                    {driveMinimumProgress.players.map((player) => (
                      <div
                        key={player.playerId}
                        className="flex items-center justify-between rounded bg-white/70 px-2 py-1"
                      >
                        <span>{player.playerName}</span>
                        <span className="text-xs">
                          {player.driveCount}/{driveMinimumProgress.requiredDrives} used
                          {player.metMinimum
                            ? " • met"
                            : ` • needs ${player.stillNeeded}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  {driveMinimumProgress.warnings.length > 0 && (
                    <div className="mt-2 space-y-1 text-xs text-red-700">
                      {driveMinimumProgress.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {currentPar3Contest && (
                <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  Par 3 contest on this hole:{" "}
                  <strong>
                    {par3ContestLabels[currentPar3Contest.contestType] ??
                      "Par 3 contest"}
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
                  ) : usesIndividualScores || isTeamGrossScore ? (
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
                    : isTeamGrossScore
                    ? myTeamScore.entryType === "VALUE"
                      ? `${myTeamScore.value} strokes`
                      : "Enter team score"
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
                            ref={(element) => {
                              playerInputRefs.current[input.playerId] = element;
                            }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            enterKeyHint="next"
                            value={input.grossScore}
                            onChange={(e) =>
                              {
                                const nextValue = e.target.value.replace(/\D/g, "");
                                updatePlayerInput(input.playerId, {
                                  grossScore: nextValue,
                                });
                                if (shouldAutoAdvanceScore(nextValue)) {
                                  focusNextPlayerInput(input.playerId);
                                }
                              }
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
                  {usesDriveTracking && (
                    <div className="mb-4 space-y-3 rounded-lg border border-gray-200 p-3">
                      <p className="text-sm font-medium text-gray-800">
                        Select whose drive was used
                      </p>
                      {playerInputs.map((input) => (
                        <label
                          key={input.playerId}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <input
                            type="radio"
                            name={`team-drive-${currentHole}`}
                            checked={input.driveSelected}
                            onChange={() => handleDriveSelection(input.playerId)}
                            disabled={scoreEntryBlocked}
                          />
                          <span>{input.name}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {isTeamGrossScore ? (
                    /* Gross score entry: tap the actual number of strokes */
                    <>
                      <p className="text-xs text-gray-500 mb-2">
                        Enter the team&apos;s total strokes for this hole
                        {holeInfo ? ` (par ${holeInfo.par})` : ""}
                      </p>
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        {[2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                          <Button
                            key={num}
                            variant={myTeamScore.value === num && myTeamScore.entryType === "VALUE" ? "primary" : "secondary"}
                            size="lg"
                            onClick={() => handleScoreEntry(myTeamId, "VALUE", num)}
                            disabled={saving || scoreEntryBlocked}
                            className="text-2xl h-14"
                          >
                            {num}
                          </Button>
                        ))}
                      </div>

                      <div className="flex gap-2 mb-4">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          enterKeyHint="done"
                          placeholder="Other score..."
                          value={customScore}
                          onChange={(e) => setCustomScore(e.target.value.replace(/\D/g, ""))}
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
                    </>
                  ) : (
                    /* Skins-style entry: under-par strokes (+1 = birdie, +2 = eagle, …) */
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
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          enterKeyHint="done"
                          placeholder="Other score..."
                          value={customScore}
                          onChange={(e) => setCustomScore(e.target.value.replace(/\D/g, ""))}
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
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={myTeamScore.entryType === "X" ? "primary" : "secondary"}
                      size="lg"
                      onClick={() => handleScoreEntry(myTeamId, "X")}
                      disabled={saving || scoreEntryBlocked}
                      className="text-xl h-12"
                    >
                      {isTeamGrossScore ? "X (Pickup)" : "X (Par or worse)"}
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

        {isOpenScoringView && holeData && (
          <Card>
            <div className="p-4">
              <h3 className="font-medium text-gray-800 mb-3">
                Current Hole Scores
              </h3>
              <div className="space-y-2">
                {holeData.teamScores.map((teamScore) => {
                  const displayScore =
                    (teamScore.holeData?.displayScore as string | undefined) ??
                    null;
                  return (
                    <button
                      key={teamScore.teamId}
                      onClick={() => loadOtherTeamScorecard(teamScore.teamId)}
                      className={`w-full rounded-lg border px-3 py-3 text-left ${
                        teamScore.teamId === myTeamId
                          ? "border-green-300 bg-green-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">
                            {getTeamLabel(teamScore.teamId)}
                            {teamScore.teamId === myTeamId ? " (You)" : ""}
                          </p>
                          <p className="text-xs text-gray-500">
                            {teamScore.players.map((player) => player.name).join(", ")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-700">
                            {teamScore.entryType === "X"
                              ? "X"
                              : displayScore
                              ? displayScore
                              : teamScore.entryType === "VALUE"
                              ? usesIndividualScores || isTeamGrossScore
                                ? teamScore.grossScore ?? teamScore.value
                                : `+${teamScore.value}`
                              : "-"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Tap for full scorecard
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
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
                      <span className="font-medium text-sm">
                        {getTeamLabel(team.teamId)}
                      </span>
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
                          {getTeamLabel(message.senderTeamId)}
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
                    {message.imageDataUrl && (
                      <img
                        src={message.imageDataUrl}
                        alt={message.imageName ?? "Round chat image"}
                        className="mt-3 max-h-72 rounded-lg border border-gray-200"
                      />
                    )}
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
                <label className="text-sm text-gray-700">
                  <span className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 px-3 py-2">
                    Add Photo
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleChatImageChange}
                  />
                </label>
                {chatImage && (
                  <button
                    type="button"
                    onClick={() => setChatImage(null)}
                    className="text-xs text-red-600 underline"
                  >
                    Remove photo
                  </button>
                )}
              </div>
              {chatImage && (
                <div className="rounded-lg border border-gray-200 p-2">
                  <img
                    src={chatImage.dataUrl}
                    alt={chatImage.fileName}
                    className="max-h-48 rounded-lg"
                  />
                  <p className="mt-2 text-xs text-gray-500">{chatImage.fileName}</p>
                </div>
              )}
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
                disabled={chatSending || (!chatDraft.trim() && !chatImage) || !myTeamId}
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

      <Modal
        isOpen={showEditFormatModal}
        onClose={() => {
          setShowEditFormatModal(false);
          setFormatUnlockCode("");
          setFormatEditError(null);
        }}
        title="Edit Format"
      >
        <div className="space-y-4">
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-semibold">{round.format.name}</p>
            <p className="mt-1">
              {round.lockCode
                ? "Enter the lock code to change the active round’s format settings."
                : "This round does not have a lock code yet. Enter a 4-digit code to create one and save these changes."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Lock Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder={
                round.lockCode ? "4-digit lock code" : "Create 4-digit lock code"
              }
              value={formatUnlockCode}
              onChange={(e) => setFormatUnlockCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div className="space-y-3 rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            <p className="font-semibold">Drive Minimums</p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!liveFormatConfigDraft.enableDriveMinimums}
                onChange={(e) =>
                  updateLiveFormatDraft("enableDriveMinimums", e.target.checked)
                }
                className="h-4 w-4"
              />
              <span>Require a minimum number of drives from each player</span>
            </label>
            {!!liveFormatConfigDraft.enableDriveMinimums && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Minimum Drives Per Player
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={String(liveFormatConfigDraft.requiredDrivesPerPlayer ?? 4)}
                    onChange={(e) =>
                      updateLiveFormatDraft(
                        "requiredDrivesPerPlayer",
                        Number(e.target.value)
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={liveFormatConfigDraft.excludePar3sFromDriveMinimums === true}
                    onChange={(e) =>
                      updateLiveFormatDraft(
                        "excludePar3sFromDriveMinimums",
                        e.target.checked
                      )
                    }
                    className="h-4 w-4"
                  />
                  <span>Do not count par 3 holes toward drive minimums</span>
                </label>
              </div>
            )}
          </div>

          {formatDefinition?.configOptions
            ?.filter(
              (option) =>
                ![
                  "enableDriveMinimums",
                  "requiredDrivesPerPlayer",
                  "excludePar3sFromDriveMinimums",
                  "segment1FormatId",
                  "segment2FormatId",
                  "segment3FormatId",
                ].includes(option.key)
            )
            .map((option) => {
              if (option.type === "boolean") {
                return (
                  <label key={option.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!liveFormatConfigDraft[option.key]}
                      onChange={(e) =>
                        updateLiveFormatDraft(option.key, e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    <span>{option.label}</span>
                  </label>
                );
              }

              if (option.type === "number") {
                return (
                  <div key={option.key}>
                    <label className="block text-sm font-medium text-gray-700">
                      {option.label}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={String(
                        liveFormatConfigDraft[option.key] ??
                          option.defaultValue ??
                          ""
                      )}
                      onChange={(e) =>
                        updateLiveFormatDraft(option.key, Number(e.target.value))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </div>
                );
              }

              if (option.type === "select" && option.options) {
                return (
                  <div key={option.key}>
                    <label className="block text-sm font-medium text-gray-700">
                      {option.label}
                    </label>
                    <select
                      value={String(
                        liveFormatConfigDraft[option.key] ??
                          option.defaultValue ??
                          ""
                      )}
                      onChange={(e) =>
                        updateLiveFormatDraft(option.key, e.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    >
                      {option.options.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              return null;
            })}

          {isLiveIrishGolf && (
            <div className="space-y-3 rounded border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900">
              <p className="font-semibold">6-6-6 Segment Formats</p>
              {(
                [
                  { key: "segment1FormatId", label: "Holes 1-6 Format" },
                  { key: "segment2FormatId", label: "Holes 7-12 Format" },
                  { key: "segment3FormatId", label: "Holes 13-18 Format" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700">
                    {label}
                  </label>
                  <select
                    value={String(liveFormatConfigDraft[key] ?? "")}
                    onChange={(e) =>
                      updateLiveFormatDraft(key, e.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">Select a format...</option>
                    {liveEligibleSegmentFormats.map((format) => (
                      <option key={format.id} value={format.id}>
                        {format.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {round.course.holes.some((hole) => hole.par === 3) && livePar3DraftConfig && (
            <div className="space-y-3 rounded border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-900">
              <p className="font-semibold">Par 3 Contest</p>
              <label className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2">
                <div>
                  <p className="font-medium">Enable Par 3 contest</p>
                  <p className="text-xs text-gray-500">
                    Adjust Par 3 settings without reopening the round.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={livePar3DraftConfig.enabled}
                  onChange={(e) =>
                    updateLiveFormatDraft("par3Contest", {
                      ...livePar3DraftConfig,
                      enabled: e.target.checked,
                    } satisfies Par3ContestConfig)
                  }
                  className="h-4 w-4"
                />
              </label>

              {livePar3DraftConfig.enabled && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Funding
                      </label>
                      <select
                        value={livePar3DraftConfig.fundingType}
                        onChange={(e) =>
                          updateLiveFormatDraft("par3Contest", {
                            ...livePar3DraftConfig,
                            fundingType: e.target.value as Par3FundingType,
                          } satisfies Par3ContestConfig)
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      >
                        {PAR3_FUNDING_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Amount Per Player
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={livePar3DraftConfig.amountPerPlayer}
                        onChange={(e) =>
                          updateLiveFormatDraft("par3Contest", {
                            ...livePar3DraftConfig,
                            amountPerPlayer: Number(e.target.value) || 0,
                          } satisfies Par3ContestConfig)
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded border border-gray-200 bg-white p-3">
                    <p className="font-medium">Participants</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {liveRoundPlayers.map((player) => {
                        const participantIds =
                          livePar3DraftConfig.participantPlayerIds ?? [];
                        const checked = participantIds.includes(player.playerId);
                        return (
                          <label
                            key={player.playerId}
                            className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                updateLiveFormatDraft("par3Contest", {
                                  ...livePar3DraftConfig,
                                  participantPlayerIds: e.target.checked
                                    ? [...participantIds, player.playerId]
                                    : participantIds.filter(
                                        (playerId) => playerId !== player.playerId
                                      ),
                                } satisfies Par3ContestConfig)
                              }
                              className="h-4 w-4"
                            />
                            <span>{player.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {livePar3DraftConfig.holes.map((holeConfig) => (
                      <div
                        key={holeConfig.holeNumber}
                        className="rounded border border-gray-200 bg-white p-3"
                      >
                        <p className="mb-3 font-medium">Hole {holeConfig.holeNumber}</p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Competition
                            </label>
                            <select
                              value={holeConfig.contestType}
                              onChange={(e) =>
                                updateLiveFormatDraft("par3Contest", {
                                  ...livePar3DraftConfig,
                                  holes: livePar3DraftConfig.holes.map((hole) =>
                                    hole.holeNumber === holeConfig.holeNumber
                                      ? {
                                          ...hole,
                                          contestType: e.target.value as
                                            | Par3ContestType
                                            | "NONE",
                                        }
                                      : hole
                                  ),
                                } satisfies Par3ContestConfig)
                              }
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                            >
                              {PAR3_CONTEST_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Payout Applies To
                            </label>
                            <select
                              value={holeConfig.payoutTarget}
                              onChange={(e) =>
                                updateLiveFormatDraft("par3Contest", {
                                  ...livePar3DraftConfig,
                                  holes: livePar3DraftConfig.holes.map((hole) =>
                                    hole.holeNumber === holeConfig.holeNumber
                                      ? {
                                          ...hole,
                                          payoutTarget: e.target.value as Par3PayoutTarget,
                                        }
                                      : hole
                                  ),
                                } satisfies Par3ContestConfig)
                              }
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                            >
                              {PAR3_PAYOUT_TARGET_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {formatEditError && (
            <p className="text-sm text-red-600">{formatEditError}</p>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowEditFormatModal(false);
                setFormatUnlockCode("");
                setFormatEditError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveLiveFormat}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : round.lockCode
                  ? "Save Format"
                  : "Create Lock Code and Save"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showBurgerModal}
        onClose={() => {
          if (!burgerSaving) {
            setShowBurgerModal(false);
          }
        }}
        title="Burger List"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Check everyone who wants burgers. This list is shared across the round so
            the first group in can read it and order for everyone.
          </p>
          <div className="space-y-2 max-h-80 overflow-y-auto rounded border border-gray-200 p-2">
            {round.roundPlayers.map((roundPlayer) => (
              <label
                key={roundPlayer.id}
                className="flex items-center justify-between rounded px-2 py-2 hover:bg-gray-50"
              >
                <span className="font-medium">
                  {roundPlayer.player.nickname || roundPlayer.player.fullName}
                </span>
                <input
                  type="checkbox"
                  checked={burgerSelections.has(roundPlayer.playerId)}
                  onChange={() => toggleBurgerSelection(roundPlayer.playerId)}
                  className="h-4 w-4"
                />
              </label>
            ))}
          </div>
          <div className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {burgerSelectionList.length > 0
              ? `Ordering for: ${burgerSelectionList
                  .map((player) => player.playerName)
                  .join(", ")}`
              : "Nobody selected yet."}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowBurgerModal(false)}
              disabled={burgerSaving}
            >
              Close
            </Button>
            <Button onClick={handleSaveBurgerSelections} disabled={burgerSaving}>
              {burgerSaving ? "Saving..." : "Save Burger List"}
            </Button>
          </div>
        </div>
      </Modal>

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
                      <span className="font-bold">{getTeamLabel(team.id)}</span>
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
              {myTeamId ? getTeamLabel(myTeamId) : `Team ${myTeamNumber}`} Scorecard
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
                        {renderScorecardValue(hole)}
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

      {showOtherTeamScorecards && selectedScorecardTeamId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowOtherTeamScorecards(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-4 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">
              {getTeamLabel(selectedScorecardTeamId)} Scorecard
            </h2>
            <div className="mb-4 flex flex-wrap gap-2">
              {round.teams.map((team) => (
                <Button
                  key={team.id}
                  variant={team.id === selectedScorecardTeamId ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => loadOtherTeamScorecard(team.id)}
                >
                  {getTeamLabel(team.id)}
                </Button>
              ))}
            </div>
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
                  const hole = selectedScorecard.find((entry) => entry.holeNumber === holeNum);
                  const holeInfo = round.course.holes.find(
                    (entry) => entry.holeNumber === holeNum
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
                      <td className="py-2 text-right">{renderScorecardValue(hole)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Button
              variant="secondary"
              className="w-full mt-4"
              onClick={() => setShowOtherTeamScorecards(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {showLiveLeaderboard && liveLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowLiveLeaderboard(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-4 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{liveLeaderboard.title}</h2>
                <p className="text-xs text-gray-500">{liveLeaderboard.scoringLabel}</p>
              </div>
              <button
                onClick={() => loadLiveLeaderboard()}
                className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {liveLeaderboard.entries.map((entry, index) => (
                <div
                  key={entry.teamId}
                  className={`rounded-lg border px-3 py-3 ${
                    entry.teamId === myTeamId
                      ? "border-green-300 bg-green-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">
                        #{index + 1} {entry.label}
                        {entry.teamId === myTeamId ? " (You)" : ""}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entry.holesScored}/18 holes scored
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-700">
                        {liveLeaderboard.mode === "skins" ||
                        liveLeaderboard.mode === "irish_golf"
                          ? `$${entry.totalPayout.toFixed(2)}`
                          : entry.metricLabel}
                      </p>
                      {(liveLeaderboard.mode === "skins" ||
                        liveLeaderboard.mode === "irish_golf") && (
                        <p className="text-xs text-gray-500">{entry.metricLabel}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {liveLeaderboard.mode === "irish_golf" &&
              liveLeaderboard.segments &&
              liveLeaderboard.segments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Segment Leaders
                  </p>
                  {liveLeaderboard.segments.map((segment) => (
                    <div
                      key={segment.label}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{segment.label}</p>
                          <p className="text-xs text-gray-500">{segment.formatName}</p>
                        </div>
                        <div className="text-right text-xs">
                          <p
                            className={
                              segment.completed
                                ? "font-semibold text-green-700"
                                : "font-medium text-amber-700"
                            }
                          >
                            {segment.completed ? "Complete" : "In progress"}
                          </p>
                          <p className="text-gray-500">
                            ${segment.payoutPerWinningTeam.toFixed(2)} each
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-gray-700">
                        {segment.leaders.length > 0
                          ? `Leaders: ${segment.leaders.join(", ")}`
                          : "No leader yet"}
                      </p>
                    </div>
                  ))}
                </div>
              )}

            <Button
              variant="secondary"
              className="w-full mt-4"
              onClick={() => setShowLiveLeaderboard(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {showCombinedScoreboard && combinedScoreboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCombinedScoreboard(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-4 max-w-6xl w-full mx-4 max-h-[85vh] overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Live Match Scoreboard</h2>
                <p className="text-xs text-gray-500">
                  All teams, all holes, and the winner of each completed hole
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadCombinedScoreboard()}
                  className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setShowCombinedScoreboard(false)}
                  className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto overflow-y-auto max-h-[72vh]">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="px-2 py-2 text-left font-semibold text-gray-700">
                      Hole
                    </th>
                    {combinedScoreboard.teams.map((team) => (
                      <th
                        key={team.teamId}
                        className="px-2 py-2 text-left font-semibold text-gray-700 min-w-[180px]"
                      >
                        <div>{team.label}</div>
                        <div className="text-xs font-normal text-gray-500">
                          {team.players.join(", ")}
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 min-w-[180px]">
                      Winner
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {combinedScoreboard.holes.map((hole) => (
                    <tr
                      key={hole.holeNumber}
                      className={`border-b border-gray-100 ${
                        currentHole === hole.holeNumber ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-2 py-3 align-top">
                        <div className="font-semibold">#{hole.holeNumber}</div>
                        <div className="text-xs text-gray-500">Par {hole.par}</div>
                        {hole.formatName && (
                          <div className="mt-1 text-xs text-gray-500">
                            {hole.formatName}
                            {hole.scoringMode === "match_play" ? " • Match Play" : ""}
                          </div>
                        )}
                      </td>
                      {combinedScoreboard.teams.map((team) => {
                        const teamScore = hole.teamScores.find(
                          (entry) => entry.teamId === team.teamId
                        );
                        const isWinner =
                          !hole.isTie && hole.winnerTeamIds.includes(team.teamId);
                        return (
                          <td
                            key={`${hole.holeNumber}-${team.teamId}`}
                            className={`px-2 py-3 align-top ${
                              isWinner ? "bg-green-50" : ""
                            }`}
                          >
                            <div
                              className={
                                teamScore?.wasEdited ? "italic text-red-500" : undefined
                              }
                            >
                              {teamScore ? renderCombinedScoreValue(teamScore) : "—"}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-2 py-3 align-top">
                        {!hole.isComplete ? (
                          <span className="text-gray-400">In progress</span>
                        ) : hole.isTie ? (
                          <span className="font-medium text-yellow-700">Tie</span>
                        ) : (
                          <span className="font-semibold text-green-700">
                            {hole.winnerLabel}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
