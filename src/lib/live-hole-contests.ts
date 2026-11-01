import { getActivePar3Contests, getPar3ContestConfig, getPar3ContestParticipantIds, type Par3ContestConfig, type Par3HoleContestResult } from "./par3-contests";

export function liveContestConfig(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

/** Winners are recorded during play; finishRound awards their prizes exactly once. */
export function changeLiveHoleContestWinner(
  value: unknown,
  status: string,
  roundPlayerIds: string[],
  holeNumber: number,
  winnerPlayerId: string | null,
  expectedWinnerPlayerId: string | null,
): Record<string, unknown> & { par3Contest: Par3ContestConfig & Record<string, unknown> & { results: Par3HoleContestResult[] } } {
  if (status !== "LIVE") throw new Error("Winners can only be changed during a live round.");
  if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18) throw new Error("Invalid hole number.");
  const formatConfig = liveContestConfig(value);
  const config = getPar3ContestConfig(formatConfig);
  if (!config?.enabled) throw new Error("Hole contests are not enabled.");
  const contest = getActivePar3Contests(config).find((hole) => hole.holeNumber === holeNumber);
  if (!contest) throw new Error("No contest is configured for this hole.");
  const eligible = getPar3ContestParticipantIds(config, roundPlayerIds);
  if (winnerPlayerId !== null && !eligible.includes(winnerPlayerId)) throw new Error("Choose an eligible round player.");
  if (expectedWinnerPlayerId !== null && typeof expectedWinnerPlayerId !== "string") throw new Error("Invalid previous winner.");
  const results = config.results ?? [];
  const current = results.find((result) => result.holeNumber === holeNumber);
  if ((current?.winnerPlayerId ?? null) !== expectedWinnerPlayerId) {
    throw new Error("The winner changed in another group. Refresh and choose again.");
  }
  const result = { ...current, holeNumber, winnerPlayerId, payoutTarget: current?.payoutTarget ?? contest.payoutTarget };
  return {
    ...formatConfig,
    par3Contest: {
      ...liveContestConfig(formatConfig.par3Contest),
      ...config,
      results: [...results.filter((entry) => entry.holeNumber !== holeNumber), result].sort((a, b) => a.holeNumber - b.holeNumber),
    },
  };
}
