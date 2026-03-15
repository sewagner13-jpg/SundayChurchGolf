import { Decimal } from "@prisma/client/runtime/library";
import {
  getActivePar3Contests,
  getPar3ContestParticipantIds,
  type Par3ContestConfig,
} from "@/lib/par3-contests";

export function getPar3ContestTotalPotDecimal(
  config: Par3ContestConfig | null | undefined,
  eligiblePlayerIds: string[]
): Decimal {
  const participantCount = getPar3ContestParticipantIds(
    config,
    eligiblePlayerIds
  ).length;
  if (!config?.enabled || config.amountPerPlayer <= 0) {
    return new Decimal(0);
  }

  return new Decimal(config.amountPerPlayer).mul(participantCount);
}

export function getPar3ContestPrizePerHoleDecimal(
  config: Par3ContestConfig | null | undefined,
  eligiblePlayerIds: string[]
): Decimal {
  const activeContests = getActivePar3Contests(config);
  if (activeContests.length === 0) {
    return new Decimal(0);
  }

  return getPar3ContestTotalPotDecimal(config, eligiblePlayerIds).div(
    activeContests.length
  );
}
