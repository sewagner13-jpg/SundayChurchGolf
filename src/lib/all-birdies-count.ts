export const ALL_BIRDIES_COUNT_ELIGIBLE_FORMATS = [
  "captains_choice",
  "step_aside_scramble",
  "scramble_rotating_drives",
  "shamble_team",
] as const;

export type AllBirdiesCountEligibleFormatId =
  (typeof ALL_BIRDIES_COUNT_ELIGIBLE_FORMATS)[number];

type FormatConfig = Record<string, unknown> | null | undefined;

export function isAllBirdiesCountEligibleFormat(
  formatId: string | null | undefined
) {
  return ALL_BIRDIES_COUNT_ELIGIBLE_FORMATS.includes(
    formatId as AllBirdiesCountEligibleFormatId
  );
}

export function getAllBirdiesCountConfigKey(
  roundFormatId: string | null | undefined,
  holeNumber: number
) {
  if (roundFormatId === "irish_golf_6_6_6") {
    if (holeNumber >= 1 && holeNumber <= 6) return "segment1AllBirdiesCount";
    if (holeNumber >= 7 && holeNumber <= 12) return "segment2AllBirdiesCount";
    if (holeNumber >= 13 && holeNumber <= 18) return "segment3AllBirdiesCount";
    return null;
  }

  if (roundFormatId === "nassau") {
    if (holeNumber >= 1 && holeNumber <= 9) return "frontNineAllBirdiesCount";
    if (holeNumber >= 10 && holeNumber <= 18) return "backNineAllBirdiesCount";
    return null;
  }

  return "allBirdiesCount";
}

export function isAllBirdiesCountEnabledForHole(
  roundFormatId: string | null | undefined,
  effectiveFormatId: string | null | undefined,
  holeNumber: number,
  formatConfig: FormatConfig
) {
  if (!isAllBirdiesCountEligibleFormat(effectiveFormatId)) return false;
  const configKey = getAllBirdiesCountConfigKey(roundFormatId, holeNumber);
  return configKey ? formatConfig?.[configKey] === true : false;
}

export function getAllBirdiesCountScore(birdiesMade: number) {
  const storedScore = birdiesMade === 0 ? 0 : -birdiesMade;
  return {
    storedScore,
    displayScore: String(storedScore),
  };
}
