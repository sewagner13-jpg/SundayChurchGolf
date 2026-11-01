/** Allocate whole cents without losing money when tied pair shares recur. */
export function conservePayoutCents(payouts: Map<string, number>) {
  const shares = [...payouts].map(([id, amount]) => {
    const exact = amount * 100;
    return {id, exact, cents: Math.floor(exact)};
  });
  const target = Math.round(shares.reduce((sum, share) => sum + share.exact, 0));
  let remaining = target - shares.reduce((sum, share) => sum + share.cents, 0);
  // Stable player IDs settle equal remainders so repeated calculations agree.
  const ranked = [...shares].sort((a, b) =>
    (b.exact - b.cents) - (a.exact - a.cents) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  for (const share of ranked) {
    if (remaining <= 0) break;
    share.cents++;
    remaining--;
  }
  return new Map(shares.map(share => [share.id, share.cents / 100]));
}
