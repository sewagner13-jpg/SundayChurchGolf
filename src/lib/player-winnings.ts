import { calculateCrossFoursome66618PlayerPayouts, computeCrossFoursome66618GameSummaries, CROSS_FOURSOME_66618_FORMAT_ID } from "@/lib/cross-foursome-66618";
import { calculateCrossThreesome666PlayerPayouts, computeCrossThreesome666GameSummaries, CROSS_THREESOME_666_FORMAT_ID } from "@/lib/cross-threesome-666";
import { getActivePar3Contests, getPar3ContestConfig, PAR3_CONTEST_TYPE_OPTIONS } from "@/lib/par3-contests";

export interface WinningsRound {
  formatId?: string;
  format: { name: string };
  pot: number | null;
  formatConfig: Record<string, unknown> | null;
  course: { holes: Array<{ holeNumber: number; handicapRank: number | null }> };
  teams: Array<{ id: string; roundPlayers: Array<{ playerId: string }> }>;
  roundPlayers: Array<{ id: string; playerId: string; payoutAmount: number; eventHandicapIndex: number | null; player: { fullName: string; nickname: string | null } }>;
}
export interface WinningsItem {
  id: string;
  label: string;
  amountCents: number;
  kind: "bet" | "adjustment";
}
export interface PlayerWinnings {
  roundPlayerId: string;
  playerId: string;
  playerName: string;
  totalCents: number;
  items: WinningsItem[];
}
type PlayerScore = { playerId: string; holeNumber: number; grossScore: number | null };

// The engines round each player's aggregate winnings. Apportion those same cents
// among that player's bets so recurring tie shares never create fictitious money.
function allocateItemCents(items: Array<{ id: string; label: string; amount: number }>, target: number): WinningsItem[] {
  const shares = items.map((item, index) => ({ ...item, index, amountCents: Math.floor(item.amount * 100) }));
  let remainder = target - shares.reduce((sum, item) => sum + item.amountCents, 0);
  const ranked = [...shares].sort((a, b) => (b.amount * 100 - b.amountCents) - (a.amount * 100 - a.amountCents) || a.index - b.index);
  for (const item of ranked) {
    if (remainder <= 0) break;
    item.amountCents++;
    remainder--;
  }
  return shares.filter(item => item.amountCents > 0).map(({ id, label, amountCents }) => ({ id, label, amountCents, kind: "bet" }));
}

export function buildPlayerWinnings(round: WinningsRound, playerScores: PlayerScore[]): PlayerWinnings[] {
  const isFoursome = round.formatId === CROSS_FOURSOME_66618_FORMAT_ID || round.format.name === "Cross-Foursome 6-6-6-18";
  const isThreesome = round.formatId === CROSS_THREESOME_666_FORMAT_ID || round.format.name === "Cross-Threesome 6-6-6";
  const input = {
    formatConfig: round.formatConfig, playerScores, totalPot: round.pot ?? 0,
    playerHandicapIndexes: Object.fromEntries(round.roundPlayers.map(player => [player.playerId, player.eventHandicapIndex])),
    courseHandicapRanks: Object.fromEntries(round.course.holes.filter(hole => hole.handicapRank !== null).map(hole => [hole.holeNumber, hole.handicapRank as number])),
  };
  const summaries = (isFoursome ? computeCrossFoursome66618GameSummaries(input) : isThreesome ? computeCrossThreesome666GameSummaries(input) : []).filter(summary => summary.completedHoles === summary.holeNumbers.length);
  const mainPayouts = isFoursome ? calculateCrossFoursome66618PlayerPayouts(summaries as ReturnType<typeof computeCrossFoursome66618GameSummaries>) : isThreesome ? calculateCrossThreesome666PlayerPayouts(summaries as ReturnType<typeof computeCrossThreesome666GameSummaries>) : new Map<string, number>();
  const par3Config = getPar3ContestConfig(round.formatConfig);
  const contests = getActivePar3Contests(par3Config);
  const seenContestHoles = new Set<number>();
  const contestResults = (par3Config?.results ?? []).filter(result => {
    if (!contests.some(contest => contest.holeNumber === result.holeNumber) || seenContestHoles.has(result.holeNumber)) return false;
    seenContestHoles.add(result.holeNumber);
    return true;
  });

  return round.roundPlayers.map(player => {
    const mainItems = summaries.flatMap(summary => summary.pairs.flatMap(pair => pair.payout > 0 && pair.playerIds.includes(player.playerId) ? [{ id: summary.id, label: summary.label, amount: pair.payout / pair.playerIds.length }] : []));
    const items = allocateItemCents(mainItems, Math.round((mainPayouts.get(player.playerId) ?? 0) * 100));
    const contestItems = contestResults.flatMap(result => {
      if (!result.winnerPlayerId || !result.payoutAmount || result.payoutAmount <= 0) return [];
      const contest = contests.find(contest => contest.holeNumber === result.holeNumber);
      const target = result.payoutTarget ?? contest?.payoutTarget ?? "PLAYER";
      const team = round.teams.find(team => team.roundPlayers.some(member => member.playerId === result.winnerPlayerId));
      const recipients = (target === "TEAM" ? team?.roundPlayers.map(member => member.playerId) ?? [] : [result.winnerPlayerId]).sort((a, b) => {
        const aId = round.roundPlayers.find(player => player.playerId === a)?.id ?? a;
        const bId = round.roundPlayers.find(player => player.playerId === b)?.id ?? b;
        return aId < bId ? -1 : aId > bId ? 1 : 0;
      });
      if (!recipients.includes(player.playerId)) return [];
      const label = PAR3_CONTEST_TYPE_OPTIONS.find(option => option.value === contest?.contestType)?.label ?? "Par 3 contest";
      const prizeCents = Math.round(result.payoutAmount * 100);
      const amountCents = Math.floor(prizeCents / recipients.length) + (recipients.indexOf(player.playerId) < prizeCents % recipients.length ? 1 : 0);
      return [{ id: `par3-${result.holeNumber}`, label: `${label} · Hole ${result.holeNumber}${target === "TEAM" ? " (team share)" : ""}`, amount: amountCents / 100 }];
    });
    items.push(...allocateItemCents(contestItems, Math.round(contestItems.reduce((sum, item) => sum + item.amount, 0) * 100)));
    const totalCents = Math.round(player.payoutAmount * 100);
    const difference = totalCents - items.reduce((sum, item) => sum + item.amountCents, 0);
    if (difference !== 0) items.push({ id: "recorded-adjustment", label: "Recorded payout adjustment", amountCents: difference, kind: "adjustment" });
    return { roundPlayerId: player.id, playerId: player.playerId, playerName: player.player.nickname || player.player.fullName, totalCents, items };
  }).sort((a, b) => b.totalCents - a.totalCents || a.playerName.localeCompare(b.playerName));
}
