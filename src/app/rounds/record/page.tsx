"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card, CardContent } from "@/components/card";
import { listPlayers } from "@/actions/players";
import { listCourses } from "@/actions/courses";
import { listFormats } from "@/actions/formats";
import { createQuickRound } from "@/actions/quick-rounds";

interface Player {
  id: string;
  fullName: string;
  nickname: string | null;
}

interface Course {
  id: string;
  name: string;
}

interface Format {
  id: string;
  name: string;
}

interface TeamState {
  localId: string;
  playerIds: string[];
  teamPayout: string; // string for controlled input, convert on submit
}

function makeTeam(): TeamState {
  return { localId: crypto.randomUUID(), playerIds: [], teamPayout: "" };
}

export default function RecordRoundPage() {
  const router = useRouter();

  // Reference data
  const [players, setPlayers] = useState<Player[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [courseId, setCourseId] = useState("");
  const [formatId, setFormatId] = useState("");
  const [buyIn, setBuyIn] = useState("30");
  const [roundName, setRoundName] = useState("");
  const [teams, setTeams] = useState<TeamState[]>([makeTeam(), makeTeam()]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerSearch, setPlayerSearch] = useState<Record<string, string>>({}); // localId → search text

  const load = useCallback(async () => {
    const [p, c, f] = await Promise.all([
      listPlayers(),
      listCourses(),
      listFormats(),
    ]);
    setPlayers(p as Player[]);
    setCourses(c as Course[]);
    setFormats(f as Format[]);
    if (c.length > 0) setCourseId(c[0].id);
    if (f.length > 0) setFormatId(f[0].id);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── helpers ──────────────────────────────────────────────────────────────

  /** All player IDs that are already on any team */
  const usedPlayerIds = new Set(teams.flatMap((t) => t.playerIds));

  function playerName(id: string) {
    const p = players.find((pl) => pl.id === id);
    return p ? p.nickname ?? p.fullName : id;
  }

  function addPlayerToTeam(localId: string, playerId: string) {
    setTeams((prev) =>
      prev.map((t) =>
        t.localId === localId
          ? { ...t, playerIds: [...t.playerIds, playerId] }
          : t
      )
    );
    // Clear search for that team slot
    setPlayerSearch((prev) => ({ ...prev, [localId]: "" }));
  }

  function removePlayerFromTeam(localId: string, playerId: string) {
    setTeams((prev) =>
      prev.map((t) =>
        t.localId === localId
          ? { ...t, playerIds: t.playerIds.filter((id) => id !== playerId) }
          : t
      )
    );
  }

  function setTeamPayout(localId: string, value: string) {
    setTeams((prev) =>
      prev.map((t) => (t.localId === localId ? { ...t, teamPayout: value } : t))
    );
  }

  function addTeam() {
    setTeams((prev) => [...prev, makeTeam()]);
  }

  function removeTeam(localId: string) {
    setTeams((prev) => prev.filter((t) => t.localId !== localId));
  }

  // ── derived validation ────────────────────────────────────────────────────

  const netBalance = teams.reduce((sum, t) => {
    const v = parseFloat(t.teamPayout || "0");
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const balanceOk = Math.abs(netBalance) < 0.01;

  // ── submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError(null);

    if (!courseId) return setError("Please select a course");
    if (!formatId) return setError("Please select a format");
    if (!date) return setError("Please select a date");

    for (let i = 0; i < teams.length; i++) {
      if (teams[i].playerIds.length === 0) {
        return setError(`Team ${i + 1} has no players`);
      }
    }

    setSaving(true);
    try {
      await createQuickRound({
        date,
        courseId,
        formatId,
        buyInPerPlayer: parseFloat(buyIn) || 30,
        name: roundName.trim() || undefined,
        teams: teams.map((t) => ({
          playerIds: t.playerIds,
          teamPayout: parseFloat(t.teamPayout || "0") || 0,
        })),
      });
      router.push("/rounds");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save round");
      setSaving(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5 pb-24">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          ← Back
        </Button>
        <h1 className="text-2xl font-bold mt-1">Record Past Round</h1>
        <p className="text-sm text-gray-500">
          Enter teams and payouts for a round played outside the app. Counts
          toward season stats and partnership history.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Basic info */}
      <Card>
        <CardContent>
          <div className="p-4 space-y-3">
            <h2 className="font-semibold text-gray-800">Round Details</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Buy-in per player ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={buyIn}
                  onChange={(e) => setBuyIn(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Course
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Format
              </label>
              <select
                value={formatId}
                onChange={(e) => setFormatId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Round name{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Week 12, Memorial Day round…"
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teams */}
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-800">Teams &amp; Payouts</h2>
        <p className="text-xs text-gray-500">
          Add each team and the total dollar amount that team won or lost. Use a
          negative number for teams that lost money. Team winnings are split
          evenly among players.
        </p>

        {teams.map((team, idx) => {
          const search = playerSearch[team.localId] ?? "";
          const filteredPlayers = players.filter(
            (p) =>
              !usedPlayerIds.has(p.id) &&
              (p.nickname ?? p.fullName)
                .toLowerCase()
                .includes(search.toLowerCase())
          );

          const payoutNum = parseFloat(team.teamPayout || "0");
          const perPlayer =
            team.playerIds.length > 0 && !isNaN(payoutNum)
              ? payoutNum / team.playerIds.length
              : null;

          return (
            <Card key={team.localId}>
              <CardContent>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-800">
                      Team {idx + 1}
                    </h3>
                    {teams.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeTeam(team.localId)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove team
                      </button>
                    )}
                  </div>

                  {/* Player list */}
                  <div className="flex flex-wrap gap-2">
                    {team.playerIds.map((pid) => (
                      <span
                        key={pid}
                        className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-800 text-xs px-2 py-1 rounded-full"
                      >
                        {playerName(pid)}
                        <button
                          type="button"
                          onClick={() => removePlayerFromTeam(team.localId, pid)}
                          className="text-green-500 hover:text-red-500 ml-0.5 leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {team.playerIds.length === 0 && (
                      <span className="text-xs text-gray-400 italic">
                        No players added yet
                      </span>
                    )}
                  </div>

                  {/* Player search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search &amp; add player…"
                      value={search}
                      onChange={(e) =>
                        setPlayerSearch((prev) => ({
                          ...prev,
                          [team.localId]: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {search && filteredPlayers.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredPlayers.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addPlayerToTeam(team.localId, p.id)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 text-gray-700"
                          >
                            {p.nickname ?? p.fullName}
                            {p.nickname && (
                              <span className="text-gray-400 text-xs ml-1">
                                ({p.fullName})
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {search && filteredPlayers.length === 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                        <p className="px-3 py-2 text-sm text-gray-400">
                          No available players match
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Payout */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Team payout ($)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-400 text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={team.teamPayout}
                          onChange={(e) =>
                            setTeamPayout(team.localId, e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    {perPlayer !== null && (
                      <div className="text-right pt-4">
                        <p className="text-xs text-gray-500">per player</p>
                        <p
                          className={`text-sm font-semibold ${perPlayer >= 0 ? "text-green-700" : "text-red-600"}`}
                        >
                          {perPlayer >= 0 ? "+" : ""}${perPlayer.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Button variant="ghost" onClick={addTeam} className="w-full border border-dashed border-gray-300 text-gray-500">
          + Add Team
        </Button>
      </div>

      {/* Net balance indicator */}
      <div
        className={`rounded-md p-3 text-sm font-medium ${
          balanceOk
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-amber-50 border border-amber-200 text-amber-700"
        }`}
      >
        {balanceOk ? (
          "✓ Payouts balance — net is $0.00"
        ) : (
          <>
            Net balance:{" "}
            <span className="font-bold">
              {netBalance >= 0 ? "+" : ""}${netBalance.toFixed(2)}
            </span>
            {" — "}
            {Math.abs(netBalance) < 1
              ? "small rounding difference, OK to save"
              : "double-check amounts if unexpected"}
          </>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1"
        >
          {saving ? "Saving…" : "Save Round"}
        </Button>
      </div>
    </div>
  );
}
