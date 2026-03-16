"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { createRound } from "@/actions/rounds";
import { VisibilityMode, BlindRevealMode } from "@prisma/client";
import {
  IRISH_GOLF_ELIGIBLE_SEGMENT_FORMATS,
  type FormatConfigOption,
} from "@/lib/format-definitions";

interface Course {
  id: string;
  name: string;
}

interface EnrichedFormat {
  id: string;
  name: string;
  gameDescription?: string;
  formatCategory?: string;
  supportedTeamSizes?: number[];
  configOptions?: FormatConfigOption[];
  requiresIndividualScores?: boolean;
  requiresDriveTracking?: boolean;
  definitionId?: string | null;
}

function getNextSunday(): string {
  const today = new Date();
  const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  return nextSunday.toISOString().split("T")[0];
}

function buildDefaultConfig(
  format: EnrichedFormat
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const opt of format.configOptions ?? []) {
    if (opt.defaultValue !== undefined) config[opt.key] = opt.defaultValue;
  }
  if (config.enableDriveMinimums === undefined) {
    config.enableDriveMinimums = false;
  }
  if (config.requiredDrivesPerPlayer === undefined) {
    config.requiredDrivesPerPlayer = 4;
  }
  if (config.excludePar3sFromDriveMinimums === undefined) {
    config.excludePar3sFromDriveMinimums = false;
  }
  return config;
}

function getRequiredDrivesPerPlayer(
  formatConfig: Record<string, unknown>
): number | null {
  const value = formatConfig.requiredDrivesPerPlayer;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  const [formats, setFormats] = useState<EnrichedFormat[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [date, setDate] = useState(getNextSunday());
  const [courseId, setCourseId] = useState("");
  const [formatId, setFormatId] = useState("");
  const [buyIn, setBuyIn] = useState("30");
  const [visibility, setVisibility] = useState<VisibilityMode>("OPEN");
  const [blindRevealMode, setBlindRevealMode] =
    useState<BlindRevealMode>("REVEAL_AFTER_ROUND");
  const [formatConfig, setFormatConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
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

        const timberlake = coursesData.find(
          (c: Course) => c.name === "Timberlake Country Club"
        );
        const sundayChurch = formatsData.find(
          (f: EnrichedFormat) => f.name === "Sunday Church Scramble Skins"
        );

        if (timberlake) setCourseId(timberlake.id);
        else if (coursesData.length > 0) setCourseId(coursesData[0].id);

        if (sundayChurch) {
          setFormatId(sundayChurch.id);
          setFormatConfig(buildDefaultConfig(sundayChurch));
        } else if (formatsData.length > 0) {
          setFormatId(formatsData[0].id);
          setFormatConfig(buildDefaultConfig(formatsData[0]));
        }

        setDataLoaded(true);
      } catch {
        setError("Failed to load data");
      }
    }
    loadData();
  }, []);

  const selectedFormat = formats.find((f) => f.id === formatId) ?? null;
  const isVegas = selectedFormat?.name === "Vegas";
  const isIrishGolf = selectedFormat?.name === "Irish Golf / 6-6-6";
  const driveMinimumsEnabled = !!formatConfig.enableDriveMinimums;
  const requiredDrivesPerPlayer = getRequiredDrivesPerPlayer(formatConfig);
  const excludePar3sFromDriveMinimums =
    formatConfig.excludePar3sFromDriveMinimums === true;
  const eligibleSegmentFormats = formats.filter(
    (f) =>
      f.definitionId !== null &&
      IRISH_GOLF_ELIGIBLE_SEGMENT_FORMATS.includes(f.definitionId ?? "")
  );

  function handleFormatChange(newFormatId: string) {
    const fmt = formats.find((f) => f.id === newFormatId);
    setFormatId(newFormatId);
    setFormatConfig(fmt ? buildDefaultConfig(fmt) : {});
  }

  function updateConfig(key: string, value: unknown) {
    setFormatConfig((prev) => ({ ...prev, [key]: value }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isIrishGolf) {
      if (
        !formatConfig.segment1FormatId ||
        !formatConfig.segment2FormatId ||
        !formatConfig.segment3FormatId
      ) {
        setError(
          "Irish Golf / 6-6-6 requires a format selected for all three segments."
        );
        setLoading(false);
        return;
      }
    }

    try {
      const round = await createRound({
        name: name.trim() || undefined,
        date: new Date(date),
        courseId,
        formatId,
        buyInPerPlayer: Number(buyIn),
        visibility,
        blindRevealMode: visibility === "BLIND" ? blindRevealMode : undefined,
        formatConfig:
          Object.keys(formatConfig).length > 0 ? formatConfig : undefined,
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
            label="Round Name (optional)"
            type="text"
            placeholder="e.g., Week 1, Championship, etc."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

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

          {/* Format selector */}
          <Select
            label="Format"
            value={formatId}
            onChange={(e) => handleFormatChange(e.target.value)}
            options={formats.map((f) => ({ value: f.id, label: f.name }))}
            required
          />

          {/* Format description */}
          {selectedFormat?.gameDescription && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
              {selectedFormat.gameDescription}
            </div>
          )}

          {selectedFormat?.requiresDriveTracking && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-sm text-emerald-900 space-y-1">
              <p className="font-semibold">Drive Tracking Required</p>
              <p>
                This format requires the scorer to mark whose drive was used on
                each hole.
              </p>
              <p>
                Drive minimums:{" "}
                {driveMinimumsEnabled
                  ? `ON${
                      requiredDrivesPerPlayer !== null
                        ? `, ${requiredDrivesPerPlayer} per player`
                        : ""
                    }${
                      excludePar3sFromDriveMinimums ? ", par 3s excluded" : ""
                    }`
                  : "OFF"}
              </p>
            </div>
          )}

          {/* Dynamic configOptions */}
          {selectedFormat?.configOptions &&
            selectedFormat.configOptions.length > 0 && (
              <div className="space-y-3 border border-gray-200 rounded-md p-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Format Options
                </p>
                {selectedFormat.configOptions.map((opt) => {
                  // Hide segment dropdowns — handled separately below
                  if (
                    isIrishGolf &&
                    ["segment1FormatId", "segment2FormatId", "segment3FormatId"].includes(
                      opt.key
                    )
                  )
                    return null;

                  if (
                    [
                      "enableDriveMinimums",
                      "requiredDrivesPerPlayer",
                      "excludePar3sFromDriveMinimums",
                    ].includes(
                      opt.key
                    )
                  ) {
                    return null;
                  }

                  if (opt.type === "boolean") {
                    return (
                      <label key={opt.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!formatConfig[opt.key]}
                          onChange={(e) => updateConfig(opt.key, e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  }

                  if (opt.type === "number") {
                    return (
                      <Input
                        key={opt.key}
                        label={opt.label}
                        type="number"
                        min="1"
                        value={String(formatConfig[opt.key] ?? opt.defaultValue ?? "")}
                        onChange={(e) =>
                          updateConfig(opt.key, Number(e.target.value))
                        }
                      />
                    );
                  }

                  if (opt.type === "select" && opt.options) {
                    return (
                      <Select
                        key={opt.key}
                        label={opt.label}
                        value={String(formatConfig[opt.key] ?? opt.defaultValue ?? "")}
                        onChange={(e) => updateConfig(opt.key, e.target.value)}
                        options={opt.options.map((o) => ({
                          value: o.value,
                          label: o.label,
                        }))}
                      />
                    );
                  }

                  return null;
                })}
              </div>
            )}

          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Drive Minimums
            </p>
            <label className="flex items-center gap-2 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={driveMinimumsEnabled}
                onChange={(e) => updateConfig("enableDriveMinimums", e.target.checked)}
                className="h-4 w-4"
              />
              <span>Require a minimum number of drives from each player</span>
            </label>
            <p className="text-sm text-amber-900">
              This can be used with any format. If enabled, scoring will require
              you to mark whose drive was used on each hole.
            </p>
            {driveMinimumsEnabled && (
              <div className="space-y-3">
                <Input
                  label="Minimum Drives Per Player"
                  type="number"
                  min="1"
                  value={String(requiredDrivesPerPlayer ?? 4)}
                  onChange={(e) =>
                    updateConfig("requiredDrivesPerPlayer", Number(e.target.value))
                  }
                />
                <label className="flex items-center gap-2 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    checked={excludePar3sFromDriveMinimums}
                    onChange={(e) =>
                      updateConfig(
                        "excludePar3sFromDriveMinimums",
                        e.target.checked
                      )
                    }
                    className="h-4 w-4"
                  />
                  <span>Do not count par 3 holes toward drive minimums</span>
                </label>
              </div>
            )}
          </div>

          {/* Irish Golf segment selectors */}
          {isIrishGolf && (
            <div className="space-y-3 border border-amber-200 rounded-md p-3 bg-amber-50">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                6-6-6 Segment Formats
              </p>
              {(
                [
                  { key: "segment1FormatId", label: "Holes 1–6 Format" },
                  { key: "segment2FormatId", label: "Holes 7–12 Format" },
                  { key: "segment3FormatId", label: "Holes 13–18 Format" },
                ] as const
              ).map(({ key, label }) => (
                <Select
                  key={key}
                  label={label}
                  value={String(formatConfig[key] ?? "")}
                  onChange={(e) => updateConfig(key, e.target.value)}
                  options={[
                    { value: "", label: "Select a format…" },
                    ...eligibleSegmentFormats.map((f) => ({
                      value: f.definitionId ?? f.id,
                      label: f.name,
                    })),
                  ]}
                  required
                />
              ))}
            </div>
          )}

          {/* Vegas notice */}
          {isVegas && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-md p-3 text-sm text-yellow-800">
              ⚠️ Vegas requires exactly 2 players per team. Team size will be set
              automatically during player selection.
            </div>
          )}

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
