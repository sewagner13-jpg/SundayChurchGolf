"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Input } from "@/components/input";
import { Modal, ConfirmModal } from "@/components/modal";
import {
  createPlayer,
  updatePlayer,
  setPlayerActive,
  deletePlayer,
  listPlayers,
} from "@/actions/players";
interface Player {
  id: string;
  fullName: string;
  nickname: string | null;
  handicapIndex: number | null;
  handicapLastUpdatedAt: Date | null;
  isActive: boolean;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [handicapIndex, setHandicapIndex] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    try {
      const data = await listPlayers(true);
      setPlayers(data);
      setLoading(false);
    } catch (err) {
      setError("Failed to load players");
      setLoading(false);
    }
  }

  const openAddModal = () => {
    setEditingPlayer(null);
    setFullName("");
    setNickname("");
    setHandicapIndex("");
    setShowModal(true);
    setError(null);
  };

  const openEditModal = (player: Player) => {
    setEditingPlayer(player);
    setFullName(player.fullName);
    setNickname(player.nickname || "");
    setHandicapIndex(player.handicapIndex != null ? String(player.handicapIndex) : "");
    setShowModal(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }

    setFormLoading(true);
    try {
      const data = {
        fullName: fullName.trim(),
        nickname: nickname.trim() || null,
        handicapIndex: handicapIndex ? parseFloat(handicapIndex) : null,
      };

      if (editingPlayer) {
        await updatePlayer(editingPlayer.id, data);
      } else {
        await createPlayer(data);
      }

      setShowModal(false);
      await loadPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save player");
    }
    setFormLoading(false);
  };

  const handleToggleActive = async (player: Player) => {
    try {
      await setPlayerActive(player.id, !player.isActive);
      await loadPlayers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update player"
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await deletePlayer(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete player");
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return <p className="text-center py-8">Loading...</p>;
  }

  const activePlayers = players.filter((p) => p.isActive);
  const inactivePlayers = players.filter((p) => !p.isActive);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Players</h1>
        <Button onClick={openAddModal}>Add Player</Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
          <button onClick={() => setError(null)} className="float-right">
            ×
          </button>
        </div>
      )}

      {/* Active Players */}
      <Card>
        <CardHeader>Active Players ({activePlayers.length})</CardHeader>
        <CardContent>
          {activePlayers.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No active players</p>
          ) : (
            <div className="space-y-2">
              {activePlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between py-2 border-b last:border-b-0"
                >
                  <div className="flex-1" onClick={() => openEditModal(player)}>
                    <p className="font-medium cursor-pointer hover:text-green-600">
                      {player.nickname || player.fullName}
                    </p>
                    {player.nickname && (
                      <p className="text-xs text-gray-500">{player.fullName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {player.handicapIndex != null
                        ? `${player.handicapIndex} HCP`
                        : "-"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(player)}
                    >
                      Deactivate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactive Players */}
      {inactivePlayers.length > 0 && (
        <Card>
          <CardHeader>Inactive Players ({inactivePlayers.length})</CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inactivePlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between py-2 border-b last:border-b-0 opacity-60"
                >
                  <div className="flex-1" onClick={() => openEditModal(player)}>
                    <p className="font-medium cursor-pointer hover:text-green-600">
                      {player.nickname || player.fullName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(player)}
                    >
                      Activate
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteConfirm(player)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingPlayer ? "Edit Player" : "Add Player"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            label="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Display name (optional)"
          />
          <Input
            label="Handicap Index"
            type="number"
            step="0.1"
            min="-10"
            max="54"
            value={handicapIndex}
            onChange={(e) => setHandicapIndex(e.target.value)}
            placeholder="e.g., 12.5"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={formLoading}>
              {formLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Player"
        message={`Are you sure you want to delete ${
          deleteConfirm?.nickname || deleteConfirm?.fullName
        }? This cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}
