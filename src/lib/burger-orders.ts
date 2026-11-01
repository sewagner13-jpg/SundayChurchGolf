function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function readBurgerSelections(config: unknown, validPlayerIds: string[]): string[] {
  const stored = asRecord(asRecord(config).burgerOrders).selectedPlayerIds;
  if (!Array.isArray(stored)) return [];
  const valid = new Set(validPlayerIds);
  return [...new Set(stored.filter((id): id is string => typeof id === "string" && valid.has(id)))];
}

export function changeBurgerSelection(
  config: unknown,
  validPlayerIds: string[],
  playerId: string,
  selected: boolean
): Record<string, unknown> {
  if (!validPlayerIds.includes(playerId)) throw new Error("Player is not in this round.");
  if (typeof selected !== "boolean") throw new Error("Burger selection must be true or false.");
  const selections = new Set(readBurgerSelections(config, validPlayerIds));
  if (selected) selections.add(playerId);
  else selections.delete(playerId);
  return {
    ...asRecord(config),
    burgerOrders: {
      ...asRecord(asRecord(config).burgerOrders),
      selectedPlayerIds: [...selections],
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function retryBurgerWrite<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (asRecord(error).code !== "P2034" || attempt >= 2) throw error;
    }
  }
}

export function preserveBurgerOrdersForFormatUpdate(current: unknown, submitted: unknown): Record<string, unknown> {
  const next = { ...asRecord(submitted) };
  delete next.burgerOrders;
  const latest = asRecord(current);
  if (Object.prototype.hasOwnProperty.call(latest, "burgerOrders")) {
    next.burgerOrders = latest.burgerOrders;
  }
  return next;
}
