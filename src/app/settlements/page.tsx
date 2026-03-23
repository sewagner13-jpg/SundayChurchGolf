"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { ConfirmModal } from "@/components/modal";
import { listManualSettlements, deleteManualSettlement } from "@/actions/settlements";

interface SettlementEntry {
  id: string;
  playerId: string;
  amount: { toString(): string } | number | string; // Prisma Decimal | number | string
  player: { id: string; fullName: string; nickname: string | null };
}

interface Settlement {
  id: string;
  date: string | Date;
  year: number;
  description: string | null;
  entries: SettlementEntry[];
}

export default function SettlementsPage() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Settlement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManualSettlements();
      setSettlements(data as unknown as Settlement[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settlements");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteManualSettlement(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
    setDeleting(false);
  };

  const fmt = (amount: { toString(): string } | number | string) => {
    const n = Number(amount.toString());
    const abs = Math.abs(n).toFixed(2);
    return n >= 0 ? `+$${abs}` : `-$${abs}`;
  };

  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            ← Back
          </Button>
          <h1 className="text-2xl font-bold mt-1">Manual Settlements</h1>
          <p className="text-sm text-gray-500">
            Record payouts outside of a scored round
          </p>
        </div>
        <Button onClick={() => router.push("/settlements/new")}>
          + New Settlement
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : settlements.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-gray-500 text-sm p-4 text-center">
              No manual settlements yet. Use these when scoring breaks down and
              you want to record who won without a full round.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {settlements.map((s) => (
            <Card key={s.id}>
              <CardContent>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {fmtDate(s.date)}
                      </p>
                      {s.description && (
                        <p className="text-sm text-gray-500">{s.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(s)}
                      className="text-red-600 hover:text-red-700 shrink-0"
                    >
                      Delete
                    </Button>
                  </div>

                  <div className="space-y-1">
                    {s.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-700">
                          {entry.player.nickname ?? entry.player.fullName}
                        </span>
                        <span
                          className={
                            Number(entry.amount.toString()) >= 0
                              ? "font-semibold text-green-700"
                              : "font-semibold text-red-600"
                          }
                        >
                          {fmt(entry.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          isOpen={!!deleteTarget}
          title="Delete Settlement"
          message={`Delete the ${fmtDate(deleteTarget.date)} settlement? This will reverse all payout credits for the players listed.`}
          confirmText={deleting ? "Deleting…" : "Delete"}
          confirmVariant="danger"
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
