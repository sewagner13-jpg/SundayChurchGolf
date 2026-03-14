const GHIN_LOOKUP_BASE_URL = "https://www.ghin.com/golfer-lookup/golfer/";

export const GHIN_STALE_THRESHOLD_DAYS = 30;

export function normalizeGHINNumber(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized === "" ? null : normalized;
}

export function isValidGHINNumber(value: string | null | undefined) {
  const normalized = normalizeGHINNumber(value);
  return normalized === null || /^\d+$/.test(normalized);
}

export function resolveGHINUrl({
  ghinProfileUrl,
  ghinNumber,
}: {
  ghinProfileUrl?: string | null;
  ghinNumber?: string | null;
}) {
  const manualUrl = ghinProfileUrl?.trim();
  if (manualUrl) return manualUrl;

  const normalizedNumber = normalizeGHINNumber(ghinNumber);
  if (normalizedNumber) {
    return `${GHIN_LOOKUP_BASE_URL}${normalizedNumber}`;
  }

  return null;
}

export function isHandicapStale(
  lastVerifiedDate: Date | string | null | undefined,
  thresholdDays = GHIN_STALE_THRESHOLD_DAYS
) {
  if (!lastVerifiedDate) return true;

  const verifiedAt = new Date(lastVerifiedDate);
  if (Number.isNaN(verifiedAt.getTime())) return true;

  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return Date.now() - verifiedAt.getTime() > thresholdMs;
}
