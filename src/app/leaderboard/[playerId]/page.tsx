import { notFound } from "next/navigation";
import Link from "next/link";
import { getPlayerSeasonDetail, getAvailableYears } from "@/actions/season-stats";
import { getPlayer } from "@/actions/players";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Button } from "@/components/button";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ year?: string }>;
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { playerId } = await params;
  const { year: yearParam } = await searchParams;
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const [playerData, seasonData, years] = await Promise.all([
    getPlayer(playerId),
    getPlayerSeasonDetail(playerId, year),
    getAvailableYears(),
  ]);

  if (!playerData) {
    notFound();
  }

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/leaderboard?year=${year}`}>
          <Button variant="ghost" size="sm">
            ← Back
          </Button>
        </Link>
      </div>

      {/* Player Info */}
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold">
            {playerData.nickname || playerData.fullName}
          </h1>
          {playerData.nickname && (
            <p className="text-gray-600">{playerData.fullName}</p>
          )}
          {playerData.handicapIndex && (
            <p className="text-sm text-gray-500 mt-1">
              Handicap: {playerData.handicapIndex.toString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Year Selector */}
      <div className="flex gap-2 overflow-x-auto py-1">
        {years.map((y) => (
          <Link key={y} href={`/leaderboard/${playerId}?year=${y}`}>
            <Button
              variant={y === year ? "primary" : "secondary"}
              size="sm"
            >
              {y}
            </Button>
          </Link>
        ))}
      </div>

      {/* Season Stats */}
      <Card>
        <CardHeader>{year} Season Stats</CardHeader>
        <CardContent>
          {seasonData.stats ? (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  ${Math.round(seasonData.stats.totalWinnings.toNumber())}
                </p>
                <p className="text-xs text-gray-500">Total Winnings</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {seasonData.stats.roundsPlayed}
                </p>
                <p className="text-xs text-gray-500">Rounds Played</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {seasonData.stats.topTeamAppearances}
                </p>
                <p className="text-xs text-gray-500">Top Team Finishes</p>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">
              No rounds played in {year}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Round History */}
      <Card>
        <CardHeader>{year} Round History</CardHeader>
        <CardContent>
          {seasonData.rounds.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No rounds found</p>
          ) : (
            <div className="space-y-2">
              {seasonData.rounds.map((round) => (
                <Link
                  key={round.roundId}
                  href={`/rounds/${round.roundId}/summary`}
                  className="flex items-center justify-between py-3 border-b last:border-b-0 hover:bg-gray-50 -mx-4 px-4"
                >
                  <div>
                    <p className="font-medium">{formatDate(round.date)}</p>
                    <p className="text-sm text-gray-600">{round.courseName}</p>
                    <p className="text-xs text-gray-500">
                      Team {round.teamNumber} • {round.formatName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold ${
                        round.wasOnTopPayingTeam ? "text-green-600" : ""
                      }`}
                    >
                      ${Math.round(round.payout.toNumber())}
                    </p>
                    {round.wasOnTopPayingTeam && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                        Top Team
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
