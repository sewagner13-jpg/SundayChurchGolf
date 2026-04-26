import Link from "next/link";
import { getActiveRound } from "@/actions/rounds";
import { getLeaderboard } from "@/actions/season-stats";
import { Card, CardContent } from "@/components/card";
import { MastersLeaderboard } from "@/components/masters-leaderboard";
import { MastersThemePlayer } from "@/components/masters-theme-player";
import { ActiveRoundCard } from "@/components/active-round-card";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const currentYear = new Date().getFullYear();
  const [activeRound, leaderboard] = await Promise.all([
    getActiveRound(),
    getLeaderboard(currentYear),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-green-900">
      {/* Content */}
      <div className="px-4 py-6 max-w-6xl mx-auto">
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
            <ActiveRoundCard activeRound={activeRound as { id: string; name?: string | null; date: Date; status: string; course: { name: string } } | null} />

            {/* Quick Links */}
            <div className="grid grid-cols-3 gap-2">
              <Link href="/rounds">
                <Card className="bg-white/90 hover:bg-white transition-colors cursor-pointer">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">📅</div>
                    <p className="text-xs font-medium text-gray-700">Rounds</p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/players">
                <Card className="bg-white/90 hover:bg-white transition-colors cursor-pointer">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">👥</div>
                    <p className="text-xs font-medium text-gray-700">Players</p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/courses">
                <Card className="bg-white/90 hover:bg-white transition-colors cursor-pointer">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">🏌️</div>
                    <p className="text-xs font-medium text-gray-700">Courses</p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/stats">
                <Card className="bg-white/90 hover:bg-white transition-colors cursor-pointer">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">📊</div>
                    <p className="text-xs font-medium text-gray-700">Stats</p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/formats">
                <Card className="bg-white/90 hover:bg-white transition-colors cursor-pointer">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">📋</div>
                    <p className="text-xs font-medium text-gray-700">Formats</p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/leaderboard">
                <Card className="bg-white/90 hover:bg-white transition-colors cursor-pointer">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">🏆</div>
                    <p className="text-xs font-medium text-gray-700">Leaderboard</p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/settlements">
                <Card className="bg-white/90 hover:bg-white transition-colors cursor-pointer">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">💰</div>
                    <p className="text-xs font-medium text-gray-700">Settlements</p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/rounds/record">
                <Card className="bg-white/90 hover:bg-white transition-colors cursor-pointer">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">📝</div>
                    <p className="text-xs font-medium text-gray-700">Record Round</p>
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
