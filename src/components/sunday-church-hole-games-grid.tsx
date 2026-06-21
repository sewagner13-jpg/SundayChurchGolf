"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/button";
import { isAllBirdiesCountEligibleFormat } from "@/lib/all-birdies-count";
import {
  SUNDAY_CHURCH_HOLE_GAME_ELIGIBLE_FORMATS,
  createDefaultSundayChurchHoleGamesConfig,
  getSundayChurchHoleGameAssignment,
  type SundayChurchHoleGameAssignment,
} from "@/lib/sunday-church-hole-games";

interface HoleInfo {
  holeNumber: number;
  par?: number;
}

interface FormatOption {
  id: string;
  name: string;
  definitionId?: string | null;
}

interface Props {
  holes?: HoleInfo[];
  formats: FormatOption[];
  formatConfig: Record<string, unknown>;
  onChange: (nextConfig: Record<string, unknown>) => void;
}

const DEFAULT_HOLES: HoleInfo[] = Array.from({ length: 18 }, (_, index) => ({
  holeNumber: index + 1,
}));
const ELIGIBLE_FORMAT_IDS = SUNDAY_CHURCH_HOLE_GAME_ELIGIBLE_FORMATS as readonly string[];

function getFormatValue(format: FormatOption) {
  return format.definitionId ?? format.id;
}

function getNormalizedHoleGames(formatConfig: Record<string, unknown>) {
  return Object.fromEntries(
    Array.from({ length: 18 }, (_, index) => {
      const holeNumber = index + 1;
      return [
        String(holeNumber),
        getSundayChurchHoleGameAssignment(formatConfig, holeNumber),
      ];
    })
  ) as Record<string, SundayChurchHoleGameAssignment>;
}

export function SundayChurchHoleGamesGrid({
  holes,
  formats,
  formatConfig,
  onChange,
}: Props) {
  const eligibleFormats = useMemo(
    () =>
      formats.filter((format) =>
        ELIGIBLE_FORMAT_IDS.includes(getFormatValue(format))
      ),
    [formats]
  );
  const [fillFormatId, setFillFormatId] = useState(
    getFormatValue(eligibleFormats[0] ?? { id: "default-sunday-church", name: "" })
  );
  const visibleHoles = holes && holes.length > 0 ? holes : DEFAULT_HOLES;
  const holeGames = getNormalizedHoleGames(formatConfig);

  const updateHoleGames = (
    nextHoleGames: Record<string, SundayChurchHoleGameAssignment>
  ) => {
    onChange({
      ...formatConfig,
      holeGames: nextHoleGames,
    });
  };

  const updateHole = (
    holeNumber: number,
    assignment: SundayChurchHoleGameAssignment
  ) => {
    updateHoleGames({
      ...holeGames,
      [String(holeNumber)]: assignment,
    });
  };

  const fillAll = () => {
    if (!fillFormatId) return;
    const allBirdiesCount = false;
    updateHoleGames(
      Object.fromEntries(
        DEFAULT_HOLES.map((hole) => [
          String(hole.holeNumber),
          { formatId: fillFormatId, allBirdiesCount },
        ])
      ) as Record<string, SundayChurchHoleGameAssignment>
    );
  };

  const copyFrontToBack = () => {
    const next = { ...holeGames };
    for (let holeNumber = 1; holeNumber <= 9; holeNumber++) {
      next[String(holeNumber + 9)] = { ...holeGames[String(holeNumber)] };
    }
    updateHoleGames(next);
  };

  return (
    <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Sunday Church Hole Games
          </p>
          <p className="text-sm text-amber-900">
            Every hole remains a skin; this grid controls the gameplay used to
            decide each hole.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-amber-900">
            <span className="mb-1 block text-xs font-medium">Fill all</span>
            <select
              value={fillFormatId}
              onChange={(event) => setFillFormatId(event.target.value)}
              className="rounded border border-amber-300 bg-white px-3 py-2"
            >
              {eligibleFormats.map((format) => (
                <option key={getFormatValue(format)} value={getFormatValue(format)}>
                  {format.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="secondary" onClick={fillAll}>
            Apply
          </Button>
          <Button type="button" variant="secondary" onClick={copyFrontToBack}>
            Copy Front 9
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onChange({
                ...formatConfig,
                ...createDefaultSundayChurchHoleGamesConfig(),
              })
            }
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {visibleHoles.map((hole) => {
          const key = String(hole.holeNumber);
          const assignment = holeGames[key];
          const selectedFormatId = assignment.formatId;
          const showAllBirdies = isAllBirdiesCountEligibleFormat(selectedFormatId);

          return (
            <div
              key={hole.holeNumber}
              className="grid gap-2 rounded border border-amber-100 bg-white/80 p-2 sm:grid-cols-[72px_1fr_auto]"
            >
              <div className="text-sm font-semibold text-gray-700">
                Hole {hole.holeNumber}
                {hole.par ? (
                  <span className="block text-xs font-normal text-gray-500">
                    Par {hole.par}
                  </span>
                ) : null}
              </div>
              <select
                value={selectedFormatId}
                onChange={(event) => {
                  const nextFormatId = event.target
                    .value as SundayChurchHoleGameAssignment["formatId"];
                  updateHole(hole.holeNumber, {
                    formatId: nextFormatId,
                    allBirdiesCount: false,
                  });
                }}
                className="min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {eligibleFormats.map((format) => (
                  <option key={getFormatValue(format)} value={getFormatValue(format)}>
                    {format.name}
                  </option>
                ))}
              </select>
              {showAllBirdies ? (
                <label className="flex items-center gap-2 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    checked={assignment.allBirdiesCount === true}
                    onChange={(event) =>
                      updateHole(hole.holeNumber, {
                        ...assignment,
                        allBirdiesCount: event.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  <span>ABC</span>
                </label>
              ) : (
                <span className="hidden sm:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
