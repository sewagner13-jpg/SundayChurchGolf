/**
 * Format Definitions — source of truth for all golf format metadata.
 * Format IDs must match the corresponding DB Format records.
 */

export type FormatCategory = 'skins' | 'stroke' | 'points' | 'match'

export interface FormatConfigOption {
  key: string
  label: string
  type: 'boolean' | 'number' | 'select'
  options?: Array<{ value: string; label: string }>
  defaultValue?: string | number | boolean
  description?: string
}

export interface FormatDefinition {
  id: string
  name: string
  shortLabel: string
  gameDescription: string
  formatCategory: FormatCategory
  defaultTeamSize: number
  supportedTeamSizes: number[]
  configOptions: FormatConfigOption[]
  /** True if individual gross scores per player are required (vs team-level only) */
  requiresIndividualScores: boolean
  /** True if one player per hole is designated (Lone Ranger, Money Ball, Wolf, Rotating Drives) */
  requiresDesignatedPlayer: boolean
  /** True if drive selection must be tracked per hole (scramble/shamble variants) */
  requiresDriveTracking: boolean
}

export const FORMAT_DEFINITIONS: FormatDefinition[] = [
  {
    id: 'default-sunday-church',
    name: 'Sunday Church Scramble Skins',
    shortLabel: 'Skins',
    gameDescription:
      'Scramble tee-to-green, all players putt out. Score is the total number of under-par makes (birdies and eagles) for the team on each hole. Teams compete for skins on each hole, with ties carrying over to the next hole.',
    formatCategory: 'skins',
    defaultTeamSize: 4,
    supportedTeamSizes: [2, 3, 4],
    configOptions: [],
    requiresIndividualScores: false,
    requiresDesignatedPlayer: false,
    requiresDriveTracking: false,
  },
  {
    id: 'scramble_rotating_drives',
    name: 'Scramble with Rotating Drives',
    shortLabel: 'RotDrive',
    gameDescription:
      "A team scramble where each hole requires a different player's drive to be used. The designated player must have their tee shot selected before the team begins the scramble. After the drive is chosen, the team plays the hole as a normal scramble from that position. This format ensures every player contributes drives during the round.",
    formatCategory: 'stroke',
    defaultTeamSize: 4,
    supportedTeamSizes: [2, 3, 4],
    configOptions: [
      {
        key: 'enableDriveMinimums',
        label: 'Enforce Drive Minimums',
        type: 'boolean',
        defaultValue: false,
        description: 'Require each player to contribute a minimum number of drives.',
      },
      {
        key: 'requiredDrivesPerPlayer',
        label: 'Minimum Drives Per Player',
        type: 'number',
        defaultValue: 4,
        description: 'Minimum drives each player must contribute.',
      },
    ],
    requiresIndividualScores: false,
    requiresDesignatedPlayer: true,
    requiresDriveTracking: true,
  },
  {
    id: 'one_best_ball_of_four',
    name: '1 Best Ball of 4',
    shortLabel: '1BB',
    gameDescription:
      'Each player plays their own ball for the entire hole. At the end of the hole, only the single lowest individual score from the team counts as the team score. This is the simplest best-ball team format and heavily rewards one great score each hole.',
    formatCategory: 'stroke',
    defaultTeamSize: 4,
    supportedTeamSizes: [4],
    configOptions: [],
    requiresIndividualScores: true,
    requiresDesignatedPlayer: false,
    requiresDriveTracking: false,
  },
  {
    id: 'two_best_balls_of_four',
    name: '2 Best Balls of 4',
    shortLabel: '2BB',
    gameDescription:
      'Each player plays their own ball for the entire hole. At the end of the hole, the two lowest individual scores from the team are combined to create the team score. This format rewards consistent scoring from multiple players while still allowing a bad hole from one player to be dropped.',
    formatCategory: 'stroke',
    defaultTeamSize: 4,
    supportedTeamSizes: [4],
    configOptions: [],
    requiresIndividualScores: true,
    requiresDesignatedPlayer: false,
    requiresDriveTracking: false,
  },
  {
    id: 'three_best_balls_of_four',
    name: '3 Best Balls of 4',
    shortLabel: '3BB',
    gameDescription:
      'Each player plays their own ball on every hole. The three lowest scores from the team count toward the team score. Because more scores count, this format tends to favor steady team play and works well when there is a wider range of handicaps.',
    formatCategory: 'stroke',
    defaultTeamSize: 4,
    supportedTeamSizes: [4],
    configOptions: [],
    requiresIndividualScores: true,
    requiresDesignatedPlayer: false,
    requiresDriveTracking: false,
  },
  {
    id: 'lone_ranger',
    name: 'Lone Ranger / Yellow Ball',
    shortLabel: 'Ranger',
    gameDescription:
      "One player on the team is designated as the Lone Ranger for each hole. That player's score must count toward the team score. In addition, the lowest score from the remaining players is added to create the team score. The Lone Ranger rotates each hole so every player must contribute.",
    formatCategory: 'stroke',
    defaultTeamSize: 4,
    supportedTeamSizes: [3, 4],
    configOptions: [],
    requiresIndividualScores: true,
    requiresDesignatedPlayer: true,
    requiresDriveTracking: false,
  },
  {
    id: 'step_aside_scramble',
    name: 'Step Aside Scramble',
    shortLabel: 'StepScr',
    gameDescription:
      "A standard team scramble with a participation rule. When a player's shot is selected by the team, that player must sit out the next shot. This continues until the ball is holed. The rule forces all players to contribute shots and prevents one player from dominating the scramble.",
    formatCategory: 'stroke',
    defaultTeamSize: 4,
    supportedTeamSizes: [4],
    configOptions: [],
    requiresIndividualScores: false,
    requiresDesignatedPlayer: false,
    requiresDriveTracking: false,
  },
  {
    id: 'money_ball',
    name: 'Money Ball',
    shortLabel: 'MoneyBall',
    gameDescription:
      "Each hole has a designated Money Ball player who must play a special ball for that hole. The team score is calculated using the Money Ball player's score plus the best ball from the remaining players. If the Money Ball is lost during the hole, the player still finishes the hole but a 4-stroke penalty is added only to the separate Money Ball score. The game produces two results: the normal team score and a separate Money Ball total that includes penalties.",
    formatCategory: 'stroke',
    defaultTeamSize: 4,
    supportedTeamSizes: [3, 4],
    configOptions: [
      {
        key: 'moneyBallPenaltyStrokes',
        label: 'Penalty Strokes for Lost Money Ball',
        type: 'number',
        defaultValue: 4,
        description:
          'Strokes added to the Money Ball running score if the ball is lost. Does NOT affect the team competition score.',
      },
    ],
    requiresIndividualScores: true,
    requiresDesignatedPlayer: true,
    requiresDriveTracking: false,
  },
  {
    id: 'cha_cha_cha',
    name: 'Cha Cha Cha',
    shortLabel: 'ChaCha',
    gameDescription:
      'A rotating team scoring format that changes how many scores count on each hole. Hole 1 counts the best single score, Hole 2 counts the best two scores, and Hole 3 counts the best three scores. The pattern then repeats for the rest of the round. This format creates variety and rewards different team strengths.',
    formatCategory: 'stroke',
    defaultTeamSize: 4,
    supportedTeamSizes: [3, 4],
    configOptions: [],
    requiresIndividualScores: true,
    requiresDesignatedPlayer: false,
    requiresDriveTracking: false,
  },
  {
    id: 'wolf_team',
    name: 'Wolf Team',
    shortLabel: 'Wolf',
    gameDescription:
      'One player is designated as the Wolf on each hole and rotates throughout the round. After everyone hits their drives, the Wolf can choose a partner for that hole or play alone against the other players. Teams are then formed and the hole is played to determine the winner. The format creates strategy and changing alliances during the round.',
    formatCategory: 'match',
    defaultTeamSize: 4,
    supportedTeamSizes: [4],
    configOptions: [],
    requiresIndividualScores: true,
    requiresDesignatedPlayer: true,
    requiresDriveTracking: false,
  },
  {
    id: 'shamble_team',
    name: 'Shamble Team',
    shortLabel: 'Shamble',
    gameDescription:
      'All players hit drives and the team selects the best drive. From that position each player plays their own ball for the rest of the hole. The team score is determined by counting a specified number of the best individual scores from that point.',
    formatCategory: 'stroke',
    defaultTeamSize: 4,
    supportedTeamSizes: [2, 3, 4],
    configOptions: [
      {
        key: 'shambleCountMode',
        label: 'How Many Scores Count',
        type: 'select',
        options: [
          { value: 'count_best_1', label: 'Best 1 Score' },
          { value: 'count_best_2', label: 'Best 2 Scores' },
          { value: 'count_best_3', label: 'Best 3 Scores' },
          { value: 'count_all', label: 'All Scores' },
        ],
        defaultValue: 'count_best_2',
        description: 'How many of the best individual scores count toward the team score.',
      },
      {
        key: 'enableDriveMinimums',
        label: 'Enforce Drive Minimums',
        type: 'boolean',
        defaultValue: false,
        description: 'Require each player to contribute a minimum number of drives.',
      },
      {
        key: 'requiredDrivesPerPlayer',
        label: 'Minimum Drives Per Player',
        type: 'number',
        defaultValue: 3,
        description: 'Minimum drives each player must contribute.',
      },
    ],
    requiresIndividualScores: true,
    requiresDesignatedPlayer: false,
    requiresDriveTracking: true,
  },
  {
    id: 'chicago_points_team',
    name: 'Chicago Points Team',
    shortLabel: 'Chicago',
    gameDescription:
      "Players earn points on each hole based on their score relative to par. A double eagle earns 8 points, eagle 4 points, birdie 2 points, and par 1 point. Bogey or worse earns 0 points. The team's total points determine the winner rather than total strokes. This format rewards aggressive scoring opportunities.",
    formatCategory: 'points',
    defaultTeamSize: 4,
    supportedTeamSizes: [2, 3, 4],
    configOptions: [],
    requiresIndividualScores: true,
    requiresDesignatedPlayer: false,
    requiresDriveTracking: false,
  },
  {
    id: 'train_game',
    name: 'Train Game',
    shortLabel: 'Train',
    gameDescription:
      'The three lowest scores on the team form a three-digit number called the train. The lowest score becomes the first digit, the second-lowest becomes the second digit, and the third-lowest becomes the final digit. For example, scores of 3, 4, 4, and 5 would produce a train score of 344. These numbers are added across holes to determine the final total.',
    formatCategory: 'stroke',
    defaultTeamSize: 4,
    supportedTeamSizes: [3, 4],
    configOptions: [],
    requiresIndividualScores: true,
    requiresDesignatedPlayer: false,
    requiresDriveTracking: false,
  },
  {
    id: 'irish_golf_6_6_6',
    name: 'Irish Golf / 6-6-6',
    shortLabel: 'Irish',
    gameDescription:
      'The round is divided into three separate six-hole segments. Each segment uses a different format selected before the round begins. For example, the first six holes might be a scramble, the second six could be Train Game, and the final six could be Money Ball. Each segment can have its own winner and payout, with an optional overall winner for the full round.',
    formatCategory: 'stroke',
    defaultTeamSize: 4,
    supportedTeamSizes: [3, 4],
    configOptions: [
      {
        key: 'segment1FormatId',
        label: 'Holes 1-6 Format',
        type: 'select',
        options: [],
        description: 'Format used for holes 1 through 6.',
      },
      {
        key: 'segment2FormatId',
        label: 'Holes 7-12 Format',
        type: 'select',
        options: [],
        description: 'Format used for holes 7 through 12.',
      },
      {
        key: 'segment3FormatId',
        label: 'Holes 13-18 Format',
        type: 'select',
        options: [],
        description: 'Format used for holes 13 through 18.',
      },
    ],
    requiresIndividualScores: true,
    requiresDesignatedPlayer: true,
    requiresDriveTracking: true,
  },
  {
    id: 'vegas',
    name: 'Vegas',
    shortLabel: 'Vegas',
    gameDescription:
      "A two-player team format played against another two-player team. Each team's two scores on a hole are combined to form a two-digit number. The lower score becomes the first digit and the higher score becomes the second digit. The difference between the two team numbers determines the points won or lost on that hole.",
    formatCategory: 'match',
    defaultTeamSize: 2,
    supportedTeamSizes: [2],
    configOptions: [
      {
        key: 'enableBirdieFlip',
        label: 'Enable Birdie Flip',
        type: 'boolean',
        defaultValue: false,
        description:
          "If a team makes a birdie or better on a hole, reverse the opposing team's two-digit score for that hole.",
      },
      {
        key: 'pointsCarryOver',
        label: 'Points Carry Over on Ties',
        type: 'boolean',
        defaultValue: false,
        description: 'If enabled, tied holes carry their points to the next hole.',
      },
    ],
    requiresIndividualScores: true,
    requiresDesignatedPlayer: false,
    requiresDriveTracking: false,
  },
]

/** Lookup map for fast access by format ID */
export const FORMAT_MAP = new Map<string, FormatDefinition>(
  FORMAT_DEFINITIONS.map((f) => [f.id, f])
)

export function getFormatById(id: string): FormatDefinition | undefined {
  return FORMAT_MAP.get(id)
}

/** IDs for formats that can be used as Irish Golf 6-6-6 segments */
export const IRISH_GOLF_ELIGIBLE_SEGMENT_FORMATS = [
  'one_best_ball_of_four',
  'two_best_balls_of_four',
  'three_best_balls_of_four',
  'lone_ranger',
  'money_ball',
  'cha_cha_cha',
  'shamble_team',
  'chicago_points_team',
  'train_game',
  'scramble_rotating_drives',
  'step_aside_scramble',
]
