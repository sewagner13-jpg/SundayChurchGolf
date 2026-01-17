# Sunday Church Golf - Application Flow

## User Journey Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        DASHBOARD                                 │
│  - Season selector (← 2024 → 2025)                              │
│  - Quick actions: [New Round] [Players] [Courses] [Stats]       │
│  - Recent rounds list                                            │
└─────────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┬──────────────┐
                │              │              │              │
                ▼              ▼              ▼              ▼
         ┌──────────┐   ┌──────────┐  ┌──────────┐   ┌──────────┐
         │ PLAYERS  │   │ COURSES  │  │ FORMATS  │   │  STATS   │
         │  (CRUD)  │   │  (CRUD)  │  │  (CRUD)  │   │LEADERBOARD│
         └──────────┘   └──────────┘  └──────────┘   └──────────┘
                │
                │
                ▼
         ┌──────────────────────────────────────┐
         │      NEW ROUND WIZARD                │
         ├──────────────────────────────────────┤
         │ Step 1: Round Details                │
         │  - Date, course, format              │
         │  - Buy-in, team size                 │
         ├──────────────────────────────────────┤
         │ Step 2: Player Selection             │
         │  - Multi-select active players       │
         ├──────────────────────────────────────┤
         │ Step 3: Team Generation              │
         │  - Random teams, reroll, manual swap │
         ├──────────────────────────────────────┤
         │ Step 4: Confirmation                 │
         │  - Review & create                   │
         └──────────────────────────────────────┘
                         │
                         ▼
         ┌──────────────────────────────────────┐
         │      LIVE SCORING (Mobile UI)        │
         ├──────────────────────────────────────┤
         │ [Header: Hole 1 • Par 4 • HCP 15]    │
         │ [Carryover: 1 skin • $13.50]         │
         ├──────────────────────────────────────┤
         │ Team 1 (Player A, B, C, D)           │
         │   Score: [  2  ]                     │
         │   [+1] [+2] [X] [Clear]              │
         ├──────────────────────────────────────┤
         │ Team 2 (Player E, F, G, H)           │
         │   Score: [  3  ]                     │
         │   [+1] [+2] [X] [Clear]              │
         ├──────────────────────────────────────┤
         │ Result: "Team 2 wins!"               │
         ├──────────────────────────────────────┤
         │ [← Prev]  [7/18]  [Next →]           │
         │ [Lock Round (on hole 18)]            │
         └──────────────────────────────────────┘
                         │
                         ▼
         ┌──────────────────────────────────────┐
         │      ROUND SUMMARY                   │
         ├──────────────────────────────────────┤
         │ Round Info: 8 players, $240 pot      │
         ├──────────────────────────────────────┤
         │ PLAYER WINNINGS                      │
         │ 🏆 Player A    +$45.00               │
         │ 🥈 Player B    +$30.00               │
         │ 🥉 Player C    +$15.00               │
         │    Player D     $0.00                │
         │    Player E    -$10.00               │
         │    ...                               │
         ├──────────────────────────────────────┤
         │ HOLE-BY-HOLE                         │
         │ H1  Par 4  [2] [3] Winner: T2  $13   │
         │ H2  Par 4  [1] [1] Tie        -      │
         │ H3  Par 4  [X] [2] Winner: T2  $27   │
         │ ...                                  │
         └──────────────────────────────────────┘
                         │
                         ▼
         ┌──────────────────────────────────────┐
         │      SEASON STATS                    │
         ├──────────────────────────────────────┤
         │ 2024 Season Leaderboard              │
         │                                      │
         │ Rank  Player      Net Winnings       │
         │  🏆1  Player A    +$120.00           │
         │  🥈2  Player B    +$85.00            │
         │  🥉3  Player C    +$45.00            │
         │   4  Player D     -$15.00            │
         │   ...                                │
         └──────────────────────────────────────┘
```

## Data Flow

```
┌─────────────┐
│   Browser   │
│  (React UI) │
└──────┬──────┘
       │ HTTP Request
       ▼
┌─────────────────┐
│   Next.js API   │
│    Routes       │
│  /api/players   │
│  /api/rounds    │
│  /api/courses   │
└────────┬────────┘
         │ Prisma ORM
         ▼
┌─────────────────┐
│   PostgreSQL    │
│    Database     │
│   (Neon/Local)  │
└─────────────────┘
```

## Scoring Logic Flow

```
User enters scores → Auto-save to DB → LocalStorage cache
                                              │
                                              ▼
                     ┌────────────────────────────────┐
                     │ On Lock Round:                 │
                     │ 1. Fetch all hole scores       │
                     │ 2. computeSkins()               │
                     │    - Process holes 1-18        │
                     │    - Track carryover           │
                     │    - Determine winners         │
                     │ 3. If tied after 18:           │
                     │    resolveTiebreaker()          │
                     │    - Sort by handicap rank     │
                     │    - Find first winner         │
                     │ 4. computePayouts()             │
                     │    - Sum team winnings         │
                     │    - Divide by players         │
                     │ 5. saveRoundResults()           │
                     │    - Update HoleScore records  │
                     │ 6. Redirect to summary         │
                     └────────────────────────────────┘
```

## Authentication Flow

```
┌─────────────────┐
│  User enters    │
│  email address  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ NextAuth sends  │
│  magic link     │
│  via email      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ User clicks     │
│ link in email   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ NextAuth        │
│ verifies token  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Session created │
│ User logged in  │
└─────────────────┘
```

## Team Generation Algorithm

```
Input: [Player1, Player2, ..., Player8], teamSize=4

┌────────────────────────────────────┐
│ 1. Fisher-Yates Shuffle            │
│    Randomize player order          │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 2. Split into teams                │
│    Team 1: players[0:4]            │
│    Team 2: players[4:8]            │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 3. Return teams                    │
│    [                               │
│      {name: "Team 1", players: []},│
│      {name: "Team 2", players: []} │
│    ]                               │
└────────────────────────────────────┘
```

## Skins Calculation Example

```
Pot: $240 (8 players × $30)
Skin Value: $240 / 18 = $13.33

Hole 1: Team1=2, Team2=1 → Team 1 wins 1 skin ($13.33)
Hole 2: Team1=1, Team2=1 → Tie, carry 1 skin
Hole 3: Team1=0, Team2=2 → Team 2 wins 2 skins ($26.67)
Hole 4: Team1=X, Team2=X → Tie, carry 1 skin
Hole 5: Team1=1, Team2=X → Team 1 wins 2 skins ($26.67)
...
Hole 18: Results calculated

Tiebreaker (if needed):
→ Check Hole 2 (HCP 1)
→ Check Hole 15 (HCP 2)
→ Continue until winner found
```

## Mobile Scoring Interaction

```
┌─────────────────────────────────────┐
│ User taps "+1" on Team 1            │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ useState updates local score        │
│ Display changes: X → 1              │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ useEffect triggers save             │
│ localStorage.setItem()              │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ API call: PATCH /api/rounds/ID/scores│
│ { teamId, holeId, underParStrokes }  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Database updated                    │
│ HoleScore.underParStrokes = 1       │
└─────────────────────────────────────┘
```

## Component Hierarchy

```
App
├── Layout
│   ├── Head (metadata)
│   └── Body
│       ├── Dashboard (/)
│       │   ├── Header
│       │   ├── SeasonSelector
│       │   ├── QuickActions
│       │   └── RoundsList
│       ├── Players (/players)
│       │   ├── Header
│       │   ├── AddPlayerForm (conditional)
│       │   └── PlayersList
│       ├── Courses (/courses)
│       │   ├── Header
│       │   ├── CoursesList
│       │   └── CourseDetails
│       ├── Formats (/formats)
│       │   ├── Header
│       │   ├── AddFormatForm (conditional)
│       │   └── FormatsList
│       ├── NewRound (/rounds/new)
│       │   ├── Header
│       │   └── Wizard
│       │       ├── Step1: RoundDetails
│       │       ├── Step2: PlayerSelection
│       │       ├── Step3: TeamReview
│       │       └── Step4: Confirmation
│       ├── LiveScoring (/rounds/[id]/score)
│       │   ├── StickyHeader
│       │   │   ├── HoleInfo
│       │   │   ├── CarryoverDisplay
│       │   │   └── HolePicker (modal)
│       │   ├── TeamCards (map)
│       │   │   ├── TeamInfo
│       │   │   ├── ScoreDisplay
│       │   │   └── ActionButtons
│       │   ├── WinnerMessage
│       │   └── NavigationFooter
│       ├── RoundSummary (/rounds/[id]/summary)
│       │   ├── Header
│       │   ├── RoundInfo
│       │   ├── PlayerWinnings
│       │   └── HoleByHoleTable
│       └── Stats (/stats)
│           ├── Header
│           └── Leaderboard
└── API Routes
    ├── /api/auth/[...nextauth]
    ├── /api/players
    ├── /api/courses
    ├── /api/formats
    ├── /api/rounds
    ├── /api/teams/generate
    └── /api/seasons
```

## State Management

```
Local Component State (useState)
├── Form inputs
├── Modal visibility
├── Loading states
└── UI toggles

Server State (API fetch)
├── Players list
├── Courses list
├── Formats list
├── Rounds list
├── Round details
└── Hole scores

Persistent State (localStorage)
└── Live scoring cache
    ├── Key: round-{roundId}-scores
    └── Value: Map<teamId-holeId, score>

Session State (NextAuth)
├── User authentication
└── Session token
```

## Error Handling

```
┌────────────────┐
│ API Request    │
└────────┬───────┘
         │
         ▼
    ┌────────┐
    │ try {} │
    └───┬────┘
        │
        ├─ Success → Return JSON
        │
        └─ Error ──┐
                   ▼
            ┌──────────────┐
            │ catch (e) {} │
            └──────┬───────┘
                   │
                   ├─ console.error()
                   ├─ Return 500 status
                   └─ Client shows error message
```

## Deployment Flow

```
┌─────────────┐
│ Local Dev   │
│ npm run dev │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Git commit  │
│ Git push    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ GitHub      │
│ Repository  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Vercel      │
│ Auto-deploy │
└──────┬──────┘
       │
       ├─ Build Next.js app
       ├─ Connect to PostgreSQL (Neon)
       ├─ Set environment variables
       └─ Deploy to CDN
       │
       ▼
┌─────────────┐
│ Production  │
│ URL live    │
└─────────────┘
```

---

This application flow demonstrates the complete user journey from dashboard to scoring to results, with clear separation of concerns and a mobile-first approach throughout.
