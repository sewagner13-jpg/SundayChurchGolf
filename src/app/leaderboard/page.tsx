"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Select } from "@/components/select";
import { getLeaderboard, getAvailableYears } from "@/actions/season-stats";
import { Decimal } from "@prisma/client/runtime/library";

interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  handicapIndex: Decimal | null;
  totalWinnings: Decimal;
  roundsPlayed: number;
  topTeamAppearances: number;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [selectedYear]);

  async function loadYears() {
    try {
      const availableYears = await getAvailableYears();
      setYears(availableYears);
    } catch (err) {
      console.error("Failed to load years", err);
    }
  }

  async function loadLeaderboard() {
    setLoading(true);
    try {
      const data = await getLeaderboard(selectedYear);
      setLeaderboard(data);
    } catch (err) {
      console.error("Failed to load leaderboard", err);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Season Leaderboard</h1>
        <Select
          value={String(selectedYear)}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
          className="w-24"
        />
      </div>

      <Card>
        <CardHeader>{selectedYear} Season Standings</CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-4">Loading...</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-center py-4 text-gray-500">
              No results for {selectedYear}
            </p>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="flex items-center text-xs text-gray-500 font-medium py-2 border-b">
                <div className="w-8 text-center">#</div>
                <div className="flex-1">Player</div>
                <div className="w-20 text-right">Winnings</div>
                <div className="w-12 text-center">Rds</div>
                <div className="w-12 text-center">Top</div>
              </div>

              {/* Entries */}
              {leaderboard.map((entry, index) => (
                <Link
                  key={entry.playerId}
                  href={`/leaderboard/${entry.playerId}?year=${selectedYear}`}
                  className="flex items-center py-3 border-b last:border-b-0 hover:bg-gray-50 -mx-4 px-4"
                >
                  <div className="w-8 text-center font-bold text-gray-400">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{entry.playerName}</p>
                    {entry.handicapIndex && (
                      <p className="text-xs text-gray-500">
                        {entry.handicapIndex.toString()} HCP
                      </p>
                    )}
                  </div>
                  <div className="w-20 text-right font-bold text-green-600">
                    ${Math.round(entry.totalWinnings.toNumber())}
                  </div>
                  <div className="w-12 text-center text-sm text-gray-600">
                    {entry.roundsPlayed}
                  </div>
                  <div className="w-12 text-center text-sm text-gray-600">
                    {entry.topTeamAppearances}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-gray-500 text-center">
        <p>Rds = Rounds Played | Top = Top Team Finishes</p>
      </div>
    </div>
  );
}
