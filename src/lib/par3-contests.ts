export type Par3ContestType =
  | "CLOSEST_TO_PIN"
  | "FURTHEST_ON_GREEN"
  | "LONGEST_PUTT"
  | "MOST_PUTTS_USED_SCORE";

export type Par3PayoutTarget = "PLAYER" | "TEAM";
export type Par3FundingType = "SEPARATE_BUY_IN" | "INCLUDED_IN_MAIN_BUY_IN";

export interface Par3HoleContestConfig {
  holeNumber: number;
  contestType: Par3ContestType | "NONE";
  payoutTarget: Par3PayoutTarget;
}

export interface Par3HoleContestResult {
  holeNumber: number;
  winnerPlayerId: string | null;
  payoutAmount?: number | null;
}

export interface Par3ContestConfig {
  enabled: boolean;
  fundingType: Par3FundingType;
  amountPerPlayer: number;
  holes: Par3HoleContestConfig[];
  results?: Par3HoleContestResult[];
}

export const PAR3_CONTEST_TYPE_OPTIONS: Array<{
  value: Par3ContestType | "NONE";
  label: string;
}> = [
  { value: "NONE", label: "No contest" },
  { value: "CLOSEST_TO_PIN", label: "Closest to the hole" },
  {
    value: "FURTHEST_ON_GREEN",
    label: "Furthest from the hole but still on the green",
  },
  { value: "LONGEST_PUTT", label: "Longest putt" },
  {
    value: "MOST_PUTTS_USED_SCORE",
    label: "Most putts on a counted score",
  },
];

export const PAR3_PAYOUT_TARGET_OPTIONS: Array<{
  value: Par3PayoutTarget;
  label: string;
}> = [
  { value: "PLAYER", label: "Individual total" },
  { value: "TEAM", label: "Team total" },
];

export const PAR3_FUNDING_OPTIONS: Array<{
  value: Par3FundingType;
  label: string;
}> = [
  { value: "SEPARATE_BUY_IN", label: "Separate buy-in" },
  { value: "INCLUDED_IN_MAIN_BUY_IN", label: "Use part of main buy-in" },
];

export function getPar3ContestConfig(
  formatConfig: Record<string, unknown> | null | undefined
): Par3ContestConfig | null {
  const config = formatConfig?.par3Contest;
  if (!config || typeof config !== "object") return null;
  return config as Par3ContestConfig;
}

export function getActivePar3Contests(config: Par3ContestConfig | null | undefined) {
  if (!config?.enabled) return [];
  return (config.holes ?? []).filter((hole) => hole.contestType !== "NONE");
}

export function getPar3ContestTotalPot(
  config: Par3ContestConfig | null | undefined,
  playerCount: number
) {
  if (!config?.enabled || config.amountPerPlayer <= 0) {
    return 0;
  }
  return config.amountPerPlayer * playerCount;
}

export function getPar3ContestPrizePerHole(
  config: Par3ContestConfig | null | undefined,
  playerCount: number
) {
  const activeContests = getActivePar3Contests(config);
  if (activeContests.length === 0) {
    return 0;
  }
  return getPar3ContestTotalPot(config, playerCount) / activeContests.length;
}

export function createDefaultPar3ContestConfig(
  par3HoleNumbers: number[]
): Par3ContestConfig {
  return {
    enabled: false,
    fundingType: "SEPARATE_BUY_IN",
    amountPerPlayer: 0,
    holes: par3HoleNumbers.map((holeNumber) => ({
      holeNumber,
      contestType: "NONE",
      payoutTarget: "PLAYER",
    })),
    results: [],
  };
}
