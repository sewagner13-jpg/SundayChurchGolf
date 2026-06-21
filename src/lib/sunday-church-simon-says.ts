export const SUNDAY_CHURCH_SIMON_SAYS_FORMAT_ID = "sunday_church_simon_says";

export interface SundayChurchSimonSaysConfig extends Record<string, unknown> {
  simonSaysInstructions?: Record<string, string>;
}

const HOLE_NUMBERS = Array.from({ length: 18 }, (_, index) => index + 1);

function isInstructionMap(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function createDefaultSundayChurchSimonSaysConfig(): SundayChurchSimonSaysConfig {
  return {
    simonSaysInstructions: Object.fromEntries(
      HOLE_NUMBERS.map((holeNumber) => [String(holeNumber), ""])
    ),
  };
}

export function getSundayChurchSimonSaysInstruction(
  formatConfig: Record<string, unknown> | null | undefined,
  holeNumber: number
) {
  const instructions = isInstructionMap(formatConfig?.simonSaysInstructions)
    ? formatConfig.simonSaysInstructions
    : {};
  const instruction = instructions[String(holeNumber)];
  return typeof instruction === "string" ? instruction.trim() : "";
}

export function validateSundayChurchSimonSaysConfig(
  formatConfig: Record<string, unknown> | null | undefined
): string[] {
  const errors: string[] = [];
  const instructions = formatConfig?.simonSaysInstructions;

  if (!isInstructionMap(instructions)) {
    return ["Enter Simon Says instructions for every hole."];
  }

  for (const holeNumber of HOLE_NUMBERS) {
    const instruction = instructions[String(holeNumber)];
    if (typeof instruction !== "string" || instruction.trim().length === 0) {
      errors.push(`Hole ${holeNumber} is missing Simon Says instructions.`);
    }
  }

  return errors;
}
