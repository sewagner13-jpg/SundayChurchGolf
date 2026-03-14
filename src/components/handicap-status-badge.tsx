import { isHandicapStale } from "@/lib/ghin";

interface HandicapStatusBadgeProps {
  lastVerifiedDate?: Date | string | null;
}

export function HandicapStatusBadge({
  lastVerifiedDate,
}: HandicapStatusBadgeProps) {
  const stale = isHandicapStale(lastVerifiedDate);

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        stale
          ? "bg-amber-100 text-amber-800"
          : "bg-green-100 text-green-800"
      }`}
    >
      {stale ? "Needs Refresh" : "Current"}
    </span>
  );
}
