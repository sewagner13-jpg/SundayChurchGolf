import { Decimal } from "@prisma/client/runtime/library";
import {
  getActivePar3Contests,
  type Par3ContestConfig,
} from "@/lib/par3-contests";

export function getPar3ContestTotalPotDecimal(
  config: Par3ContestConfig | null | undefined,
  playerCount: number
): Decimal {
  if (!config?.enabled || config.amountPerPlayer <= 0) {
    return new Decimal(0);
  }

  return new Decimal(config.amountPerPlayer).mul(playerCount);
}

export function getPar3ContestPrizePerHoleDecimal(
  config: Par3ContestConfig | null | undefined,
  playerCount: number
): Decimal {
  const activeContests = getActivePar3Contests(config);
  if (activeContests.length === 0) {
    return new Decimal(0);
  }

  return getPar3ContestTotalPotDecimal(config, playerCount).div(
    activeContests.length
  );
}
