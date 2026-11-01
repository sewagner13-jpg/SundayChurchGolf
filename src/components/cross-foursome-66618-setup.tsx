"use client";

import { drawCrossFoursomePartners } from "@/lib/cross-foursome-partner-draw";

import {
  CROSS_FOURSOME_66618_CONFIG_KEY,
  createDefaultCrossFoursome66618Config,
  getCrossFoursome66618Config,
  getCrossFoursome66618Pairings,
  validateCrossFoursome66618Config,
  type CrossFoursomeASlot,
  type CrossFoursomeBSlot,
} from "@/lib/cross-foursome-66618";

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

const A_SLOTS = ["A1", "A2", "A3", "A4"] as const;
const B_SLOTS = ["B1", "B2", "B3", "B4"] as const;

function getPlayerName(players: PlayerOption[], playerId: string) {
  return players.find((player) => player.playerId === playerId)?.name ?? playerId;
}

function getMergedConfig(formatConfig: Record<string, unknown>) {
  return {
    ...createDefaultCrossFoursome66618Config(),
    ...formatConfig,
    crossFoursome66618: {
      ...createDefaultCrossFoursome66618Config().crossFoursome66618,
      ...(formatConfig[CROSS_FOURSOME_66618_CONFIG_KEY] as Record<string, unknown> | undefined),
    },
  };
}

export function CrossFoursome66618Setup({
  players,
  formatConfig,
  onChange,
  disabled = false,
}: Props) {
  const normalizedConfig = getMergedConfig(formatConfig);
  const config = getCrossFoursome66618Config(normalizedConfig);
  const selectedSlotPlayerIds = new Set([
    ...Object.values(config.foursomeA),
    ...Object.values(config.foursomeB),
  ].filter(Boolean));
  const errors = validateCrossFoursome66618Config(
    normalizedConfig,
    players.map((player) => player.playerId)
  );
  const pairings = getCrossFoursome66618Pairings(normalizedConfig);

  const updateSlot = (
    group: "foursomeA" | "foursomeB",
    slot: CrossFoursomeASlot | CrossFoursomeBSlot,
    playerId: string
  ) => {
    const nextConfig = {...config, [group]: {...config[group], [slot]: playerId}};
    const ids = [...Object.values(nextConfig.foursomeA), ...Object.values(nextConfig.foursomeB)];
    nextConfig.partnerOrder = ids.every(Boolean) && new Set(ids).size === 8
      ? drawCrossFoursomePartners() : undefined;
    onChange({...formatConfig, [CROSS_FOURSOME_66618_CONFIG_KEY]: nextConfig});
  };

  const renderSlot = (
    group: "foursomeA" | "foursomeB",
    slot: CrossFoursomeASlot | CrossFoursomeBSlot
  ) => {
    const currentPlayerId =
      group === "foursomeA"
        ? config.foursomeA[slot as CrossFoursomeASlot]
        : config.foursomeB[slot as CrossFoursomeBSlot];
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
              selectedSlotPlayerIds.has(player.playerId) &&
              player.playerId !== currentPlayerId;
            return (
              <option
                key={player.playerId}
                value={player.playerId}
                disabled={usedElsewhere}
              >
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
          Cross-Foursome 6-6-6-18
        </p>
        <p className="mt-1 text-sm text-emerald-950">
          Assign four players to Red Cart (A) and four to Blue Cart (B).
          You can prepare the draft now and assign carts after your draw. Partners are randomly drawn when all eight slots are filled; save assignments to keep the draw.
        </p>
      </div>

      <label className="block text-sm font-semibold text-gray-800">
        Scoring
        <select
          value={config.scoreMode}
          disabled={disabled}
          onChange={(event) => onChange({
            ...formatConfig,
            [CROSS_FOURSOME_66618_CONFIG_KEY]: {
              ...config,
              scoreMode: event.target.value === "best_net_ball" ? "best_net_ball" : "best_ball",
            },
          })}
          className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="best_ball">Gross best ball (no handicaps)</option>
          <option value="best_net_ball">Net best ball (with handicaps)</option>
        </select>
      </label>
      {config.scoreMode === "best_net_ball" && (
        <label className="block text-sm font-semibold text-gray-800">
          Handicap method
          <select value={config.handicapModeConfirmed === false ? "" : (config.handicapMode ?? "relative")} disabled={disabled}
            onChange={(event) => onChange({
              ...formatConfig,
              [CROSS_FOURSOME_66618_CONFIG_KEY]: {
                ...config, handicapMode: event.target.value === "full" ? "full" : "relative", handicapModeConfirmed: true,
              },
            })}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm">
            <option value="" disabled>Choose handicap method</option>
            <option value="relative">Lowest player plays off zero</option>
            <option value="full">Full player handicaps</option>
          </select>
        </label>
      )}
      <p className="text-sm text-emerald-950">
        Each pair counts one best {config.scoreMode === "best_net_ball" ? "net" : "gross"} score per hole.
        Two tie, all tie: tied lowest scores award no hole win, with no carryovers.
      </p>
      <p className="text-sm text-emerald-950">
        Lowest-player-zero uses 100% of the difference between rounded player handicaps;
        the lowest of all eight players plays from zero. Full handicaps uses each
        player’s entire rounded handicap without subtracting the lowest.
        Shots follow the course hole handicap ranks; plus handicaps give shots back
        starting at the easiest holes. No slope, tee, or percentage adjustment.
        Player handicaps are locked when the round starts.
      </p>
      {config.scoreMode === "best_net_ball" && players.some(
        (player) => player.handicapIndex == null || player.handicapIndex === "" ||
          !Number.isFinite(Number(player.handicapIndex))
      ) && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Every player needs a handicap before starting net best ball. Update missing handicaps in Players.
        </p>
      )}

      {players.length !== 8 && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Select exactly 8 players before assigning foursomes.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 font-semibold text-gray-800">Red Cart — Foursome A</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {A_SLOTS.map((slot) => renderSlot("foursomeA", slot))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-semibold text-gray-800">Blue Cart — Foursome B</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {B_SLOTS.map((slot) => renderSlot("foursomeB", slot))}
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {errors[0]}
        </div>
      )}

      <div className="space-y-3">
        <button type="button" disabled={disabled || errors.length > 0}
          onClick={() => onChange({...formatConfig, [CROSS_FOURSOME_66618_CONFIG_KEY]: {
            ...config, partnerOrder: drawCrossFoursomePartners(),
          }})}
          className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Draw random partners
        </button>
        <p className="text-sm text-emerald-950">Each player partners with every opposite-cart player once across the four games. Overall 18 runs alongside the three six-hole games. Save assignments before starting; partners stay fixed once started.</p>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Generated Scoring Pairings
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {pairings.map((game) => (
            <div
              key={game.id}
              className="rounded border border-emerald-100 bg-white/90 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-semibold text-gray-800">{game.label}</p>
                <p className="text-xs text-gray-500">
                  Holes {game.holeNumbers[0]}-
                  {game.holeNumbers[game.holeNumbers.length - 1]}
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
                        .map((playerId) =>
                          playerId ? getPlayerName(players, playerId) : "Unassigned"
                        )
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
