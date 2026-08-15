import type { FormatDefinition } from "@/lib/format-definitions";

export const SUNDAY_CHURCH_YELLOW_BALL_FORMAT_DEFINITION: FormatDefinition = {
  id: "sunday_church_yellow_ball_skins",
  name: "Sunday Church Yellow Ball Skins",
  shortLabel: "YellowBall",
  gameDescription:
    "Each four-player team adds one rotating yellow-ball player net score to a separate three-player scramble gross score. The unique lowest combined score wins the skin; two tie, all tie and the skin carries.",
  formatCategory: "skins",
  defaultTeamSize: 4,
  supportedTeamSizes: [4],
  configOptions: [
    {
      key: "useYellowBallHandicaps",
      label: "Use Handicaps for Yellow Ball",
      type: "boolean",
      defaultValue: true,
      description:
        "Use relative event handicaps only for the yellow-ball player. The scramble score remains gross.",
    },
  ],
  requiresIndividualScores: false,
  requiresDesignatedPlayer: true,
  requiresDriveTracking: false,
  requiresTeamGrossScore: true,
};
