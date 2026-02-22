"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Button } from "@/components/button";
import { Select } from "@/components/select";
import {
  getLeaderboard,
  getTeamCombinationStats,
  getPairCombinationStats,
  getAvailableYears,
} from "@/actions/season-stats";

interface PlayerStat {
  playerId: string;
  playerName: string;
  handicapIndex: number | null;
  totalWinnings: number;
  totalBuyInsPaid: number;
  netWinnings: number;
  roundsPlayed: number;
  topTeamAppearances: number;
}

interface TeamCombination {
  playerIds: string[];
  playerNames: string[];
  totalWinnings: number;
  roundsPlayed: number;
  wins: number;
}

interface PairCombination {
  playerIds: [string, string];
  playerNames: [string, string];
  totalWinnings: number;
  roundsPlayed: number;
  wins: number;
}

type TabType = "players" | "teams" | "pairs";

export default function StatsPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("players");
  const [loading, setLoading] = useState(true);

  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [teamCombos, setTeamCombos] = useState<TeamCombination[]>([]);
  const [pairCombos, setPairCombos] = useState<PairCombination[]>([]);

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    loadStats();
  }, [year]);

  async function loadYears() {
    const years = await getAvailableYears();
    setAvailableYears(years);
  }

  async function loadStats() {
    setLoading(true);
    try {
      const [players, teams, pairs] = await Promise.all([
        getLeaderboard(year),
        getTeamCombinationStats(year),
        getPairCombinationStats(year),
      ]);
      setPlayerStats(players);
      setTeamCombos(teams);
      setPairCombos(pairs);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
    setLoading(false);
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: "players", label: "Players" },
    { key: "teams", label: "Team Combos" },
    { key: "pairs", label: "Pairs" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Season Stats</h1>
        <Link href="/">
          <Button variant="secondary" size="sm">
            Home
          </Button>
        </Link>
      </div>

      {/* Year Selector */}
      <Select
        label=""
        value={String(year)}
        onChange={(e) => setYear(Number(e.target.value))}
        options={availableYears.map((y) => ({
          value: String(y),
          label: String(y),
        }))}
      />

      {/* Tab Navigation */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`flex-1 py-2 text-center font-medium text-sm ${
              activeTab === tab.key
                ? "border-b-2 border-green-600 text-green-600"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center py-8 text-gray-500">Loading stats...</p>
      ) : (
        <>
          {/* Player Stats Tab */}
          {activeTab === "players" && (
            <Card>
              <CardHeader>Individual Player Winnings</CardHeader>
              <CardContent>
                {playerStats.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No stats for {year}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {playerStats.map((player, idx) => (
                      <div
                        key={player.playerId}
                        className={`flex justify-between items-center py-2 px-3 rounded ${
                          idx === 0
                            ? "bg-yellow-50 border border-yellow-300"
                            : idx < 3
                            ? "bg-green-50"
                            : "bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-sm w-5">
                            {idx + 1}.
                          </span>
                          <div>
                            <span className="font-medium">
                              {player.playerName}
                            </span>
                            <p className="text-xs text-gray-500">
                              {player.roundsPlayed} rounds &bull;{" "}
                              {player.topTeamAppearances} wins
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-bold ${
                              player.netWinnings >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {player.netWinnings >= 0 ? "+" : ""}$
                            {Math.round(player.netWinnings)}
                          </p>
                          <p className="text-xs text-gray-500">
                            ${Math.round(player.totalWinnings)} won
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Team Combinations Tab */}
          {activeTab === "teams" && (
            <Card>
              <CardHeader>Team Combination Winnings</CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 mb-3">
                  How much each exact team lineup has won together
                </p>
                {teamCombos.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No team data for {year}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {teamCombos.slice(0, 20).map((combo, idx) => (
                      <div
                        key={combo.playerIds.join("|")}
                        className={`p-3 rounded border ${
                          idx === 0
                            ? "border-yellow-400 bg-yellow-50"
                            : idx < 3
                            ? "border-green-300 bg-green-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">
                              {combo.playerNames.join(" & ")}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {combo.roundsPlayed} round
                              {combo.roundsPlayed !== 1 ? "s" : ""} together
                              {combo.wins > 0 && (
                                <span className="text-green-600 ml-1">
                                  &bull; {combo.wins} win
                                  {combo.wins !== 1 ? "s" : ""}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600 text-lg">
                              ${Math.round(combo.totalWinnings)}
                            </p>
                            <p className="text-xs text-gray-500">
                              $
                              {Math.round(
                                combo.totalWinnings / combo.roundsPlayed
                              )}{" "}
                              avg
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {teamCombos.length > 20 && (
                      <p className="text-xs text-gray-400 text-center">
                        Showing top 20 of {teamCombos.length} combinations
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pair Combinations Tab */}
          {activeTab === "pairs" && (
            <Card>
              <CardHeader>Pair Winnings</CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 mb-3">
                  Total winnings when these two players are on the same team
                  (any team size)
                </p>
                {pairCombos.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No pair data for {year}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pairCombos.slice(0, 30).map((pair, idx) => (
                      <div
                        key={pair.playerIds.join("|")}
                        className={`flex justify-between items-center py-2 px-3 rounded ${
                          idx === 0
                            ? "bg-yellow-50 border border-yellow-300"
                            : idx < 3
                            ? "bg-green-50"
                            : "bg-gray-50"
                        }`}
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {pair.playerNames[0]} & {pair.playerNames[1]}
                          </p>
                          <p className="text-xs text-gray-500">
                            {pair.roundsPlayed} round
                            {pair.roundsPlayed !== 1 ? "s" : ""} together
                            {pair.wins > 0 && (
                              <span className="text-green-600 ml-1">
                                &bull; {pair.wins} win
                                {pair.wins !== 1 ? "s" : ""}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            ${Math.round(pair.totalWinnings)}
                          </p>
                          <p className="text-xs text-gray-500">
                            $
                            {Math.round(pair.totalWinnings / pair.roundsPlayed)}{" "}
                            avg
                          </p>
                        </div>
                      </div>
                    ))}
                    {pairCombos.length > 30 && (
                      <p className="text-xs text-gray-400 text-center">
                        Showing top 30 of {pairCombos.length} pairs
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
