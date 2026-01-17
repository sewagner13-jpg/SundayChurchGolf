import Link from "next/link";
import { getActiveRound, getFinishedRounds } from "@/actions/rounds";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const activeRound = await getActiveRound();
  const finishedRounds = await getFinishedRounds();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-center">Sunday Church</h1>

      {/* Active Round Section */}
      <Card>
        <CardHeader>Current Round</CardHeader>
        <CardContent>
          {activeRound ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                <p>
                  <span className="font-medium">Date:</span>{" "}
                  {formatDate(activeRound.date)}
                </p>
                <p>
                  <span className="font-medium">Course:</span>{" "}
                  {activeRound.course.name}
                </p>
                <p>
                  <span className="font-medium">Status:</span>{" "}
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
                <Button className="w-full" size="lg">
                  Resume Current Round
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-600 text-center">No active round</p>
              <Link href="/rounds/new">
                <Button className="w-full" size="lg">
                  Create New Round
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Rounds */}
      <Card>
        <CardHeader>Recent Rounds</CardHeader>
        <CardContent>
          {finishedRounds.length === 0 ? (
            <p className="text-gray-600 text-center py-4">
              No completed rounds yet
            </p>
          ) : (
            <ul className="divide-y">
              {finishedRounds.slice(0, 10).map((round) => (
                <li key={round.id}>
                  <Link
                    href={`/rounds/${round.id}/summary`}
                    className="block py-3 hover:bg-gray-50 -mx-4 px-4"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{formatDate(round.date)}</p>
                        <p className="text-sm text-gray-600">
                          {round.course.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {round.roundPlayers.length} players
                        </p>
                        <p className="text-sm text-green-600 font-medium">
                          ${round.pot?.toNumber().toFixed(0) ?? 0} pot
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
