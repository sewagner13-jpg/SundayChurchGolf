"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getRound, deleteRound, reopenRound } from "@/actions/rounds";
import { savePar3ContestResults } from "@/actions/par3-contests";
import { getTopTeamHistory } from "@/actions/season-stats";
import { getPlayerScores, type PlayerScoreRecord } from "@/actions/player-scores";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Button } from "@/components/button";
import { ConfirmModal, Modal } from "@/components/modal";
import { Select } from "@/components/select";
import { getScoringOrder } from "@/lib/scoring-order";
import { FORMAT_DEFINITIONS, getFormatById } from "@/lib/format-definitions";
import { computeIrishGolfSegmentSummaries, computeIrishGolfOverallSummary } from "@/lib/irish-golf";
import {
  computeFormatScore,
  computeVegasMatchRound,
  getMinimumScoresRequired,
  getIrishGolfSegmentFormatId,
  type PlayerInput,
} from "@/lib/format-scoring";
import {
  getActivePar3Contests,
  getPar3ContestConfig,
  getPar3ContestPrizePerHole,
  getPar3ContestParticipantIds,
  PAR3_PAYOUT_TARGET_OPTIONS,
  type Par3PayoutTarget,
  type Par3HoleContestResult,
} from "@/lib/par3-contests";
import { computePar3PlayerBonuses } from "@/lib/payout-breakdown";
import { getTeamDisplayLabel } from "@/lib/team-labels";
interface Team {
  id: string;
  teamNumber: number;
  totalPayout: number;
  isTopPayingTeam: boolean;
  roundPlayers: {
    id: string;
    playerId: string;
    player: { fullName: string; nickname: string | null };
  }[];
}

interface HoleScore {
  teamId: string;
  holeNumber: number;
  entryType: string;
  value: number | null;
  grossScore: number | null;
  holeData?: Record<string, unknown> | null;
  wasEdited: boolean;
}

interface HoleResult {
  holeNumber: number;
  winnerTeamId: string | null;
  isTie: boolean;
  holePayout: number;
  carrySkinsUsed: number;
}

interface Round {
  id: string;
  date: Date;
  status: string;
  lockCode: string | null;
  startingHole: number | null;
  formatConfig: Record<string, unknown> | null;
  buyInPerPlayer: number;
  pot: number | null;
  baseSkinValue: number | null;
  tiebreakerTeamId: string | null;
  tiebreakerHoleNum: number | null;
  tiebreakerSkinsWon: number | null;
  course: {
    name: string;
    holes: { holeNumber: number; par: number }[];
  };
  format: { name: string };
  teams: Team[];
  roundPlayers: {
    id: string;
    playerId: string;
    payoutAmount: number;
    wasOnTopPayingTeam: boolean;
    player: { fullName: string; nickname: string | null };
  }[];
  holeScores: HoleScore[];
  holeResults: HoleResult[];
}

export default function RoundSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [round, setRound] = useState<Round | null>(null);
  const [topTeamHistories, setTopTeamHistories] = useState<
    { teamId: string; count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [playerScores, setPlayerScores] = useState<PlayerScoreRecord[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenCode, setReopenCode] = useState("");
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [par3Results, setPar3Results] = useState<Par3HoleContestResult[]>([]);
  const [savingPar3Results, setSavingPar3Results] = useState(false);

  useEffect(() => {
    loadRound();
  }, [id]);

  async function loadRound() {
    const data = await getRound(id);
    if (!data) {
      router.push("/");
      return;
    }

    if (data.status === "DRAFT") {
      router.push(`/rounds/${id}/setup`);
      return;
    }

    if (data.status === "LIVE") {
      router.push(`/rounds/${id}/scoring`);
      return;
    }

    setRound(data as Round);
    const par3Config = getPar3ContestConfig(
      data.formatConfig as Record<string, unknown> | null
    );
    setPar3Results(par3Config?.results ?? []);

    // Load player scores if this format requires individual scores
    const formatDef = FORMAT_DEFINITIONS.find((d) => d.name === data.format.name);
    if (formatDef?.requiresIndividualScores) {
      const scores = await getPlayerScores(id);
      setPlayerScores(scores);
    }

    // Get top team histories
    const topTeams = data.teams.filter((t) => t.isTopPayingTeam);
    const histories = await Promise.all(
      topTeams.map(async (team) => {
        const playerIds = team.roundPlayers.map((rp) => rp.playerId);
        const count = await getTopTeamHistory(playerIds);
        return { teamId: team.id, count };
      })
    );
    setTopTeamHistories(histories);
    setLoading(false);
  }

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteRound(id);
      router.push("/");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete round");
      setDeleting(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenCode.trim()) {
      setReopenError("Enter the lock code");
      return;
    }
    setReopening(true);
    try {
      await reopenRound(id, reopenCode.trim());
      router.push(`/rounds/${id}/scoring`);
    } catch (err) {
      setReopenError(err instanceof Error ? err.message : "Failed to reopen round");
      setReopening(false);
    }
  };

  const handleSavePar3Results = async () => {
    setSavingPar3Results(true);
    try {
      await savePar3ContestResults(id, par3Results);
      await loadRound();
      router.push(`/rounds/${id}/final-payouts`);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to save Par 3 contest winners"
      );
      setSavingPar3Results(false);
      return;
    }
    setSavingPar3Results(false);
  };

  if (loading || !round) {
    return <p className="text-center py-8">Loading...</p>;
  }

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const scoringOrder = getScoringOrder(round.startingHole ?? 1);
  const topTeams = round.teams.filter((t) => t.isTopPayingTeam);
  const getTeamLabel = (team: Team) => getTeamDisplayLabel(team.roundPlayers);

  // Format-aware leaderboard computation
  const formatDef = FORMAT_DEFINITIONS.find((d) => d.name === round.format.name);
  const isSkins = !formatDef || formatDef.formatCategory === "skins";
  const isPoints =
    formatDef?.formatCategory === "points" ||
    formatDef?.formatCategory === "match";
  const isMoneyBallFormat = formatDef?.id === "money_ball";
  const isVegasFormat = formatDef?.id === "vegas";
  const isIrishGolfFormat = formatDef?.id === "irish_golf_6_6_6";
  const isBestBallFormat =
    !!formatDef && getMinimumScoresRequired(formatDef.id) !== null;

  interface TeamTotal {
    total: number | null;
    mbTotal: number | null;
    mbLosses: number;
    displayScores: string[];
  }
  const teamTotals = new Map<string, TeamTotal>();
  round.teams.forEach((team) =>
    teamTotals.set(team.id, {
      total: null,
      mbTotal: null,
      mbLosses: 0,
      displayScores: [],
    })
  );

  if (!isSkins && playerScores.length > 0) {
    if (isVegasFormat) {
      const matchupMap = new Map<string, string>(
        (
          (round.formatConfig as {
            vegasMatchups?: Array<{ teamId: string; opponentTeamId: string }>;
          } | null)?.vegasMatchups ?? []
        ).map((matchup) => [matchup.teamId, matchup.opponentTeamId])
      );
      const pairedTeams: Team[][] = [];
      const handledTeamIds = new Set<string>();

      for (const team of round.teams) {
        if (handledTeamIds.has(team.id)) continue;
        const opponentTeamId = matchupMap.get(team.id);
        const opponent = round.teams.find(
          (candidate) => candidate.id === opponentTeamId
        );
        if (opponent) {
          pairedTeams.push([team, opponent]);
          handledTeamIds.add(team.id);
          handledTeamIds.add(opponent.id);
        }
      }

      for (const pair of pairedTeams) {
        if (pair.length < 2) {
          teamTotals.get(pair[0].id)!.displayScores = scoringOrder.map(() => "-");
          continue;
        }

        const [team1, team2] = pair;
        const holeSummaries = scoringOrder.map((holeNumber) => {
          const hole = round.course.holes.find(
            (courseHole) => courseHole.holeNumber === holeNumber
          )!;
          const team1Scores = team1.roundPlayers.map((roundPlayer) => {
            const score = playerScores.find(
              (playerScore) =>
                playerScore.teamId === team1.id &&
                playerScore.playerId === roundPlayer.playerId &&
                playerScore.holeNumber === holeNumber
            );
            return score?.grossScore ?? null;
          }) as [number | null, number | null];
          const team2Scores = team2.roundPlayers.map((roundPlayer) => {
            const score = playerScores.find(
              (playerScore) =>
                playerScore.teamId === team2.id &&
                playerScore.playerId === roundPlayer.playerId &&
                playerScore.holeNumber === holeNumber
            );
            return score?.grossScore ?? null;
          }) as [number | null, number | null];

          return {
            holeNumber,
            team1Scores,
            team2Scores,
            par: hole.par,
          };
        });

        const vegasRound = computeVegasMatchRound(holeSummaries, {
          enableBirdieFlip:
            (round.formatConfig?.enableBirdieFlip as boolean) ?? false,
          pointsCarryOver:
            (round.formatConfig?.pointsCarryOver as boolean) ?? false,
        });

        teamTotals.get(team1.id)!.total = vegasRound.team1Total;
        teamTotals.get(team2.id)!.total = vegasRound.team2Total;
        teamTotals.get(team1.id)!.displayScores = vegasRound.holes.map(
          (hole) => (hole.team1Number === null ? "-" : String(hole.team1Number))
        );
        teamTotals.get(team2.id)!.displayScores = vegasRound.holes.map(
          (hole) => (hole.team2Number === null ? "-" : String(hole.team2Number))
        );
      }
    } else {
    for (const hole of round.course.holes) {
      for (const team of round.teams) {
        const teamPs = playerScores.filter(
          (ps) => ps.teamId === team.id && ps.holeNumber === hole.holeNumber
        );
        const players: PlayerInput[] = team.roundPlayers.map((rp) => {
          const ps = teamPs.find((s) => s.playerId === rp.playerId);
          return {
            playerId: rp.playerId,
            playerName: rp.player.fullName,
            grossScore: ps?.grossScore ?? null,
            driveSelected: (ps?.extraData?.driveSelected as boolean) ?? false,
          };
        });

        const effectiveFormatId =
          formatDef?.id === "irish_golf_6_6_6"
            ? getIrishGolfSegmentFormatId(hole.holeNumber, round.formatConfig ?? {}) ??
              formatDef.id
            : (formatDef?.id ?? "");

        const current = teamTotals.get(team.id)!;
        let displayScore = "-";
        let holeScore: number | null = null;
        const designatedPlayerId =
          effectiveFormatId === "money_ball" ||
          effectiveFormatId === "lone_ranger" ||
          effectiveFormatId === "wolf_team"
            ? team.roundPlayers[
                (hole.holeNumber - 1) % team.roundPlayers.length
              ]?.playerId ?? null
            : null;
        const designatedScore = designatedPlayerId
          ? teamPs.find((score) => score.playerId === designatedPlayerId)
          : null;
        const result = computeFormatScore(
          effectiveFormatId,
          players,
          hole.holeNumber,
          hole.par,
          {
            designatedPlayerId,
            moneyBallPlayerId: designatedPlayerId,
            moneyBallLost:
              (designatedScore?.extraData?.moneyBallLost as boolean) ?? false,
          },
          round.formatConfig ?? {}
        );

        if (result) {
          holeScore = result.teamGrossScore;
          displayScore =
            result.teamDisplayScore ??
            result.teamGrossScore?.toString() ??
            "-";
          if (
            effectiveFormatId === "money_ball" &&
            "moneyBallAdjustedScore" in result
          ) {
            if (result.moneyBallAdjustedScore !== null) {
              current.mbTotal =
                (current.mbTotal ?? 0) + result.moneyBallAdjustedScore;
            }
            if ((result.extraData.moneyBallLost as boolean) ?? false) {
              current.mbLosses++;
            }
          }
        }

        if (holeScore !== null) current.total = (current.total ?? 0) + holeScore;
        current.displayScores.push(displayScore);
      }
    }
    }
  }

  const sortedTeams = [...round.teams].sort((a, b) => {
    const aT = teamTotals.get(a.id)?.total ?? (isPoints ? -Infinity : Infinity);
    const bT = teamTotals.get(b.id)?.total ?? (isPoints ? -Infinity : Infinity);
    return isPoints ? bT - aT : aT - bT;
  });

  const holeResultsMap = new Map(
    round.holeResults.map((hr) => [hr.holeNumber, hr])
  );

  const holeScoresMap = new Map<string, HoleScore>();
  round.holeScores.forEach((hs) => {
    holeScoresMap.set(`${hs.teamId}-${hs.holeNumber}`, hs);
  });

  const renderHoleScoreDisplay = (score: HoleScore | undefined) => {
    if (!score || score.entryType === "BLANK") {
      return "-";
    }
    if (score.entryType === "X") {
      return "X";
    }

    const displayScore =
      (score.holeData as { displayScore?: string } | null)?.displayScore ?? null;
    if (displayScore) {
      return displayScore;
    }

    if (score.entryType === "VALUE") {
      return score.grossScore ?? score.value ?? "-";
    }

    return "-";
  };

  const countedScoreUsage = new Map<string, number>();
  if (!isSkins && isBestBallFormat && playerScores.length > 0) {
    for (const score of playerScores) {
      countedScoreUsage.set(score.playerId, 0);
    }

    for (const hole of round.course.holes) {
      for (const team of round.teams) {
        const teamPs = playerScores.filter(
          (ps) => ps.teamId === team.id && ps.holeNumber === hole.holeNumber
        );
        const players: PlayerInput[] = team.roundPlayers.map((rp) => {
          const ps = teamPs.find((s) => s.playerId === rp.playerId);
          return {
            playerId: rp.playerId,
            playerName: rp.player.fullName,
            grossScore: ps?.grossScore ?? null,
          };
        });

        const effectiveFormatId =
          formatDef?.id === "irish_golf_6_6_6"
            ? getIrishGolfSegmentFormatId(hole.holeNumber, round.formatConfig ?? {}) ??
              formatDef.id
            : (formatDef?.id ?? "");

        if (getMinimumScoresRequired(effectiveFormatId) === null) {
          continue;
        }

        const result = computeFormatScore(
          effectiveFormatId,
          players,
          hole.holeNumber,
          hole.par,
          {},
          round.formatConfig ?? {}
        );

        result?.countedPlayerIds.forEach((playerId) => {
          countedScoreUsage.set(playerId, (countedScoreUsage.get(playerId) ?? 0) + 1);
        });
      }
    }
  }

  const par3ContestConfig = getPar3ContestConfig(round.formatConfig);
  const par3ParticipantIds = getPar3ContestParticipantIds(
    par3ContestConfig,
    round.roundPlayers.map((roundPlayer) => roundPlayer.playerId)
  );
  const activePar3Contests = getActivePar3Contests(par3ContestConfig);
  const par3PrizePerHole = getPar3ContestPrizePerHole(
    par3ContestConfig,
    round.roundPlayers.map((roundPlayer) => roundPlayer.playerId)
  );
  const par3TotalPot =
    (par3ContestConfig?.amountPerPlayer ?? 0) * par3ParticipantIds.length;
  const par3AssignedPayout = par3Results.reduce(
    (sum, result) => sum + (result.payoutAmount ?? 0),
    0
  );
  const par3RemainingPot = Math.max(0, par3TotalPot - par3AssignedPayout);
  const par3ResultsMap = new Map(
    par3Results.map((result) => [result.holeNumber, result])
  );
  const par3ContestPayoutTargets = new Map(
    activePar3Contests.map((contest) => [contest.holeNumber, contest.payoutTarget])
  );
  const par3PlayerBonuses = computePar3PlayerBonuses(
    round.teams,
    par3Results,
    par3ContestPayoutTargets
  );
  const playerTeamMap = new Map<string, number>();
  round.teams.forEach((team) => {
    team.roundPlayers.forEach((roundPlayer) => {
      playerTeamMap.set(roundPlayer.playerId, team.teamNumber);
    });
  });
  const par3ContestTypeLabels: Record<string, string> = {
    CLOSEST_TO_PIN: "Closest to the hole",
    FURTHEST_ON_GREEN: "Furthest from the hole while still on the green",
    LONGEST_PUTT: "Longest putt",
    MOST_PUTTS_USED_SCORE: "Most putts on a counted score",
    NONE: "No contest",
  };
  const irishGolfSegments = isIrishGolfFormat
    ? computeIrishGolfSegmentSummaries(
        round.teams.map((team) => ({
          id: team.id,
          teamNumber: team.teamNumber,
        })),
        round.holeScores.map((holeScore) => ({
          teamId: holeScore.teamId,
          holeNumber: holeScore.holeNumber,
          entryType: holeScore.entryType,
          value: holeScore.value,
          grossScore: holeScore.grossScore,
        })),
        round.formatConfig ?? null,
        round.pot ?? 0
      )
    : [];
  const irishGolfOverall = isIrishGolfFormat
    ? computeIrishGolfOverallSummary(
        round.teams.map((team) => ({
          id: team.id,
          teamNumber: team.teamNumber,
        })),
        round.holeScores.map((holeScore) => ({
          teamId: holeScore.teamId,
          holeNumber: holeScore.holeNumber,
          entryType: holeScore.entryType,
          value: holeScore.value,
          grossScore: holeScore.grossScore,
        })),
        round.formatConfig ?? null,
        round.pot ?? 0
      )
    : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Round Summary</h1>
        <div className="flex gap-2">
          {round.lockCode && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setReopenCode("");
                setReopenError(null);
                setShowReopenModal(true);
              }}
            >
              Reopen
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </Button>
          <Link href="/">
            <Button variant="secondary" size="sm">
              Back
            </Button>
          </Link>
          <Link href={`/rounds/${id}/final-payouts`}>
            <Button variant="secondary" size="sm">
              Final Payouts
            </Button>
          </Link>
        </div>
      </div>

      {/* Round Info */}
      <Card>
        <CardContent>
          <h2 className="font-bold text-lg">{formatDate(round.date)}</h2>
          <p className="text-gray-600">{round.course.name}</p>
          <p className="text-gray-600">{round.format.name}</p>
          <div className="mt-2 flex gap-4 text-sm">
            <span>
              <strong>{round.roundPlayers.length}</strong> players
            </span>
            <span>
              <strong>${round.buyInPerPlayer}</strong> buy-in
            </span>
            <span>
              <strong>${round.pot ?? 0}</strong> pot
            </span>
          </div>
        </CardContent>
      </Card>

      {activePar3Contests.length > 0 && (
        <Card>
          <CardHeader>Par 3 Contest</CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-3">
              <p>
                Funding:{" "}
                <strong>
                  {par3ContestConfig?.fundingType === "INCLUDED_IN_MAIN_BUY_IN"
                    ? "From main buy-in"
                    : "Separate buy-in"}
                </strong>
              </p>
              <p>
                Amount per player:{" "}
                <strong>${par3ContestConfig?.amountPerPlayer ?? 0}</strong>
              </p>
              <p>
                Participants: <strong>{par3ParticipantIds.length}</strong>
              </p>
              <p>
                Suggested split:{" "}
                <strong>${par3PrizePerHole.toFixed(2)}</strong>
              </p>
              <p>
                Assigned:{" "}
                <strong>${par3AssignedPayout.toFixed(2)}</strong>
              </p>
              <p>
                Remaining:{" "}
                <strong>${par3RemainingPot.toFixed(2)}</strong>
              </p>
            </div>

            <div className="space-y-3">
              {activePar3Contests.map((contest) => (
                <div
                  key={contest.holeNumber}
                  className="rounded-lg border border-gray-200 p-3"
                >
                  <div className="mb-3">
                    <p className="font-medium">Hole {contest.holeNumber}</p>
                    <p className="text-sm text-gray-500">
                      {par3ContestTypeLabels[contest.contestType] ?? "Par 3 contest"}{" "}
                      •{" "}
                      {(par3ResultsMap.get(contest.holeNumber)?.payoutTarget ??
                        contest.payoutTarget) === "TEAM"
                        ? "Shares with team"
                        : "Winner keeps it"}
                    </p>
                  </div>
                  <Select
                    label="Winner"
                    value={par3ResultsMap.get(contest.holeNumber)?.winnerPlayerId ?? ""}
                    onChange={(e) =>
                      setPar3Results((current) => {
                        const next = current.filter(
                          (result) => result.holeNumber !== contest.holeNumber
                        );
                        const existing = par3ResultsMap.get(contest.holeNumber);
                        next.push({
                          holeNumber: contest.holeNumber,
                          winnerPlayerId: e.target.value || null,
                          payoutAmount:
                            e.target.value === ""
                              ? 0
                              : existing?.payoutAmount ?? par3PrizePerHole,
                          payoutTarget:
                            existing?.payoutTarget ?? contest.payoutTarget,
                        });
                        return next.sort((a, b) => a.holeNumber - b.holeNumber);
                      })
                    }
                    options={[
                      { value: "", label: "No winner entered yet" },
                      ...round.roundPlayers
                        .filter((roundPlayer) =>
                          par3ParticipantIds.includes(roundPlayer.playerId)
                        )
                        .map((roundPlayer) => ({
                        value: roundPlayer.playerId,
                        label: `${roundPlayer.player.nickname || roundPlayer.player.fullName} (Team ${playerTeamMap.get(roundPlayer.playerId) ?? "—"})`,
                      })),
                    ]}
                    disabled={savingPar3Results}
                  />
                  <Select
                    label="Winner keeps it or shares?"
                    value={
                      par3ResultsMap.get(contest.holeNumber)?.payoutTarget ??
                      contest.payoutTarget
                    }
                    onChange={(e) =>
                      setPar3Results((current) => {
                        const next = current.filter(
                          (result) => result.holeNumber !== contest.holeNumber
                        );
                        const existing = par3ResultsMap.get(contest.holeNumber);
                        next.push({
                          holeNumber: contest.holeNumber,
                          winnerPlayerId: existing?.winnerPlayerId ?? null,
                          payoutAmount:
                            existing?.payoutAmount ?? par3PrizePerHole,
                          payoutTarget: e.target.value as Par3PayoutTarget,
                        });
                        return next.sort((a, b) => a.holeNumber - b.holeNumber);
                      })
                    }
                    options={PAR3_PAYOUT_TARGET_OPTIONS.map((option) => ({
                      value: option.value,
                      label:
                        option.value === "TEAM"
                          ? "Share with team"
                          : "Keep individually",
                    }))}
                    disabled={savingPar3Results}
                  />
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Payout Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={String(
                        par3ResultsMap.get(contest.holeNumber)?.payoutAmount ?? 0
                      )}
                      onChange={(e) =>
                        setPar3Results((current) => {
                          const next = current.filter(
                            (result) => result.holeNumber !== contest.holeNumber
                          );
                          const existing = par3ResultsMap.get(contest.holeNumber);
                          next.push({
                            holeNumber: contest.holeNumber,
                            winnerPlayerId: existing?.winnerPlayerId ?? null,
                            payoutAmount: Number(e.target.value) || 0,
                            payoutTarget:
                              existing?.payoutTarget ?? contest.payoutTarget,
                          });
                          return next.sort((a, b) => a.holeNumber - b.holeNumber);
                        })
                      }
                      disabled={savingPar3Results}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Suggested: ${par3PrizePerHole.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleSavePar3Results} disabled={savingPar3Results}>
              {savingPar3Results ? "Saving..." : "Save and Open Payouts"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Non-skins: Team Leaderboard */}
      {isIrishGolfFormat && (
        <Card>
          <CardHeader>6-6-6 Segment Results</CardHeader>
          <CardContent className="space-y-4">
            {irishGolfSegments.map((segment) => (
              <div
                key={segment.segmentIndex}
                className="rounded-lg border border-gray-200 p-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{segment.label}</p>
                    <p className="text-sm text-gray-500">
                      {FORMAT_DEFINITIONS.find(
                        (definition) => definition.id === segment.formatId
                      )?.name ?? "Segment format"}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-green-700">
                    ${segment.segmentPot.toFixed(2)} segment pot
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {round.teams.map((team) => {
                    const isWinner = segment.winningTeamIds.includes(team.id);
                    return (
                      <div
                        key={`${segment.segmentIndex}-${team.id}`}
                        className={`flex items-center justify-between rounded border px-3 py-2 ${
                          isWinner
                            ? "border-green-300 bg-green-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div>
                          <p className="font-medium">{getTeamLabel(team)}</p>
                          <p className="text-xs text-gray-500">
                            {team.roundPlayers
                              .map((roundPlayer) =>
                                roundPlayer.player.nickname ||
                                roundPlayer.player.fullName
                              )
                              .join(", ")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {segment.teamTotals.get(team.id) ?? 0}
                          </p>
                          {isWinner && (
                            <p className="text-xs text-green-700">
                              Wins ${segment.payoutPerWinningTeam.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {irishGolfOverall && (
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{irishGolfOverall.label}</p>
                    <p className="text-sm text-gray-500">Overall 18-hole result</p>
                  </div>
                  <p className="text-sm font-medium text-green-700">
                    ${irishGolfOverall.overallPot.toFixed(2)} overall pot
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {round.teams.map((team) => {
                    const isWinner = irishGolfOverall.winningTeamIds.includes(team.id);
                    return (
                      <div
                        key={`overall-${team.id}`}
                        className={`flex items-center justify-between rounded border px-3 py-2 ${
                          isWinner
                            ? "border-green-300 bg-green-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div>
                          <p className="font-medium">{getTeamLabel(team)}</p>
                          <p className="text-xs text-gray-500">
                            {team.roundPlayers
                              .map((roundPlayer) =>
                                roundPlayer.player.nickname ||
                                roundPlayer.player.fullName
                              )
                              .join(", ")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {irishGolfOverall.teamTotals.get(team.id) ?? 0}
                          </p>
                          {isWinner && (
                            <p className="text-xs text-green-700">
                              Wins ${irishGolfOverall.payoutPerWinningTeam.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isSkins && !isIrishGolfFormat && playerScores.length > 0 && (
        <Card>
          <CardHeader>Leaderboard — {round.format.name}</CardHeader>
          <CardContent className="space-y-2">
            {sortedTeams.map((team, idx) => {
              const totals = teamTotals.get(team.id);
              return (
                <div key={team.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400 w-6">#{idx + 1}</span>
                    <div>
                      <p className="font-semibold">{getTeamLabel(team)}</p>
                      <p className="text-xs text-gray-500">
                        {team.roundPlayers.map((rp) => rp.player.nickname || rp.player.fullName).join(", ")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-700">
                      {totals?.total !== null && totals?.total !== undefined ? totals.total : "—"}
                    </p>
                    <p className="text-xs text-gray-500">{isPoints ? "pts" : "strokes"}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Money Ball dual-score table */}
      {isMoneyBallFormat && playerScores.length > 0 && (
        <Card>
          <CardHeader>Money Ball Scores</CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="py-2 text-left">Team</th>
                  <th className="py-2 text-center">Competition</th>
                  <th className="py-2 text-center">MB Total</th>
                  <th className="py-2 text-center">MB Lost</th>
                  <th className="py-2 text-center">Penalty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {round.teams.map((team) => {
                  const totals = teamTotals.get(team.id);
                  const penaltyStrokes = (round.formatConfig?.moneyBallPenaltyStrokes as number) ?? 4;
                  return (
                    <tr key={team.id}>
                      <td className="py-2 font-medium">{getTeamLabel(team)}</td>
                      <td className="py-2 text-center">{totals?.total ?? "—"}</td>
                      <td className="py-2 text-center">{totals?.mbTotal ?? "—"}</td>
                      <td className="py-2 text-center">{totals?.mbLosses ?? 0}</td>
                      <td className="py-2 text-center text-red-600">
                        {totals?.mbLosses ? `+${totals.mbLosses * penaltyStrokes}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Non-skins hole-by-hole table */}
      {!isSkins && round.holeScores.length > 0 && (
        <Card>
          <CardHeader>Hole-by-Hole Scores</CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500">
                    <th className="py-2 text-left font-medium">Hole</th>
                    {sortedTeams.map((team) => (
                      <th key={team.id} className="py-2 text-center font-medium">
                        T{team.teamNumber}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scoringOrder.map((holeNumber, holeIndex) => {
                    const holeInfo = round.course.holes.find(
                      (hole) => hole.holeNumber === holeNumber
                    );
                    return (
                      <tr key={holeNumber} className="border-b">
                        <td className="py-2 pl-1">
                          <span className="font-medium">{holeNumber}</span>
                          <span className="text-gray-400 text-xs ml-1">
                            P{holeInfo?.par}
                          </span>
                        </td>
                        {sortedTeams.map((team) => {
                          const score = holeScoresMap.get(`${team.id}-${holeNumber}`);
                          return (
                            <td key={team.id} className="py-2 text-center">
                              {renderHoleScoreDisplay(score)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!isSkins && isBestBallFormat && countedScoreUsage.size > 0 && (
        <Card>
          <CardHeader>Counted Score Usage</CardHeader>
          <CardContent className="space-y-2">
            {round.roundPlayers
              .slice()
              .sort(
                (a, b) =>
                  (countedScoreUsage.get(b.playerId) ?? 0) -
                  (countedScoreUsage.get(a.playerId) ?? 0)
              )
              .map((roundPlayer) => (
                <div
                  key={roundPlayer.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                >
                  <span className="font-medium">
                    {roundPlayer.player.nickname || roundPlayer.player.fullName}
                  </span>
                  <span className="text-sm text-gray-600">
                    Counted on {countedScoreUsage.get(roundPlayer.playerId) ?? 0} hole
                    {(countedScoreUsage.get(roundPlayer.playerId) ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            <p className="text-xs text-gray-500">
              Tied scores at the counting cutoff credit every tied player.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top Paying Team(s) */}
      {isSkins && topTeams.length > 0 && (
        <Card className="border-2 border-yellow-400 bg-yellow-50">
          <CardHeader>Top Paying Team(s)</CardHeader>
          <CardContent className="space-y-4">
            {topTeams.map((team) => {
              const history = topTeamHistories.find(
                (h) => h.teamId === team.id
              );
              return (
                <div key={team.id} className="border-b last:border-b-0 pb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">{getTeamLabel(team)}</span>
                    <span className="text-green-600 font-bold text-lg">
                      ${Math.round(team.totalPayout)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {team.roundPlayers
                      .map((rp) => rp.player.nickname || rp.player.fullName)
                      .join(", ")}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Times this exact team has played together:{" "}
                    {history?.count ?? 1}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Payout Summary */}
      {isSkins && (
      <Card>
        <CardHeader>Payout Summary</CardHeader>
        <CardContent>
          <div className="text-xs text-gray-500 mb-3">
            Skin value: ${round.baseSkinValue?.toFixed(2) ?? "—"} each &bull; {round.roundPlayers.length} players &bull; ${round.pot ?? 0} pot
          </div>
          <div className="space-y-3">
            {round.teams
              .sort((a, b) => b.totalPayout - a.totalPayout)
              .map((team) => {
                // Count skins won by this team
                const skinsWon = round.holeResults
                  .filter((hr) => hr.winnerTeamId === team.id)
                  .reduce((sum, hr) => sum + (hr.carrySkinsUsed || 1), 0);
                return (
                  <div
                    key={team.id}
                    className={`rounded-lg p-3 border ${
                      team.isTopPayingTeam
                        ? "border-green-400 bg-green-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold">Team {team.teamNumber}</span>
                        {team.isTopPayingTeam && (
                          <span className="ml-2 text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded">WINNER</span>
                        )}
                        <p className="text-sm text-gray-600 mt-0.5">
                          {team.roundPlayers
                            .map((rp) => rp.player.nickname || rp.player.fullName)
                            .join(" & ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${team.isTopPayingTeam ? "text-green-600" : "text-gray-800"}`}>
                          ${Math.round(team.totalPayout)}
                        </p>
                        {skinsWon > 0 && (
                          <p className="text-xs text-gray-500">{skinsWon} skin{skinsWon !== 1 ? "s" : ""} won</p>
                        )}
                      </div>
                    </div>
                    {/* Per-player payout */}
                    <div className="mt-2 pt-2 border-t border-gray-200 flex flex-wrap gap-x-4 gap-y-1">
                      {team.roundPlayers.map((rp) => {
                        const playerRecord = round.roundPlayers.find(
                          (p) => p.playerId === rp.playerId
                        );
                        return (
                          <div key={rp.id} className="text-sm flex gap-1">
                            <span className="text-gray-600">
                              {rp.player.nickname || rp.player.fullName}:
                            </span>
                            <span className="font-semibold text-gray-800">
                              ${Math.round(playerRecord?.payoutAmount ?? 0)}
                            </span>
                            {(par3PlayerBonuses.get(rp.playerId) ?? 0) > 0 && (
                              <span className="text-xs text-gray-500">
                                (includes ${Math.round(
                                  par3PlayerBonuses.get(rp.playerId) ?? 0
                                )} Par 3)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Hole-by-Hole Results */}
      {isSkins && (
      <Card>
        <CardHeader>Hole-by-Hole Results</CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="py-2 text-left font-medium">Hole</th>
                  {round.teams.map((team) => (
                    <th key={team.id} className="py-2 text-center font-medium">
                      T{team.teamNumber}
                    </th>
                  ))}
                  <th className="py-2 text-right font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {scoringOrder.map((holeNumber) => {
                  const result = holeResultsMap.get(holeNumber);
                  const holeInfo = round.course.holes.find(
                    (h) => h.holeNumber === holeNumber
                  );
                  const isCarryover = (result?.carrySkinsUsed ?? 0) > 1;

                  // For Irish Golf: compute per-hole winner
                  let irishHoleWinnerTeamIds: string[] = [];
                  let irishHoleIsTie = false;
                  if (isIrishGolfFormat) {
                    const segmentFormatId = getIrishGolfSegmentFormatId(holeNumber, round.formatConfig ?? {});
                    const segmentFmt = segmentFormatId ? getFormatById(segmentFormatId) : null;
                    const higherIsBetter = segmentFmt?.formatCategory === "points" || segmentFmt?.formatCategory === "match";
                    const teamScoreValues = round.teams.map((team) => {
                      const s = holeScoresMap.get(`${team.id}-${holeNumber}`);
                      return { teamId: team.id, value: s?.entryType === "VALUE" ? (s.value ?? null) : null };
                    }).filter((t) => t.value !== null) as { teamId: string; value: number }[];
                    if (teamScoreValues.length > 0) {
                      const best = higherIsBetter
                        ? Math.max(...teamScoreValues.map((t) => t.value))
                        : Math.min(...teamScoreValues.map((t) => t.value));
                      irishHoleWinnerTeamIds = teamScoreValues.filter((t) => t.value === best).map((t) => t.teamId);
                      irishHoleIsTie = irishHoleWinnerTeamIds.length > 1;
                    }
                  }

                  return (
                    <tr
                      key={holeNumber}
                      className={`border-b ${
                        isSkins
                          ? result?.winnerTeamId
                            ? isCarryover
                              ? "bg-orange-50"
                              : "bg-green-50"
                            : result?.isTie
                            ? "bg-yellow-50"
                            : ""
                          : isIrishGolfFormat && !irishHoleIsTie && irishHoleWinnerTeamIds.length > 0
                          ? "bg-green-50"
                          : isIrishGolfFormat && irishHoleIsTie
                          ? "bg-yellow-50"
                          : ""
                      }`}
                    >
                      <td className="py-2 pl-1">
                        <span className="font-medium">{holeNumber}</span>
                        <span className="text-gray-400 text-xs ml-1">
                          P{holeInfo?.par}
                        </span>
                        {isCarryover && (
                          <span className="ml-1 text-xs font-bold text-orange-600">
                            ×{result!.carrySkinsUsed}
                          </span>
                        )}
                      </td>
                      {round.teams.map((team) => {
                        const score = holeScoresMap.get(
                          `${team.id}-${holeNumber}`
                        );
                        const isWinner = isIrishGolfFormat
                          ? irishHoleWinnerTeamIds.includes(team.id)
                          : result?.winnerTeamId === team.id;

                        return (
                          <td
                            key={team.id}
                            className={`py-2 text-center ${
                              isWinner ? "font-bold text-green-700" : ""
                            } ${score?.wasEdited ? "italic text-red-500" : ""}`}
                          >
                            {score?.entryType === "X"
                              ? "X"
                              : score?.entryType === "VALUE"
                              ? score.value
                              : "-"}
                          </td>
                        );
                      })}
                      <td className="py-2 pr-1 text-right text-xs whitespace-nowrap">
                        {isIrishGolfFormat ? (
                          irishHoleIsTie ? (
                            <span className="text-yellow-600 font-medium">Tie</span>
                          ) : irishHoleWinnerTeamIds.length > 0 ? (
                            <span className="text-green-700 font-bold">
                              T{round.teams.find((t) => irishHoleWinnerTeamIds.includes(t.id))?.teamNumber}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )
                        ) : result?.isTie ? (
                          <span className="text-yellow-600 font-medium">Carry</span>
                        ) : result?.winnerTeamId ? (
                          <span className="text-green-700 font-bold">
                            T{round.teams.find((t) => t.id === result.winnerTeamId)?.teamNumber}{" "}
                            <span className="text-green-600">${Math.round(result.holePayout)}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-gray-50 text-xs font-medium text-gray-600">
                  <td className="py-2 pl-1">Total</td>
                  {round.teams.map((team) => (
                    <td key={team.id} className="py-2 text-center">
                      ${Math.round(team.totalPayout)}
                    </td>
                  ))}
                  <td className="py-2 pr-1 text-right">${round.pot ?? 0}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {isSkins ? "×2, ×3 etc. = skins carried from ties • " : ""}Italic = edited score{isIrishGolfFormat ? " • Green = hole winner" : ""}
          </p>
        </CardContent>
      </Card>
      )}

      {/* Tiebreaker Result */}
      {isSkins && round.tiebreakerSkinsWon && round.tiebreakerSkinsWon > 0 && (
        <Card className="border-2 border-purple-400 bg-purple-50">
          <CardHeader>Carryover Tiebreaker</CardHeader>
          <CardContent>
            <p className="text-sm">
              <strong>{round.tiebreakerSkinsWon} skins</strong> were carried over
              at the end of the round.
            </p>
            {round.tiebreakerTeamId ? (
              <p className="text-sm mt-2">
                <span className="text-purple-700 font-bold">
                  Team{" "}
                  {round.teams.find((t) => t.id === round.tiebreakerTeamId)
                    ?.teamNumber}
                </span>{" "}
                won the tiebreaker on{" "}
                <strong>Hole {round.tiebreakerHoleNum}</strong> (handicap rank
                tiebreaker) and received{" "}
                <span className="text-green-600 font-bold">
                  $
                  {Math.round(
                    round.tiebreakerSkinsWon * (round.baseSkinValue ?? 0)
                  )}
                </span>
              </p>
            ) : (
              <p className="text-sm mt-2 text-gray-600">
                No single winner could be determined by handicap rank.{" "}
                <strong>
                  $
                  {Math.round(
                    round.tiebreakerSkinsWon * (round.baseSkinValue ?? 0)
                  )}
                </strong>{" "}
                was split evenly among all teams.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Round"
        message="Are you sure you want to delete this round? This will also remove the stats from the leaderboard. This cannot be undone."
        confirmText={deleting ? "Deleting..." : "Delete Round"}
        confirmVariant="danger"
      />

      <Modal
        isOpen={showReopenModal}
        onClose={() => {
          setShowReopenModal(false);
          setReopenCode("");
          setReopenError(null);
        }}
        title="Reopen Round"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter the round lock code to reopen this round for scoring corrections.
            Season stats will be reversed until the round is finished again.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Lock Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={reopenCode}
              onChange={(e) => setReopenCode(e.target.value)}
              placeholder="4-digit lock code"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          {reopenError && <p className="text-sm text-red-600">{reopenError}</p>}
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setShowReopenModal(false);
                setReopenCode("");
                setReopenError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleReopen} disabled={reopening}>
              {reopening ? "Reopening..." : "Reopen Round"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
