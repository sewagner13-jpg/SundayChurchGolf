"use client";

import { Button } from "@/components/button";
import {
  createDefaultSundayChurchSimonSaysConfig,
  getSundayChurchSimonSaysInstructionDraftValue,
} from "@/lib/sunday-church-simon-says";

interface HoleInfo {
  holeNumber: number;
  par?: number;
}

interface Props {
  holes?: HoleInfo[];
  formatConfig: Record<string, unknown>;
  onChange: (nextConfig: Record<string, unknown>) => void;
}

const DEFAULT_HOLES: HoleInfo[] = Array.from({ length: 18 }, (_, index) => ({
  holeNumber: index + 1,
}));

function buildInstructionMap(formatConfig: Record<string, unknown>) {
  return Object.fromEntries(
    DEFAULT_HOLES.map((hole) => [
      String(hole.holeNumber),
      getSundayChurchSimonSaysInstructionDraftValue(
        formatConfig,
        hole.holeNumber
      ),
    ])
  );
}

export function SundayChurchSimonSaysGrid({
  holes,
  formatConfig,
  onChange,
}: Props) {
  const visibleHoles = holes && holes.length > 0 ? holes : DEFAULT_HOLES;
  const instructions = buildInstructionMap(formatConfig);

  const updateInstructions = (nextInstructions: Record<string, string>) => {
    onChange({
      ...formatConfig,
      simonSaysInstructions: nextInstructions,
    });
  };

  const updateHoleInstruction = (holeNumber: number, instruction: string) => {
    updateInstructions({
      ...instructions,
      [String(holeNumber)]: instruction,
    });
  };

  return (
    <div className="space-y-3 rounded border border-sky-200 bg-sky-50 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            Sunday Church Simon Says
          </p>
          <p className="text-sm text-sky-900">
            Enter the instruction each team should see before playing that hole.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            onChange({
              ...formatConfig,
              ...createDefaultSundayChurchSimonSaysConfig(),
            })
          }
        >
          Clear All
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {visibleHoles.map((hole) => (
          <label
            key={hole.holeNumber}
            className="block rounded border border-sky-100 bg-white/85 p-3 text-sm"
          >
            <span className="mb-2 flex items-center justify-between font-semibold text-gray-800">
              <span>Hole {hole.holeNumber}</span>
              {hole.par ? (
                <span className="text-xs font-normal text-gray-500">
                  Par {hole.par}
                </span>
              ) : null}
            </span>
            <textarea
              value={instructions[String(hole.holeNumber)] ?? ""}
              onChange={(event) =>
                updateHoleInstruction(hole.holeNumber, event.target.value)
              }
              rows={3}
              placeholder={`Instruction for hole ${hole.holeNumber}`}
              className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
