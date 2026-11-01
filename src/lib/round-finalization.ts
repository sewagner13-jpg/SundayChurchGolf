import type { Prisma } from "@prisma/client";

/** The row claim and every payout/stat write must share the same transaction. */
export async function claimRoundFinalization(
  tx: Pick<Prisma.TransactionClient, "round">,
  roundId: string
) {
  const claimed = await tx.round.updateMany({
    where: { id: roundId, status: "LIVE" },
    data: { status: "FINISHED" },
  });
  if (claimed.count !== 1) {
    throw new Error("This round was already finished by another scorer. Refresh to see the saved payouts.");
  }
}
