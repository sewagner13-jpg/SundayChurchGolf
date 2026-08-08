"use client";

import {
  CROSS_THREESOME_666_CONFIG_KEY,
  createDefaultCrossThreesome666Config,
  getCrossThreesome666Config,
  getCrossThreesome666Pairings,
  validateCrossThreesome666Config,
  type CrossThreesomeASlot,
  type CrossThreesomeBSlot,
} from "@/lib/cross-threesome-666";

interface PlayerOption {
  playerId: string;
  name: string;
  handicapIndex?: number | string | null;
}

interface Props {
  players: PlayerOption[];
  formatConfig: Record<string, unknown>;
  onChange: (nextConfig: Record<string, unknown>) => void;
  disabled?: boolean;
}

const A_SLOTS = ["A1", "A2", "A3"] as const;
const B_SLOTS = ["B1", "B2", "B3"] as const;

function getPlayerName(players: PlayerOption[], playerId: string) {
  return players.find((player) => player.playerId === playerId)?.name ?? playerId;
}

function getMergedConfig(formatConfig: Record<string, unknown>) {
  return {
    ...createDefaultCrossThreesome666Config(),
    ...formatConfig,
    crossThreesome666: {
      ...createDefaultCrossThreesome666Config().crossThreesome666,
      ...(formatConfig[CROSS_THREESOME_666_CONFIG_KEY] as Record<string, unknown> | undefined),
    },
  };
}

export function CrossThreesome666Setup({
  players,
  formatConfig,
  onChange,
  disabled = false,
}: Props) {
  const normalizedConfig = getMergedConfig(formatConfig);
  const config = getCrossThreesome666Config(normalizedConfig);
  const selectedSlotPlayerIds = new Set([
    ...Object.values(config.threesomeA),
    ...Object.values(config.threesomeB),
  ].filter(Boolean));
  const errors = validateCrossThreesome666Config(
    normalizedConfig,
    players.map((player) => player.playerId)
  );
  const pairings = getCrossThreesome666Pairings(normalizedConfig);

  const updateSlot = (
    group: "threesomeA" | "threesomeB",
    slot: CrossThreesomeASlot | CrossThreesomeBSlot,
    playerId: string
  ) => {
    onChange({
      ...formatConfig,
      [CROSS_THREESOME_666_CONFIG_KEY]: {
        ...config,
        [group]: {
          ...config[group],
          [slot]: playerId,
        },
      },
    });
  };

  const renderSlot = (
    group: "threesomeA" | "threesomeB",
    slot: CrossThreesomeASlot | CrossThreesomeBSlot
  ) => {
    const currentPlayerId =
      group === "threesomeA"
        ? config.threesomeA[slot as CrossThreesomeASlot]
        : config.threesomeB[slot as CrossThreesomeBSlot];
    return (
      <label key={slot} className="block rounded border border-gray-200 bg-white p-3">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
          {slot}
        </span>
        <select
          value={currentPlayerId}
          onChange={(event) => updateSlot(group, slot, event.target.value)}
          disabled={disabled}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Select player</option>
          {players.map((player) => {
            const usedElsewhere =
              selectedSlotPlayerIds.has(player.playerId) && player.playerId !== currentPlayerId;
            return (
              <option key={player.playerId} value={player.playerId} disabled={usedElsewhere}>
                {player.name}
                {player.handicapIndex !== null && player.handicapIndex !== undefined
                  ? ` (${player.handicapIndex})`
                  : ""}
              </option>
            );
          })}
        </select>
      </label>
    );
  };

  return (
    <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Cross-Threesome 6-6-6
        </p>
        <p className="mt-1 text-sm text-emerald-950">
          Assign three players to each physical group. Every player’s locked handicap
          determines their net score on each hole.
        </p>
      </div>

      {players.length !== 6 && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Select exactly 6 players before assigning threesomes.
        </div>
      )}
      {players.some((player) => player.handicapIndex === null || player.handicapIndex === undefined) && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Every player needs a handicap before this net game can start.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 font-semibold text-gray-800">Threesome A</p>
          <div className="grid gap-2">{A_SLOTS.map((slot) => renderSlot("threesomeA", slot))}</div>
        </div>
        <div>
          <p className="mb-2 font-semibold text-gray-800">Threesome B</p>
          <div className="grid gap-2">{B_SLOTS.map((slot) => renderSlot("threesomeB", slot))}</div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {errors[0]}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Net Best-Ball Pairings
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {pairings.map((game) => (
            <div key={game.id} className="rounded border border-emerald-100 bg-white/90 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-semibold text-gray-800">{game.label}</p>
                <p className="text-xs text-gray-500">
                  Holes {game.holeNumbers[0]}-{game.holeNumbers[game.holeNumbers.length - 1]}
                </p>
              </div>
              <div className="space-y-1 text-sm">
                {game.pairs.map((pair) => (
                  <div
                    key={pair.virtualTeamId}
                    className="flex items-center justify-between gap-3 rounded bg-gray-50 px-2 py-1"
                  >
                    <span className="font-medium text-gray-600">{pair.label}</span>
                    <span className="text-right text-gray-800">
                      {pair.playerIds
                        .map((playerId) => (playerId ? getPlayerName(players, playerId) : "Unassigned"))
                        .join(" / ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
