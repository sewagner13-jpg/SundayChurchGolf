"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Input } from "@/components/input";
import { listPlayers } from "@/actions/players";
import { createManualSettlement } from "@/actions/settlements";

interface Player {
  id: string;
  fullName: string;
  nickname: string | null;
}

interface EntryRow {
  playerId: string;
  amount: string; // raw text input, can be negative
}

export default function NewSettlementPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");

  useEffect(() => {
    listPlayers().then((data) => {
      setPlayers(data as Player[]);
      setLoading(false);
    });
  }, []);

  const addedPlayerIds = new Set(entries.map((e) => e.playerId));

  const filteredPlayers = players.filter(
    (p) =>
      !addedPlayerIds.has(p.id) &&
      (playerSearch === "" ||
        p.fullName.toLowerCase().includes(playerSearch.toLowerCase()) ||
        (p.nickname?.toLowerCase() ?? "").includes(playerSearch.toLowerCase()))
  );

  const addPlayer = (player: Player) => {
    setEntries((prev) => [...prev, { playerId: player.id, amount: "" }]);
    setPlayerSearch("");
  };

  const removeEntry = (playerId: string) => {
    setEntries((prev) => prev.filter((e) => e.playerId !== playerId));
  };

  const updateAmount = (playerId: string, value: string) => {
    // allow "-", digits, ".", leading minus
    const cleaned = value.replace(/[^0-9.\-]/g, "").replace(/(?!^)-/g, "");
    setEntries((prev) =>
      prev.map((e) => (e.playerId === playerId ? { ...e, amount: cleaned } : e))
    );
  };

  const getPlayerName = (id: string) => {
    const p = players.find((pl) => pl.id === id);
    return p ? (p.nickname ?? p.fullName) : id;
  };

  const handleSubmit = async () => {
    setError(null);
    if (!date) { setError("Date is required"); return; }
    if (entries.length === 0) { setError("Add at least one player"); return; }

    const parsed = entries.map((e) => {
      const n = parseFloat(e.amount);
      return { playerId: e.playerId, amount: isNaN(n) ? 0 : n };
    });

    const nonZero = parsed.filter((e) => e.amount !== 0);
    if (nonZero.length === 0) {
      setError("Enter an amount (positive or negative) for at least one player");
      return;
    }

    setSaving(true);
    try {
      await createManualSettlement(date, description.trim() || null, parsed);
      router.push("/settlements");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  };

  if (loading) return <p className="p-4 text-gray-500">Loading players…</p>;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/settlements")}>
          ← Back
        </Button>
        <h1 className="text-2xl font-bold">New Manual Settlement</h1>
      </div>

      <p className="text-sm text-gray-500">
        Use this when scoring broke down and you know who won. Enter positive
        amounts for winnings and negative amounts for money owed. These flow
        into the season leaderboard.
      </p>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>Details</CardHeader>
        <CardContent>
          <div className="space-y-4 p-4">
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Input
              label="Description (optional)"
              type="text"
              placeholder="e.g. Week 12 — manual entry"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Players & Amounts</CardHeader>
        <CardContent>
          <div className="p-4 space-y-4">
            {/* Added players */}
            {entries.length > 0 && (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div key={entry.playerId} className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-medium text-gray-700">
                      {getPlayerName(entry.playerId)}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-sm">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={entry.amount}
                        onChange={(e) => updateAmount(entry.playerId, e.target.value)}
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.playerId)}
                      className="text-gray-400 hover:text-red-500 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Player search */}
            <div>
              <input
                type="text"
                placeholder="Search players to add…"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {playerSearch && (
                <div className="mt-1 rounded-lg border border-gray-200 bg-white shadow-sm max-h-48 overflow-y-auto">
                  {filteredPlayers.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-400">No players found</p>
                  ) : (
                    filteredPlayers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addPlayer(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        {p.nickname ?? p.fullName}
                        {p.nickname && (
                          <span className="ml-1 text-gray-400">({p.fullName})</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400">
              Positive = won money · Negative = owed money · Zero = no change
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {entries.length > 0 && (
        <Card>
          <CardHeader>Summary</CardHeader>
          <CardContent>
            <div className="p-4 space-y-1">
              {entries.map((e) => {
                const n = parseFloat(e.amount) || 0;
                return (
                  <div key={e.playerId} className="flex justify-between text-sm">
                    <span>{getPlayerName(e.playerId)}</span>
                    <span className={n >= 0 ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                      {n >= 0 ? "+" : ""}${Math.abs(n).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={handleSubmit}
        disabled={saving || entries.length === 0}
        className="w-full"
        size="lg"
      >
        {saving ? "Saving…" : "Save Settlement"}
      </Button>
    </div>
  );
}
