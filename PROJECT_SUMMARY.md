# Sunday Church Golf - Project Summary

## Overview
A production-ready, mobile-first web application for tracking golf skins games across a calendar year. Built specifically for the "Sunday Church" recurring golf group.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Neon/Supabase)
- **Auth**: NextAuth with Email Magic Links
- **Deployment**: Vercel
- **Testing**: Jest, React Testing Library

## Key Features

### 1. Dashboard
- Season selector (browse by year)
- Quick actions grid (New Round, Players, Courses, Stats)
- Rounds list with date, course, format, completion status
- Direct navigation to scoring or summary

### 2. Player Management
- CRUD operations for players
- Full name, nickname, handicap index
- Active/inactive status toggle
- Pre-seeded with 8 sample players

### 3. Course Management
- Support for multiple courses
- 18-hole scorecards with par and handicap rank
- Pre-seeded with Timberlake Country Club
- View hole-by-hole details

### 4. Format Management
- CRUD for game formats
- Name, description, default team size
- Pre-seeded with "Sunday Church Scramble Skins"

### 5. New Round Wizard (4 Steps)
1. **Round Details**: Date, course, format, buy-in, team size
2. **Player Selection**: Multi-select from active players
3. **Team Generation**: Random teams with reroll and manual swaps
4. **Confirmation**: Review and create round

### 6. Live Scoring (Mobile-Optimized)
- **Header**: Hole info (number, par, handicap), carryover display
- **Hole Picker**: Quick navigation to any hole (1-18)
- **Team Cards**: Each team shows:
  - Team name and player names
  - Large score display (X or number)
  - Action buttons: +1 (birdie), +2 (eagle), X, Clear
- **Live Winner Message**: Shows current hole winner or tie
- **Navigation**: Prev/Next buttons, swipe support (conceptual)
- **Progress**: X/18 indicator
- **Lock Button**: Appears on hole 18 to finalize round
- **Offline Support**: localStorage caching for spotty cell service
- **Auto-save**: Scores saved to database immediately

### 7. Round Summary
- **Round Info**: Date, course, players, teams, pot size
- **Player Winnings**: Sorted leaderboard with net winnings
  - Icons for 1st/2nd/3rd place
  - Shows gross winnings, buy-in, net profit/loss
- **Hole-by-Hole Table**:
  - Each hole with par, team scores, winner, payout
  - Carryover indicator (2x, 3x, etc.)
  - Color-coded winners (green background)

### 8. Season Stats & Leaderboard
- Year-to-year season selector
- Player statistics:
  - Rounds played
  - Total winnings
  - Total buy-ins
  - Net winnings (sorted)
- Medal icons for top 3 players

## Scoring Rules Implementation

### Sunday Church Scramble Skins Format
1. **Input**: Per team, per hole = total under-par strokes made
   - `X` (null) = no under-par scores
   - `1` = 1 birdie
   - `2` = 1 eagle OR 2 birdies
   - `5` = 1 eagle + 3 birdies, etc.

2. **Hole Winner**:
   - Convert X → 0
   - Highest score wins
   - Ties → skin carries to next hole

3. **Carryover**:
   - Each hole = 1 skin
   - Ties accumulate
   - Winner takes all carried skins

4. **Tiebreaker** (if skins remain after hole 18):
   - Compare hardest hole first (handicap rank 1)
   - Then handicap 2, 3, etc.
   - First hole with clear winner resolves
   - Edge case: Still tied after all 18 → split evenly

5. **Payout**:
   - Total pot = players × buy-in
   - Skin value = pot / 18
   - Hole payout = skin value × carried skins
   - Team payout = sum of hole payouts
   - Player winnings = team payout / players on team

## Database Schema

### Core Models
- `Season`: Calendar year container (year, rounds[])
- `Player`: Golfer profiles (fullName, nickname, handicapIndex, isActive)
- `Course`: Golf courses (name, scorecardImage, holes[])
- `Hole`: Course holes (holeNumber, par, handicapRank)
- `Format`: Game formats (name, description, defaultTeamSize)
- `Round`: Game instances (date, course, format, teams[], holeScores[], isLocked)
- `Team`: Team assignments (name, players[])
- `TeamPlayer`: Join table (team, player)
- `HoleScore`: Score tracking (team, hole, underParStrokes, carriedSkins, skinValue)

### Auth Models (NextAuth)
- `User`, `Account`, `Session`, `VerificationToken`

## API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/players` | GET, POST | List/create players |
| `/api/players/[id]` | GET, PATCH, DELETE | Manage individual player |
| `/api/courses` | GET, POST | List/create courses |
| `/api/courses/[id]` | GET, DELETE | Manage individual course |
| `/api/formats` | GET, POST | List/create formats |
| `/api/formats/[id]` | GET, PATCH, DELETE | Manage individual format |
| `/api/rounds` | GET, POST | List/create rounds |
| `/api/rounds/[id]` | GET, PATCH, DELETE | Manage round, lock round |
| `/api/rounds/[id]/scores` | PATCH | Update hole scores |
| `/api/teams/generate` | POST | Generate random teams |
| `/api/seasons` | POST | Create/find season |
| `/api/auth/[...nextauth]` | GET, POST | NextAuth endpoints |

## Business Logic (`lib/game-logic.ts`)

### Core Functions
1. **generateTeams(players, teamSize)**
   - Shuffles players (Fisher-Yates)
   - Splits into teams of specified size
   - Handles uneven final team
   - Returns array of teams with player assignments

2. **computeSkins(roundId)**
   - Fetches round, teams, holes, scores
   - Processes each hole in order:
     - Converts null → 0
     - Finds max score
     - Determines winner(s)
     - Calculates carryover
   - Returns array of hole results with winners and payouts

3. **resolveFinalCarryoverByHandicap(holeResults, carriedSkins, skinValue)**
   - Sorts holes by handicap rank
   - Finds first hole with clear winner
   - Awards remaining skins
   - Edge case: splits if still tied

4. **computePayouts(roundId)**
   - Calls computeSkins()
   - Aggregates payouts per team
   - Returns Map<teamId, payout>

5. **saveRoundResults(roundId)**
   - Computes skins
   - Updates HoleScore records with carriedSkins and skinValue
   - Persists to database

## Testing

### Test Coverage
- Team generation (correct size, uneven teams, all players assigned)
- Scoring logic (X as 0, carryover math, payout calculation)
- Tiebreaker (handicap rank order)
- Edge cases (all ties, all X's)

### Test Files
- `__tests__/game-logic.test.ts`
- Jest configuration with Next.js integration

## Mobile Optimization

### Design Principles
1. **Large Touch Targets**: All buttons ≥44px for easy tapping
2. **Sticky Header**: Hole info always visible
3. **Vertical Stack**: Team cards stack for easy scrolling
4. **Clear Visual Hierarchy**: Large scores, clear actions
5. **Offline Resilience**: localStorage caching
6. **Progressive Enhancement**: Works without JavaScript for basic info

### Responsive Breakpoints
- Mobile-first (base styles)
- Tablet: `md:` (768px+)
- Desktop: `lg:` (1024px+)

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy
5. Run `prisma migrate deploy` and `npm run seed`

### Environment Variables
```
DATABASE_URL=<postgres-connection-string>
NEXTAUTH_URL=<production-url>
NEXTAUTH_SECRET=<random-secret>
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=<email>
EMAIL_SERVER_PASSWORD=<app-password>
EMAIL_FROM=<from-address>
```

## Seeded Data

### Timberlake Country Club
- 18 holes with accurate par and handicap ranks
- Front 9: Par 36
- Back 9: Par 36
- Total: Par 72

### Default Format
- Name: Sunday Church Scramble Skins
- Description: Scramble tee-to-green, all players putt out, score is total under-par makes
- Default team size: 4

### Sample Players
8 active players with mix of nicknames

## Future Enhancements (Not Implemented)

Potential features for future versions:
- Photo upload for scorecards
- Push notifications for round reminders
- Course-specific handicap adjustments
- Multi-format support in single round
- Historical round replay
- Player performance analytics
- Weather integration
- GPS integration for automatic check-in
- Real-time spectator view
- Social sharing of results
- Payment integration (Venmo, etc.)

## File Structure
```
sunday-church-golf/
├── app/
│   ├── api/              # Backend API routes
│   ├── auth/             # Auth pages (signin, verify, error)
│   ├── players/          # Player management
│   ├── courses/          # Course management
│   ├── formats/          # Format management
│   ├── rounds/           # Round creation & scoring
│   ├── stats/            # Season statistics
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Dashboard
│   └── globals.css       # Global styles
├── lib/
│   ├── prisma.ts         # Prisma client singleton
│   ├── auth.ts           # NextAuth configuration
│   └── game-logic.ts     # Core business logic
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed script
├── __tests__/            # Jest tests
├── .env.example          # Environment template
├── README.md             # Documentation
├── DEPLOYMENT.md         # Deployment guide
└── package.json          # Dependencies
```

## Dependencies Summary

### Production
- next, react, react-dom
- @prisma/client
- next-auth, @next-auth/prisma-adapter
- bcrypt, nodemailer
- zod, date-fns, clsx, lucide-react

### Development
- typescript, @types/*
- tailwindcss, postcss, autoprefixer
- prisma, tsx
- jest, @testing-library/*

## Success Metrics

The app is production-ready when:
- ✅ All CRUD operations work
- ✅ Team generation is random and fair
- ✅ Scoring correctly handles X, carryover, tiebreaker
- ✅ Payouts calculate accurately
- ✅ Mobile interface is smooth and responsive
- ✅ Offline scoring works with localStorage
- ✅ Authentication works via magic link
- ✅ Deployed and accessible online
- ✅ Database seeded with Timberlake course
- ✅ Tests pass for critical business logic

## Support & Maintenance

### Common Issues
1. **Magic link not working**: Check email settings, spam folder, app password
2. **Scores not saving**: Check localStorage, API logs, database connection
3. **Build fails**: Verify all environment variables, TypeScript errors
4. **Database errors**: Check connection string, SSL settings, migrations

### Monitoring
- Vercel Analytics for traffic
- Vercel Logs for errors
- Database metrics (Neon/Supabase dashboard)

---

**Built with Next.js 14, Prisma, and PostgreSQL**
**Deployed on Vercel**
**Optimized for mobile golf scoring**
