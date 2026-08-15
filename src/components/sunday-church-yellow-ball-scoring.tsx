"use client";

import { useEffect, useMemo, useState } from "react";

import {
  saveSundayChurchYellowBallHole,
  saveSundayChurchYellowBallOrder,
} from "@/actions/sunday-church-yellow-ball";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import {
  ControlledActionFeedback,
  useControlledAction,
} from "@/components/controlled-action";
import { getRelativePlayingHandicaps } from "@/lib/handicap-scoring";
import {
  computeSundayChurchYellowBallHoleScore,
  getSundayChurchYellowBallCarrier,
  getSundayChurchYellowBallTeamConfig,
  validateSundayChurchYellowBallOrder,
  type SundayChurchYellowBallHoleData,
} from "@/lib/sunday-church-yellow-ball-skins";

interface YellowBallPlayer {
  playerId: string;
  name: string;
}

export function SundayChurchYellowBallScoring({
  roundId,
  teamId,
  teamLabel,
  currentHole,
  handicapRank,
  players,
  teamFormatConfig,
  playerHandicapIndexes,
  useYellowBallHandicaps,
  existingHoleData,
  hole17CarrierId,
  blocked,
  onSaved,
}: {
  roundId: string;
  teamId: string;
  teamLabel: string;
  currentHole: number;
  handicapRank: number;
  players: YellowBallPlayer[];
  teamFormatConfig: unknown;
  playerHandicapIndexes: Record<string, number | null | undefined>;
  useYellowBallHandicaps: boolean;
  existingHoleData: SundayChurchYellowBallHoleData | null;
  hole17CarrierId: string | null;
  blocked: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const storedOrder = getSundayChurchYellowBallTeamConfig(teamFormatConfig).yellowBallOrder;
  const [order, setOrder] = useState<string[]>(
    validateSundayChurchYellowBallOrder(storedOrder, players.map((player) => player.playerId))
      .length === 0
      ? storedOrder
      : players.map((player) => player.playerId)
  );
  const [orderLocked, setOrderLocked] = useState(
    validateSundayChurchYellowBallOrder(storedOrder, players.map((player) => player.playerId))
      .length === 0
  );
  const [yellowGross, setYellowGross] = useState("");
  const [scrambleGross, setScrambleGross] = useState("");
  const [manualCarrierId, setManualCarrierId] = useState<string | undefined>();
  const [savedHole17CarrierId, setSavedHole17CarrierId] = useState<string | null>(
    hole17CarrierId
  );
  const orderAction = useControlledAction();
  const scoreAction = useControlledAction();
  const resetScoreAction = scoreAction.reset;

  useEffect(() => {
    setYellowGross(
      existingHoleData ? String(existingHoleData.yellowBallGrossScore) : ""
    );
    setScrambleGross(
      existingHoleData ? String(existingHoleData.scrambleGrossScore) : ""
    );
    setManualCarrierId(existingHoleData?.designatedPlayerId);
    resetScoreAction();
  }, [currentHole, existingHoleData, resetScoreAction]);

  useEffect(() => setSavedHole17CarrierId(hole17CarrierId), [hole17CarrierId]);

  const carrierId = useMemo(() => {
    if (!orderLocked) return null;
    try {
      return getSundayChurchYellowBallCarrier({
        holeNumber: currentHole,
        yellowBallOrder: order,
        designatedPlayerId: manualCarrierId,
        previousDesignatedPlayerId: savedHole17CarrierId,
      });
    } catch {
      return null;
    }
  }, [currentHole, manualCarrierId, order, orderLocked, savedHole17CarrierId]);
  const carrier = players.find((player) => player.playerId === carrierId) ?? null;
  const preview = useMemo(() => {
    const parsedYellow = Number(yellowGross);
    const parsedScramble = Number(scrambleGross);
    if (!carrierId || !yellowGross || !scrambleGross) return null;
    try {
      const relative = getRelativePlayingHandicaps(playerHandicapIndexes);
      return computeSundayChurchYellowBallHoleScore({
        yellowBallGrossScore: parsedYellow,
        scrambleGrossScore: parsedScramble,
        relativePlayingHandicap: relative[carrierId],
        handicapRank,
        useYellowBallHandicaps,
      });
    } catch {
      return null;
    }
  }, [carrierId, handicapRank, playerHandicapIndexes, scrambleGross, useYellowBallHandicaps, yellowGross]);

  const movePlayer = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    setOrder((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const lockOrder = async () => {
    const result = await orderAction.execute(() =>
      saveSundayChurchYellowBallOrder(roundId, teamId, order)
    );
    if (result) setOrderLocked(true);
  };

  const saveScore = async () => {
    const result = await scoreAction.execute(() =>
      saveSundayChurchYellowBallHole(roundId, teamId, currentHole, {
        yellowBallGrossScore: Number(yellowGross),
        scrambleGrossScore: Number(scrambleGross),
        ...(currentHole >= 17 ? { designatedPlayerId: manualCarrierId } : {}),
      })
    );
    if (result) {
      if (currentHole === 17 && manualCarrierId) {
        setSavedHole17CarrierId(manualCarrierId);
      }
      await onSaved();
    }
  };

  if (!orderLocked) {
    return (
      <Card className="border-2 border-yellow-400 p-4">
        <h2 className="text-lg font-bold text-gray-900">Set Yellow Ball Order</h2>
        <p className="mt-1 text-sm text-gray-600">
          This four-player order repeats on holes 1-16 and locks after your first score.
        </p>
        <div className="mt-4 space-y-2">
          {order.map((playerId, index) => {
            const player = players.find((candidate) => candidate.playerId === playerId);
            return (
              <div key={playerId} className="flex items-center gap-3 border-b border-gray-200 py-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-gray-900">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{player?.name ?? playerId}</p>
                  <p className="text-xs text-gray-500">
                    Holes {index + 1}, {index + 5}, {index + 9}, {index + 13}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Move ${player?.name ?? "player"} up`}
                  title="Move up"
                  disabled={index === 0 || orderAction.pending}
                  onClick={() => movePlayer(index, -1)}
                  className="h-9 w-9 border border-gray-300 bg-white text-lg disabled:opacity-30"
                >
                  &#9650;
                </button>
                <button
                  type="button"
                  aria-label={`Move ${player?.name ?? "player"} down`}
                  title="Move down"
                  disabled={index === order.length - 1 || orderAction.pending}
                  onClick={() => movePlayer(index, 1)}
                  className="h-9 w-9 border border-gray-300 bg-white text-lg disabled:opacity-30"
                >
                  &#9660;
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button onClick={lockOrder} disabled={orderAction.pending || blocked}>
            {orderAction.pending ? "Locking..." : "Lock Yellow Ball Order"}
          </Button>
          <ControlledActionFeedback state={orderAction.state} />
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-2 border-yellow-400">
      <div className="bg-gray-900 px-4 py-3 text-white">
        <p className="text-xs font-semibold uppercase text-yellow-300">{teamLabel}</p>
        <h2 className="text-lg font-bold">Enter gross scores</h2>
      </div>
      <div className="space-y-4 p-4">
        {currentHole >= 17 ? (
          <fieldset>
            <legend className="text-sm font-semibold">Yellow-ball player for Hole {currentHole}</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {players.map((player) => {
                const disabled =
                  currentHole === 18 && player.playerId === savedHole17CarrierId;
                return (
                  <button
                    key={player.playerId}
                    type="button"
                    disabled={disabled || blocked}
                    onClick={() => setManualCarrierId(player.playerId)}
                    className={`min-h-11 border px-3 py-2 text-sm font-medium disabled:bg-gray-100 disabled:text-gray-400 ${
                      manualCarrierId === player.playerId
                        ? "border-yellow-500 bg-yellow-300 text-gray-900"
                        : "border-gray-300 bg-white text-gray-800"
                    }`}
                  >
                    {player.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <div className="border-l-4 border-yellow-400 bg-yellow-50 px-3 py-2 text-sm text-gray-900">
            Yellow ball: <strong>{carrier?.name ?? "Order required"}</strong>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-gray-800">
            Yellow-ball gross
            <input
              aria-label="Yellow-ball gross score"
              inputMode="numeric"
              pattern="[0-9]*"
              value={yellowGross}
              onChange={(event) => setYellowGross(event.target.value.replace(/\D/g, ""))}
              disabled={blocked}
              className="mt-1 h-12 w-full border border-gray-300 px-3 text-center text-xl"
            />
          </label>
          <label className="text-sm font-medium text-gray-800">
            Scramble gross
            <input
              aria-label="Scramble gross score"
              inputMode="numeric"
              pattern="[0-9]*"
              value={scrambleGross}
              onChange={(event) => setScrambleGross(event.target.value.replace(/\D/g, ""))}
              disabled={blocked}
              className="mt-1 h-12 w-full border border-gray-300 px-3 text-center text-xl"
            />
          </label>
        </div>

        <div className="grid grid-cols-3 border border-gray-200 bg-gray-50 text-center text-sm">
          <div className="p-2"><span className="block text-xs text-gray-500">Shots</span><strong>{preview?.strokesReceived ?? "-"}</strong></div>
          <div className="border-x border-gray-200 p-2"><span className="block text-xs text-gray-500">Yellow net</span><strong>{preview?.yellowBallNetScore ?? "-"}</strong></div>
          <div className="p-2"><span className="block text-xs text-gray-500">Team total</span><strong>{preview ? `${preview.combinedScore}${preview.handicapApplied ? "•" : ""}` : "-"}</strong></div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            onClick={saveScore}
            disabled={!preview || scoreAction.pending || blocked}
            className="min-h-12"
          >
            {scoreAction.pending ? "Saving..." : "Save Gross Scores"}
          </Button>
          <ControlledActionFeedback state={scoreAction.state} />
        </div>
      </div>
    </Card>
  );
}
