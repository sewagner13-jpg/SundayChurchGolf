"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRoundLog, reopenRound } from "@/actions/rounds";
import { deleteQuickRound } from "@/actions/quick-rounds";
import { Card, CardContent } from "@/components/card";
import { Button } from "@/components/button";
import { Modal, ConfirmModal } from "@/components/modal";

interface RoundLogEntry {
  id: string;
  name: string | null;
  date: Date;
  status: string;
  hasLockCode: boolean;
  courseName: string;
  formatName: string;
  playerCount: number;
  teamCount: number;
  isManualEntry: boolean;
  topTeamLabels: string[];
}

export default function RoundLogPage() {
  const router = useRouter();
  const [rounds, setRounds] = useState<RoundLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState<RoundLogEntry | null>(null);
  const [reopenCode, setReopenCode] = useState("");
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoundLogEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadRounds();
  }, []);

  async function loadRounds() {
    setLoading(true);
    try {
      const data = await getRoundLog();
      setRounds(data as RoundLogEntry[]);
    } catch {
      setReopenError("Failed to load round log");
    }
    setLoading(false);
  }

  async function handleReopen() {
    if (!selectedRound) return;
    if (!reopenCode.trim()) {
      setReopenError("Enter the lock code");
      return;
    }

    setReopening(true);
    try {
      await reopenRound(selectedRound.id, reopenCode.trim());
      router.push(`/rounds/${selectedRound.id}/scoring`);
    } catch (err) {
      setReopenError(err instanceof Error ? err.message : "Failed to reopen round");
      setReopening(false);
    }
  }

  async function handleDeleteQuickRound() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQuickRound(deleteTarget.id);
      setDeleteTarget(null);
      await loadRounds();
    } catch (err) {
      setReopenError(err instanceof Error ? err.message : "Failed to delete");
    }
    setDeleting(false);
  }

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Round Log</h1>
          <p className="text-sm text-gray-600">
            View every round and reopen finished rounds if you have the lock code.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/rounds/record">
            <Button variant="secondary">Record Past Round</Button>
          </Link>
          <Link href="/rounds/new">
            <Button>Create Round</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8">Loading rounds...</p>
      ) : rounds.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-600">
            No rounds yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => {
            const primaryHref =
              round.status === "FINISHED"
                ? `/rounds/${round.id}/final-payouts`
                : round.status === "LIVE"
                  ? `/rounds/${round.id}/scoring`
                  : `/rounds/${round.id}/setup`;

            return (
              <Card key={round.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-lg">
                          {round.name?.trim() || formatDate(round.date)}
                        </h2>
                        {round.isManualEntry && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            Manual Entry
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{formatDate(round.date)}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {round.status}
                    </span>
                  </div>

                  <div className="grid gap-1 text-sm text-gray-700 md:grid-cols-2">
                    <p>
                      <span className="text-gray-500">Course:</span> {round.courseName}
                    </p>
                    <p>
                      <span className="text-gray-500">Format:</span> {round.formatName}
                    </p>
                    <p>
                      <span className="text-gray-500">Players:</span> {round.playerCount}
                    </p>
                    <p>
                      <span className="text-gray-500">Teams:</span> {round.teamCount}
                    </p>
                  </div>

                  {round.topTeamLabels.length > 0 && (
                    <p className="text-sm text-gray-700">
                      <span className="text-gray-500">Winning team:</span>{" "}
                      {round.topTeamLabels.join(", ")}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Link href={primaryHref}>
                      <Button variant="secondary" size="sm">
                        {round.status === "FINISHED"
                          ? "View Results"
                          : round.status === "LIVE"
                            ? "Resume Round"
                            : "Continue Setup"}
                      </Button>
                    </Link>
                    {round.status === "FINISHED" && round.hasLockCode && !round.isManualEntry && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedRound(round);
                          setReopenCode("");
                          setReopenError(null);
                        }}
                      >
                        Reopen
                      </Button>
                    )}
                    {round.status === "FINISHED" && !round.hasLockCode && !round.isManualEntry && (
                      <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                        View only
                      </span>
                    )}
                    {round.isManualEntry && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(round)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          isOpen={!!deleteTarget}
          title="Delete Manual Round"
          message={`Delete the ${formatDate(deleteTarget.date)} manual entry${deleteTarget.name ? ` "${deleteTarget.name}"` : ""}? This will remove the round and reverse season stats for all ${deleteTarget.playerCount} players.`}
          confirmText={deleting ? "Deleting…" : "Delete"}
          confirmVariant="danger"
          onConfirm={handleDeleteQuickRound}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <Modal
        isOpen={selectedRound !== null}
        onClose={() => {
          setSelectedRound(null);
          setReopenCode("");
          setReopenError(null);
        }}
        title="Reopen Round"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter the round lock code to reopen{" "}
            <span className="font-medium">
              {selectedRound?.name?.trim() || (selectedRound ? formatDate(selectedRound.date) : "")}
            </span>
            .
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Lock Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={reopenCode}
              onChange={(e) => setReopenCode(e.target.value)}
              placeholder="4-digit lock code"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          {reopenError && <p className="text-sm text-red-600">{reopenError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedRound(null);
                setReopenCode("");
                setReopenError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleReopen} disabled={reopening}>
              {reopening ? "Reopening..." : "Reopen Round"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
