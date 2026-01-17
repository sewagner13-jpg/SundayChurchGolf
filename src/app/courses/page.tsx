"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Input } from "@/components/input";
import { Modal, ConfirmModal } from "@/components/modal";
import {
  createCourse,
  updateCourse,
  deleteCourse,
  listCourses,
} from "@/actions/courses";

interface CourseHole {
  holeNumber: number;
  par: number;
  handicapRank: number;
}

interface Course {
  id: string;
  name: string;
  scorecardImageUrl: string | null;
  holes: CourseHole[];
}

const DEFAULT_HOLES: CourseHole[] = Array.from({ length: 18 }, (_, i) => ({
  holeNumber: i + 1,
  par: 4,
  handicapRank: i + 1,
}));

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [scorecardUrl, setScorecardUrl] = useState("");
  const [holes, setHoles] = useState<CourseHole[]>(DEFAULT_HOLES);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    try {
      const data = await listCourses();
      setCourses(data);
      setLoading(false);
    } catch (err) {
      setError("Failed to load courses");
      setLoading(false);
    }
  }

  const openAddModal = () => {
    setEditingCourse(null);
    setName("");
    setScorecardUrl("");
    setHoles(DEFAULT_HOLES);
    setShowModal(true);
    setError(null);
  };

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setName(course.name);
    setScorecardUrl(course.scorecardImageUrl || "");
    setHoles(course.holes.sort((a, b) => a.holeNumber - b.holeNumber));
    setShowModal(true);
    setError(null);
  };

  const updateHole = (
    holeNumber: number,
    field: "par" | "handicapRank",
    value: number
  ) => {
    setHoles((prev) =>
      prev.map((h) =>
        h.holeNumber === holeNumber ? { ...h, [field]: value } : h
      )
    );
  };

  const validateHoles = (): string | null => {
    const ranks = holes.map((h) => h.handicapRank);
    const uniqueRanks = new Set(ranks);
    if (uniqueRanks.size !== 18) {
      return "Handicap ranks must be unique 1-18";
    }
    for (let i = 1; i <= 18; i++) {
      if (!ranks.includes(i)) {
        return `Missing handicap rank ${i}`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Course name is required");
      return;
    }

    const validationError = validateHoles();
    if (validationError) {
      setError(validationError);
      return;
    }

    setFormLoading(true);
    try {
      const data = {
        name: name.trim(),
        scorecardImageUrl: scorecardUrl.trim() || null,
        holes: holes.map((h) => ({
          holeNumber: h.holeNumber,
          par: h.par,
          handicapRank: h.handicapRank,
        })),
      };

      if (editingCourse) {
        await updateCourse(editingCourse.id, data);
      } else {
        await createCourse(data);
      }

      setShowModal(false);
      await loadCourses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save course");
    }
    setFormLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteCourse(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadCourses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete course");
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return <p className="text-center py-8">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Courses</h1>
        <Button onClick={openAddModal}>Add Course</Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
          <button onClick={() => setError(null)} className="float-right">
            ×
          </button>
        </div>
      )}

      {courses.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-gray-500">
            No courses added yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardContent className="flex justify-between items-center">
                <div onClick={() => openEditModal(course)} className="flex-1">
                  <p className="font-medium cursor-pointer hover:text-green-600">
                    {course.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    Par {course.holes.reduce((sum, h) => sum + h.par, 0)}
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteConfirm(course)}
                >
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCourse ? "Edit Course" : "Add Course"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Course Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Scorecard Image URL"
            type="url"
            value={scorecardUrl}
            onChange={(e) => setScorecardUrl(e.target.value)}
            placeholder="Optional reference image"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hole Details
            </label>
            <div className="max-h-64 overflow-y-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Hole</th>
                    <th className="px-2 py-1 text-center">Par</th>
                    <th className="px-2 py-1 text-center">HCP Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {holes.map((hole) => (
                    <tr key={hole.holeNumber} className="border-t">
                      <td className="px-2 py-1">{hole.holeNumber}</td>
                      <td className="px-2 py-1">
                        <select
                          value={hole.par}
                          onChange={(e) =>
                            updateHole(
                              hole.holeNumber,
                              "par",
                              Number(e.target.value)
                            )
                          }
                          className="w-full border rounded px-1"
                        >
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                          <option value={5}>5</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min="1"
                          max="18"
                          value={hole.handicapRank}
                          onChange={(e) =>
                            updateHole(
                              hole.holeNumber,
                              "handicapRank",
                              Number(e.target.value)
                            )
                          }
                          className="w-full border rounded px-1 text-center"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              HCP Rank 1 = hardest hole, 18 = easiest
            </p>
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
        title="Delete Course"
        message={`Are you sure you want to delete ${deleteConfirm?.name}? This cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}
