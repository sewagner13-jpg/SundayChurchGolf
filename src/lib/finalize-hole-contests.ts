import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { getActivePar3Contests, getPar3ContestConfig, getPar3ContestParticipantIds, type Par3HoleContestResult } from "./par3-contests";

interface ContestPlayer { id: string; playerId: string; teamId?: string | null }
interface ContestRound {
  formatConfig: unknown;
  date: Date;
  roundPlayers: ContestPlayer[];
  teams: { id: string; roundPlayers: ContestPlayer[] }[];
}

/** Stable remainder allocation, including exact reversal when editing a paid result. */
export function splitContestPayout(amount: Decimal, members: { id: string }[]) {
  const ids = members.map((member) => member.id).sort();
  const shares = new Map<string, Decimal>();
  if (!ids.length) return shares;
  const cents = amount.abs().mul(100).toDecimalPlaces(0).toNumber();
  const base = Math.floor(cents / ids.length);
  const remainder = cents % ids.length;
  ids.forEach((id, index) => shares.set(id,
    new Decimal(base + (index < remainder ? 1 : 0)).div(100).mul(amount.isNegative() ? -1 : 1)));
  return shares;
}

export function buildHoleContestPayouts(round: ContestRound) {
  const config = getPar3ContestConfig(round.formatConfig as Record<string, unknown> | null);
  const contests = getActivePar3Contests(config).sort((a, b) => a.holeNumber - b.holeNumber);
  const teamDeltas = new Map<string, Decimal>();
  const roundPlayerDeltas = new Map<string, Decimal>();
  const seasonStatDeltas = new Map<string, Decimal>();
  const results: Par3HoleContestResult[] = [];
  const add = (map: Map<string, Decimal>, id: string, amount: Decimal) => map.set(id, (map.get(id) ?? new Decimal(0)).add(amount));
  if (!config?.enabled || !contests.length) return { teamDeltas, roundPlayerDeltas, seasonStatDeltas, results };
  const participantIds = getPar3ContestParticipantIds(config, round.roundPlayers.map((player) => player.playerId));
  const totalPot = new Decimal(config.amountPerPlayer).mul(participantIds.length).toDecimalPlaces(2);
  const defaults = splitContestPayout(totalPot, contests.map((contest, index) => ({ id: String(index).padStart(3, "0"), ...contest })));
  const seen = new Set<number>();
  let assigned = new Decimal(0);
  for (const result of config.results ?? []) {
    const contestIndex = contests.findIndex((contest) => contest.holeNumber === result.holeNumber);
    if (contestIndex < 0 || seen.has(result.holeNumber)) continue;
    seen.add(result.holeNumber);
    const contest = contests[contestIndex];
    const winner = round.roundPlayers.find((player) => player.playerId === result.winnerPlayerId);
    if (result.winnerPlayerId && (!winner || !participantIds.includes(result.winnerPlayerId))) throw new Error("Hole contest winner is not an eligible participant");
    const amount = !winner ? new Decimal(0) : result.payoutAmount == null
      ? defaults.get(String(contestIndex).padStart(3, "0"))!
      : new Decimal(result.payoutAmount).toDecimalPlaces(2);
    if (!amount.isFinite() || amount.isNegative()) throw new Error("Hole contest payouts must be 0 or greater");
    assigned = assigned.add(amount);
    const payoutTarget = result.payoutTarget ?? contest.payoutTarget;
    results.push({ ...result, payoutTarget, payoutAmount: amount.toNumber() });
    if (!winner) continue;
    if (payoutTarget === "PLAYER") {
      add(roundPlayerDeltas, winner.id, amount);
      add(seasonStatDeltas, winner.playerId, amount);
    } else {
      const team = round.teams.find((team) => team.roundPlayers.some((player) => player.id === winner.id));
      if (!team) throw new Error("Hole contest winner has no team");
      add(teamDeltas, team.id, amount);
      const shares = splitContestPayout(amount, team.roundPlayers);
      for (const member of team.roundPlayers) {
        add(roundPlayerDeltas, member.id, shares.get(member.id)!);
        add(seasonStatDeltas, member.playerId, shares.get(member.id)!);
      }
    }
  }
  if (assigned.gt(totalPot)) throw new Error("Hole contest payouts exceed the available pot");
  return { teamDeltas, roundPlayerDeltas, seasonStatDeltas, results };
}

/** Called only after claiming finalization and writing main-game payouts in the same transaction. */
export async function finalizeHoleContests(tx: Prisma.TransactionClient, roundId: string) {
  const round = await tx.round.findUnique({ where: { id: roundId }, include: { roundPlayers: true, teams: { include: { roundPlayers: true } } } });
  if (!round) throw new Error("Round not found");
  const config = getPar3ContestConfig(round.formatConfig as Record<string, unknown> | null);
  if (!config?.enabled || !getActivePar3Contests(config).length) return;
  const plan = buildHoleContestPayouts(round);
  for (const [id, delta] of plan.teamDeltas) await tx.team.update({ where: { id }, data: { totalPayout: { increment: delta } } });
  for (const [id, delta] of plan.roundPlayerDeltas) await tx.roundPlayer.update({ where: { id }, data: { payoutAmount: { increment: delta } } });
  for (const [playerId, delta] of plan.seasonStatDeltas) await tx.seasonPlayerStat.upsert({
    where: { year_playerId: { year: round.date.getFullYear(), playerId } },
    update: { totalWinnings: { increment: delta } },
    create: { year: round.date.getFullYear(), playerId, totalWinnings: delta },
  });
  await tx.round.update({ where: { id: roundId }, data: { formatConfig: JSON.parse(JSON.stringify({
    ...(round.formatConfig as Prisma.JsonObject ?? {}), par3Contest: { ...config, results: plan.results },
  })) as Prisma.InputJsonValue } });
  await refreshHoleContestTopTeams(tx, roundId);
}

/** Contest corrections update round flags and season appearances by the same delta.
 * Cross-group formats pay virtual matches and intentionally have no top physical team.
 */
export async function refreshHoleContestTopTeams(tx: Prisma.TransactionClient, roundId: string) {
  const round = await tx.round.findUnique({ where: { id: roundId }, include: { roundPlayers: true } });
  if (!round) throw new Error("Round not found");
  const crossGroup = round.formatId === "cross_threesome_6_6_6" || round.formatId === "cross_foursome_6_6_6_18";
  const teams = await tx.team.findMany({ where: { roundId }, orderBy: { totalPayout: "desc" } });
  const topTotal = teams[0]?.totalPayout ?? new Decimal(0);
  const topIds = crossGroup ? [] : teams.filter((team) => team.totalPayout.eq(topTotal) && topTotal.gt(0)).map((team) => team.id);
  for (const team of teams) await tx.team.update({ where: { id: team.id }, data: { isTopPayingTeam: topIds.includes(team.id) } });
  for (const player of round.roundPlayers) {
    const isTop = topIds.includes(player.teamId ?? "");
    const delta = Number(isTop) - Number(player.wasOnTopPayingTeam);
    if (delta !== 0) await tx.seasonPlayerStat.upsert({
      where: { year_playerId: { year: round.date.getFullYear(), playerId: player.playerId } },
      update: { topTeamAppearances: { increment: delta } },
      create: { year: round.date.getFullYear(), playerId: player.playerId, topTeamAppearances: Math.max(0, delta) },
    });
    await tx.roundPlayer.update({ where: { id: player.id }, data: { wasOnTopPayingTeam: isTop } });
  }
}
