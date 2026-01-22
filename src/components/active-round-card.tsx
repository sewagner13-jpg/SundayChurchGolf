"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { ConfirmModal } from "@/components/modal";

interface ActiveRound {
  id: string;
  name?: string | null;
  date: Date;
  status: string;
  course: { name: string };
}

interface ActiveRoundCardProps {
  activeRound: ActiveRound | null;
}

export function ActiveRoundCard({ activeRound }: ActiveRoundCardProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handleDelete = async () => {
    if (!activeRound) return;
    setDeleting(true);
    try {
      // Use the cancel-round API to delete only this active round
      const res = await fetch("/api/cancel-round", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel round");
      }
      router.refresh();
      setShowDeleteModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel round");
    }
    setDeleting(false);
  };

  return (
    <>
      <Card className="bg-white/95 shadow-xl border-green-800/20">
        <CardHeader className="bg-green-800 text-white rounded-t-lg">
          {activeRound ? "Current Round" : "Start Playing"}
        </CardHeader>
        <CardContent className="p-4">
          {activeRound ? (
            <div className="space-y-4">
              {activeRound.name && (
                <p className="text-center font-semibold text-green-800 text-lg">
                  {activeRound.name}
                </p>
              )}
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
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full text-sm text-red-600 hover:text-red-700 py-1"
              >
                Cancel Round
              </button>
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

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Cancel Round"
        message="Are you sure you want to cancel this round? All data for this round will be deleted."
        confirmText={deleting ? "Deleting..." : "Cancel Round"}
        confirmVariant="danger"
      />
    </>
  );
}
