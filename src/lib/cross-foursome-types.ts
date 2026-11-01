import type { CrossFoursomePartnerSlot } from "@/lib/cross-foursome-partner-draw";

export type CrossFoursomeScoreMode = "best_ball" | "best_net_ball";
export type CrossFoursomeASlot = "A1" | "A2" | "A3" | "A4";
export type CrossFoursomeBSlot = "B1" | "B2" | "B3" | "B4";
export type CrossFoursomeGameId =
  | "first6"
  | "second6"
  | "third6"
  | "overall18";

export interface CrossFoursome66618Config {
  scoreMode: CrossFoursomeScoreMode;
  handicapMode?: "relative" | "full";
  partnerOrder?: CrossFoursomePartnerSlot[];
  handicapModeConfirmed?: boolean;
  partnerDrawRequired?: boolean;
  foursomeA: Record<CrossFoursomeASlot, string>;
  foursomeB: Record<CrossFoursomeBSlot, string>;
}

export interface CrossFoursomePair {
  virtualTeamId: string;
  label: string;
  slotLabels: [CrossFoursomeBSlot, CrossFoursomeASlot];
  playerIds: [string, string];
}

export interface CrossFoursomeGamePairings {
  id: CrossFoursomeGameId;
  label: string;
  holeNumbers: number[];
  pairs: CrossFoursomePair[];
}

export interface CrossFoursomePlayerScoreLike {
  playerId: string;
  holeNumber: number;
  grossScore: number | null;
}

export interface CrossFoursomePairHoleScore {
  virtualTeamId: string;
  label: string;
  playerIds: [string, string];
  grossScores: [number | null, number | null];
  netScores: [number | null, number | null];
  strokesReceived: [number | null, number | null];
  bestBallScore: number | null;
}

export interface CrossFoursomeHoleOutcome {
  holeNumber: number;
  isComplete: boolean;
  isTie: boolean;
  winningVirtualTeamId: string | null;
  pairScores: CrossFoursomePairHoleScore[];
}

export interface CrossFoursomePairSummary extends CrossFoursomePair {
  holesWon: number;
  payout: number;
}

export interface CrossFoursomeGameSummary {
  id: CrossFoursomeGameId;
  label: string;
  holeNumbers: number[];
  gamePot: number;
  completedHoles: number;
  pairs: CrossFoursomePairSummary[];
  winningVirtualTeamIds: string[];
  payoutPerWinningPair: number;
  holeOutcomes: CrossFoursomeHoleOutcome[];
}

