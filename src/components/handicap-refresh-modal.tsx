"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { GHINLinkButton } from "@/components/ghin-link-button";
import { refreshPlayerHandicap } from "@/actions/handicaps";

interface HandicapRefreshPlayer {
  id: string;
  fullName: string;
  nickname: string | null;
  ghinNumber?: string | null;
  ghinProfileUrl?: string | null;
  handicapIndex: number | null;
  lastVerifiedDate?: Date | string | null;
}

interface HandicapRefreshModalProps {
  isOpen: boolean;
  player: HandicapRefreshPlayer | null;
  onClose: () => void;
  onSaved: (playerId: string, handicapIndex: number, verifiedAt: Date) => void;
  nextLabel?: string | null;
}

export function HandicapRefreshModal({
  isOpen,
  player,
  onClose,
  onSaved,
  nextLabel,
}: HandicapRefreshModalProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!player) return;
    setValue(player.handicapIndex != null ? String(player.handicapIndex) : "");
    setError(null);
  }, [player]);

  if (!player) return null;

  const verifiedLabel = player.lastVerifiedDate
    ? new Date(player.lastVerifiedDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Never";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Refresh Handicap">
      <div className="space-y-4">
        <div className="space-y-1 text-sm text-gray-600">
          <p className="font-medium text-gray-900">
            {player.nickname || player.fullName}
          </p>
          {player.nickname && <p>{player.fullName}</p>}
          <p>GHIN Number: {player.ghinNumber || "—"}</p>
          <p>Current Handicap: {player.handicapIndex ?? "—"}</p>
          <p>Last Verified: {verifiedLabel}</p>
        </div>

        <div className="flex gap-2">
          <GHINLinkButton
            ghinNumber={player.ghinNumber}
            ghinProfileUrl={player.ghinProfileUrl}
          />
        </div>

        <Input
          label="Updated Handicap Index"
          type="number"
          step="0.1"
          min="-10"
          max="54"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />

        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={async () => {
              const handicapIndex = Number(value);
              if (Number.isNaN(handicapIndex)) {
                setError("Enter a valid handicap index");
                return;
              }

              setLoading(true);
              setError(null);
              try {
                const updated = await refreshPlayerHandicap(player.id, handicapIndex);
                onSaved(player.id, updated.handicapIndex ?? handicapIndex, new Date());
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Failed to refresh handicap"
                );
                setLoading(false);
                return;
              }
              setLoading(false);
            }}
            disabled={loading}
          >
            {loading
              ? "Saving..."
              : nextLabel
              ? `Save & Next (${nextLabel})`
              : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
