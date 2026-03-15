export function getMinimumScoresRequired(formatId: string, formatConfig?: Record<string, unknown>): number | null {
  switch (formatId) {
    case "one_best_ball_of_four":
      return 1;
    case "two_best_balls_of_four":
      return 2;
    case "three_best_balls_of_four":
      return 3;
    case "irish_golf_6_6_6": {
      if (!formatConfig) return 1; // conservative non-null default so isBestBallFormat is true
      // Return the minimum of the three segment requirements so the card always shows
      const segIds = [
        formatConfig.segment1FormatId,
        formatConfig.segment2FormatId,
        formatConfig.segment3FormatId,
      ] as (string | undefined)[];
      const mins = segIds
        .map((id) => (id ? getMinimumScoresRequired(id) : null))
        .filter((n): n is number => n !== null);
      return mins.length > 0 ? Math.min(...mins) : 1;
    }
    default:
      return null;
  }
}