"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { GHINLinkButton } from "@/components/ghin-link-button";
import { HandicapStatusBadge } from "@/components/handicap-status-badge";
import { HandicapRefreshModal } from "@/components/handicap-refresh-modal";
import {
  getSundaySetupPlayers,
  lockRoundEventHandicaps,
  saveSundaySetupSelection,
} from "@/actions/handicaps";
import { isHandicapStale } from "@/lib/ghin";

interface SundaySetupPlayer {
  id: string;
  fullName: string;
  nickname: string | null;
  ghinNumber: string | null;
  ghinProfileUrl: string | null;
  handicapIndex: number | null;
  handicapLastUpdatedAt: Date | string | null;
  lastVerifiedDate: Date | string | null;
  handicapSource: string | null;
  isActive: boolean;
}

interface RoundSnapshot {
  playerId: string;
  eventHandicapIndex: number | null;
  eventHandicapLockedAt: Date | string | null;
}

export default function SundaySetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [players, setPlayers] = useState<SundaySetupPlayer[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [snapshots, setSnapshots] = useState<RoundSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSelection, setSavingSelection] = useState(false);
  const [locking, setLocking] = useState(false);
  const [filterStaleOnly, setFilterStaleOnly] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeRefreshPlayerId, setActiveRefreshPlayerId] = useState<string | null>(null);
  const [refreshQueue, setRefreshQueue] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const data = await getSundaySetupPlayers(id);
      if (data.round.status !== "DRAFT") {
        router.push(`/rounds/${id}/setup`);
        return;
      }

      setPlayers(data.players as SundaySetupPlayer[]);
      setSelectedPlayerIds(new Set(data.selectedPlayerIds));
      setSnapshots(data.snapshots as RoundSnapshot[]);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Sunday setup");
      setLoading(false);
    }
  }

  const selectedPlayers = useMemo(
    () => players.filter((player) => selectedPlayerIds.has(player.id)),
    [players, selectedPlayerIds]
  );

  const staleSelectedPlayers = useMemo(
    () =>
      selectedPlayers.filter((player) => isHandicapStale(player.lastVerifiedDate)),
    [selectedPlayers]
  );

  const sortedPlayers = useMemo(() => {
    return players
      .filter((player) => !filterStaleOnly || isHandicapStale(player.lastVerifiedDate))
      .slice()
      .sort((a, b) => {
        const aSelected = selectedPlayerIds.has(a.id) ? 0 : 1;
        const bSelected = selectedPlayerIds.has(b.id) ? 0 : 1;
        const aStale = isHandicapStale(a.lastVerifiedDate) ? 0 : 1;
        const bStale = isHandicapStale(b.lastVerifiedDate) ? 0 : 1;

        if (aStale !== bStale) return aStale - bStale;
        if (aSelected !== bSelected) return aSelected - bSelected;
        return (a.nickname || a.fullName).localeCompare(b.nickname || b.fullName);
      });
  }, [filterStaleOnly, players, selectedPlayerIds]);

  const activeRefreshPlayer =
    players.find((player) => player.id === activeRefreshPlayerId) ?? null;
  const nextRefreshPlayerId = refreshQueue[0] ?? null;
  const nextRefreshPlayerLabel =
    players.find((player) => player.id === nextRefreshPlayerId)?.nickname ||
    players.find((player) => player.id === nextRefreshPlayerId)?.fullName ||
    null;

  if (loading) {
    return <p className="py-8 text-center">Loading Sunday setup...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Sunday Setup</h1>
          <p className="text-sm text-gray-500">
            Verify handicaps, select the roster, then lock event snapshots.
          </p>
        </div>
        <Link href={`/rounds/${id}/setup`}>
          <Button variant="secondary">Back to Round Setup</Button>
        </Link>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded border border-green-300 bg-green-50 px-4 py-3 text-green-700">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>Checklist</CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Players Selected
              </p>
              <p className="text-2xl font-bold">{selectedPlayers.length}</p>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Need Refresh
              </p>
              <p className="text-2xl font-bold text-amber-700">
                {staleSelectedPlayers.length}
              </p>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Snapshots Locked
              </p>
              <p className="text-2xl font-bold">
                {
                  snapshots.filter((snapshot) => snapshot.eventHandicapLockedAt)
                    .length
                }
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={filterStaleOnly}
                onChange={(e) => setFilterStaleOnly(e.target.checked)}
              />
              Show only stale players
            </label>
            <Button
              variant="secondary"
              onClick={() => {
                const queue = staleSelectedPlayers.map((player) => player.id);
                setRefreshQueue(queue.slice(1));
                setActiveRefreshPlayerId(queue[0] ?? null);
              }}
              disabled={staleSelectedPlayers.length === 0}
            >
              Refresh All Stale
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                setSavingSelection(true);
                setError(null);
                setMessage(null);
                try {
                  await saveSundaySetupSelection(
                    id,
                    Array.from(selectedPlayerIds)
                  );
                  setMessage("Sunday player selection saved.");
                  await loadData();
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Failed to save Sunday selection"
                  );
                }
                setSavingSelection(false);
              }}
              disabled={savingSelection}
            >
              {savingSelection ? "Saving..." : "Save Selected Players"}
            </Button>
            <Button
              onClick={async () => {
                setLocking(true);
                setError(null);
                setMessage(null);
                try {
                  await saveSundaySetupSelection(
                    id,
                    Array.from(selectedPlayerIds)
                  );
                  const result = await lockRoundEventHandicaps(id);
                  setMessage(
                    `Locked ${result.count} event handicap snapshot${result.count === 1 ? "" : "s"} just now.`
                  );
                  await loadData();
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Failed to lock event handicaps"
                  );
                }
                setLocking(false);
              }}
              disabled={locking || selectedPlayers.length === 0}
            >
              {locking ? "Locking..." : "Lock Event Handicaps"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Players</CardHeader>
        <CardContent className="space-y-3">
          {sortedPlayers.map((player) => {
            const isSelected = selectedPlayerIds.has(player.id);
            const snapshot = snapshots.find(
              (entry) => entry.playerId === player.id
            );

            return (
              <div
                key={player.id}
                className={`rounded-lg border p-3 ${
                  isSelected
                    ? "border-green-300 bg-green-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {player.nickname || player.fullName}
                      </p>
                      <HandicapStatusBadge lastVerifiedDate={player.lastVerifiedDate} />
                    </div>
                    {player.nickname && (
                      <p className="text-sm text-gray-500">{player.fullName}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                      <span>GHIN: {player.ghinNumber || "—"}</span>
                      <span>Handicap: {player.handicapIndex ?? "—"}</span>
                      <span>
                        Verified:{" "}
                        {player.lastVerifiedDate
                          ? new Date(player.lastVerifiedDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )
                          : "Never"}
                      </span>
                      <span>
                        Event HCP: {snapshot?.eventHandicapIndex ?? "—"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) =>
                          setSelectedPlayerIds((current) => {
                            const next = new Set(current);
                            if (e.target.checked) next.add(player.id);
                            else next.delete(player.id);
                            return next;
                          })
                        }
                      />
                      Included in Sunday game
                    </label>
                    <GHINLinkButton
                      ghinNumber={player.ghinNumber}
                      ghinProfileUrl={player.ghinProfileUrl}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setRefreshQueue([]);
                        setActiveRefreshPlayerId(player.id);
                      }}
                    >
                      Refresh Handicap
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <HandicapRefreshModal
        isOpen={!!activeRefreshPlayer}
        player={activeRefreshPlayer}
        nextLabel={nextRefreshPlayerLabel}
        onClose={() => {
          setActiveRefreshPlayerId(null);
          setRefreshQueue([]);
        }}
        onSaved={(playerId, handicapIndex, verifiedAt) => {
          setPlayers((current) =>
            current.map((player) =>
              player.id === playerId
                ? {
                    ...player,
                    handicapIndex,
                    lastVerifiedDate: verifiedAt,
                    handicapLastUpdatedAt: verifiedAt,
                    handicapSource: "manual_ghin_refresh",
                  }
                : player
            )
          );
          setMessage("Updated just now.");
          setError(null);

          const [nextPlayerId, ...rest] = refreshQueue;
          if (nextPlayerId) {
            setRefreshQueue(rest);
            setActiveRefreshPlayerId(nextPlayerId);
            return;
          }

          setRefreshQueue([]);
          setActiveRefreshPlayerId(null);
        }}
      />
    </div>
  );
}
