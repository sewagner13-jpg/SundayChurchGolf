"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Input } from "@/components/input";
import { Modal, ConfirmModal } from "@/components/modal";
import {
  createFormat,
  updateFormat,
  deleteFormat,
  listFormats,
} from "@/actions/formats";

interface Format {
  id: string;
  name: string;
  description: string;
}

export default function FormatsPage() {
  const [formats, setFormats] = useState<Format[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFormat, setEditingFormat] = useState<Format | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadFormats();
  }, []);

  async function loadFormats() {
    try {
      const data = await listFormats();
      setFormats(data);
      setLoading(false);
    } catch (err) {
      setError("Failed to load formats");
      setLoading(false);
    }
  }

  const openAddModal = () => {
    setEditingFormat(null);
    setName("");
    setDescription("");
    setShowModal(true);
    setError(null);
  };

  const openEditModal = (format: Format) => {
    setEditingFormat(format);
    setName(format.name);
    setDescription(format.description);
    setShowModal(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Format name is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    setFormLoading(true);
    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
      };

      if (editingFormat) {
        await updateFormat(editingFormat.id, data);
      } else {
        await createFormat(data);
      }

      setShowModal(false);
      await loadFormats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save format");
    }
    setFormLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteFormat(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadFormats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete format");
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return <p className="text-center py-8">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Formats</h1>
        <Button onClick={openAddModal}>Add Format</Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
          <button onClick={() => setError(null)} className="float-right">
            ×
          </button>
        </div>
      )}

      {formats.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-gray-500">
            No formats added yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {formats.map((format) => (
            <Card key={format.id}>
              <CardContent>
                <div className="flex justify-between items-start">
                  <div
                    onClick={() => openEditModal(format)}
                    className="flex-1 cursor-pointer"
                  >
                    <p className="font-medium hover:text-green-600">
                      {format.name}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {format.description}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteConfirm(format)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingFormat ? "Edit Format" : "Add Format"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Format Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Describe the scoring rules and format..."
            />
          </div>
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
        title="Delete Format"
        message={`Are you sure you want to delete ${deleteConfirm?.name}? This cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}
