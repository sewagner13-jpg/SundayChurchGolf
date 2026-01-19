import Link from "next/link";
import { getActiveRound, getFinishedRounds } from "@/actions/rounds";
import { getLeaderboard } from "@/actions/season-stats";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { MastersLeaderboard } from "@/components/masters-leaderboard";
import { MastersThemePlayer } from "@/components/masters-theme-player";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const currentYear = new Date().getFullYear();
  const [activeRound, finishedRounds, leaderboard] = await Promise.all([
    getActiveRound(),
    getFinishedRounds(),
    getLeaderboard(currentYear),
  ]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen relative">
      {/* Background Image with Overlay */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url('/sunday-church-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 py-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="text-4xl md:text-5xl font-serif font-bold text-yellow-100 drop-shadow-lg"
            style={{
              textShadow: "2px 2px 4px rgba(0,0,0,0.5), 0 0 30px rgba(255,215,0,0.3)"
            }}
          >
            Sunday Church
          </h1>
          <p className="text-yellow-200/80 text-sm mt-1 font-medium tracking-wider">
            SCRAMBLE SKINS
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Left Column - Leaderboard */}
          <div className="space-y-4">
            <MastersLeaderboard entries={leaderboard} year={currentYear} />
          </div>

          {/* Right Column - Round Actions */}
          <div className="space-y-4">
            {/* Active Round / New Round Card */}
            <Card className="bg-white/95 backdrop-blur-sm shadow-xl border-green-800/20">
              <CardHeader className="bg-green-800 text-white rounded-t-lg">
                {activeRound ? "Current Round" : "Start Playing"}
              </CardHeader>
              <CardContent className="p-4">
                {activeRound ? (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-700 space-y-1">
                      <p className="flex justify-between">
                        <span className="text-gray-500">Date:</span>
                        <span className="font-medium">{formatDate(activeRound.date)}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-gray-500">Course:</span>
                        <span className="font-medium">{activeRound.course.name}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <span
                          className={`font-semibold ${
                            activeRound.status === "DRAFT"
                              ? "text-yellow-600"
                              : "text-green-600"
                          }`}
                        >
                          {activeRound.status}
                        </span>
                      </p>
                    </div>
                    <Link
                      href={
                        activeRound.status === "DRAFT"
                          ? `/rounds/${activeRound.id}/setup`
                          : `/rounds/${activeRound.id}/scoring`
                      }
                    >
                      <Button className="w-full bg-green-700 hover:bg-green-600" size="lg">
                        Resume Round
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center py-4">
                      <div className="text-5xl mb-2">⛳</div>
                      <p className="text-gray-600">Ready for Sunday Church?</p>
                    </div>
                    <Link href="/rounds/new">
                      <Button className="w-full bg-green-700 hover:bg-green-600" size="lg">
                        Create New Round
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Rounds */}
            <Card className="bg-white/95 backdrop-blur-sm shadow-xl border-green-800/20">
              <CardHeader className="bg-green-800/90 text-white">
                Recent Rounds
              </CardHeader>
              <CardContent className="p-0">
                {finishedRounds.length === 0 ? (
                  <p className="text-gray-500 text-center py-6 text-sm">
                    No completed rounds yet
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {finishedRounds.slice(0, 5).map((round) => (
                      <li key={round.id}>
                        <Link
                          href={`/rounds/${round.id}/summary`}
                          className="block py-3 px-4 hover:bg-green-50 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-gray-800">
                                {formatDate(round.date)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {round.course.name}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">
                                {round.roundPlayers.length} players
                              </p>
                              <p className="text-sm text-green-700 font-bold">
                                ${round.pot ? Number(round.pot).toFixed(0) : 0}
                              </p>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {finishedRounds.length > 5 && (
                  <div className="p-3 border-t border-gray-100 text-center">
                    <Link
                      href="/leaderboard"
                      className="text-sm text-green-700 hover:text-green-800 font-medium"
                    >
                      View All History
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Links */}
            <div className="grid grid-cols-3 gap-2">
              <Link href="/players">
                <Card className="bg-white/90 backdrop-blur-sm hover:bg-white transition-colors cursor-pointer">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">👥</div>
                    <p className="text-xs font-medium text-gray-700">Players</p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/courses">
                <Card className="bg-white/90 backdrop-blur-sm hover:bg-white transition-colors cursor-pointer">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">🏌️</div>
                    <p className="text-xs font-medium text-gray-700">Courses</p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/leaderboard">
                <Card className="bg-white/90 backdrop-blur-sm hover:bg-white transition-colors cursor-pointer">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">🏆</div>
                    <p className="text-xs font-medium text-gray-700">Stats</p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Masters Theme Player */}
      <MastersThemePlayer />
    </div>
  );
}
