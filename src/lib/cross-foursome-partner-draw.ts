export type CrossFoursomePartnerSlot = "A1" | "A2" | "A3" | "A4";
const SLOTS: CrossFoursomePartnerSlot[] = ["A1", "A2", "A3", "A4"];

export function readCrossFoursomePartnerOrder(value: unknown): CrossFoursomePartnerSlot[] | undefined {
  if (!Array.isArray(value) || value.length !== 4 || new Set(value).size !== 4 ||
      !value.every(slot => SLOTS.includes(slot))) return undefined;
  return [...value];
}

export function drawCrossFoursomePartners(random: () => number = Math.random): CrossFoursomePartnerSlot[] {
  const order = [...SLOTS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
