"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { createRound } from "@/actions/rounds";
import { VisibilityMode, BlindRevealMode } from "@prisma/client";

interface Course {
  id: string;
  name: string;
}

interface Format {
  id: string;
  name: string;
}

interface NewRoundPageClientProps {
  courses: Course[];
  formats: Format[];
  defaultCourseId: string;
  defaultFormatId: string;
}

function getNextSunday(): string {
  const today = new Date();
  const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  return nextSunday.toISOString().split("T")[0];
}

export default function NewRoundPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Create New Round</h1>
      <NewRoundForm />
    </div>
  );
}

function NewRoundForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Form state
  const [date, setDate] = useState(getNextSunday());
  const [courseId, setCourseId] = useState("");
  const [formatId, setFormatId] = useState("");
  const [buyIn, setBuyIn] = useState("30");
  const [visibility, setVisibility] = useState<VisibilityMode>("OPEN");
  const [blindRevealMode, setBlindRevealMode] =
    useState<BlindRevealMode>("REVEAL_AFTER_ROUND");

  // Load data on mount
  useState(() => {
    async function loadData() {
      try {
        const [coursesRes, formatsRes] = await Promise.all([
          fetch("/api/courses"),
          fetch("/api/formats"),
        ]);
        const coursesData = await coursesRes.json();
        const formatsData = await formatsRes.json();

        setCourses(coursesData);
        setFormats(formatsData);

        // Set defaults
        const timberlake = coursesData.find(
          (c: Course) => c.name === "Timberlake Country Club"
        );
        const sundayChurch = formatsData.find(
          (f: Format) => f.name === "Sunday Church Scramble Skins"
        );

        if (timberlake) setCourseId(timberlake.id);
        else if (coursesData.length > 0) setCourseId(coursesData[0].id);

        if (sundayChurch) setFormatId(sundayChurch.id);
        else if (formatsData.length > 0) setFormatId(formatsData[0].id);

        setDataLoaded(true);
      } catch (err) {
        setError("Failed to load data");
      }
    }
    loadData();
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const round = await createRound({
        date: new Date(date),
        courseId,
        formatId,
        buyInPerPlayer: Number(buyIn),
        visibility,
        blindRevealMode: visibility === "BLIND" ? blindRevealMode : undefined,
      });

      router.push(`/rounds/${round.id}/setup`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create round");
      setLoading(false);
    }
  };

  if (!dataLoaded) {
    return <p className="text-center py-8">Loading...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>Round Details</CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <Select
            label="Course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            options={courses.map((c) => ({ value: c.id, label: c.name }))}
            required
          />

          <Select
            label="Format"
            value={formatId}
            onChange={(e) => setFormatId(e.target.value)}
            options={formats.map((f) => ({ value: f.id, label: f.name }))}
            required
          />

          <Input
            label="Buy-in per Player ($)"
            type="number"
            min="1"
            value={buyIn}
            onChange={(e) => setBuyIn(e.target.value)}
            required
          />

          <Select
            label="Visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as VisibilityMode)}
            options={[
              { value: "OPEN", label: "Open (all teams see scores)" },
              { value: "BLIND", label: "Blind (hidden until revealed)" },
            ]}
          />

          {visibility === "BLIND" && (
            <Select
              label="Blind Reveal Mode"
              value={blindRevealMode}
              onChange={(e) =>
                setBlindRevealMode(e.target.value as BlindRevealMode)
              }
              options={[
                {
                  value: "REVEAL_AFTER_ROUND",
                  label: "Reveal after round ends",
                },
                {
                  value: "REVEAL_AFTER_HOLE",
                  label: "Reveal after each hole",
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => router.push("/")}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? "Creating..." : "Continue to Player Selection"}
        </Button>
      </div>
    </form>
  );
}
