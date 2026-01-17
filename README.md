# Sunday Church Golf - Skins Scoring App

A production-ready, mobile-first web application for tracking recurring golf skins games. Built for the "Sunday Church" golf group, this app handles team generation, live hole-by-hole scoring, automatic payout calculation, and season statistics.

## Features

- **Mobile-First Design**: Optimized for phone use during play
- **Season Management**: Track games across full calendar years
- **Player Management**: CRUD for players with handicap tracking
- **Course Management**: Support multiple courses with 18-hole scorecards
- **Format Management**: Customizable game formats
- **Team Generation**: Random team generation with manual adjustments
- **Live Scoring**: Mobile-optimized hole-by-hole scoring with offline support
- **Automatic Calculations**: Skins tracking with carryover and tiebreaker logic
- **Payout System**: Automatic payout calculation based on buy-ins
- **Season Stats**: Leaderboards and player performance tracking

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (via Neon or Supabase)
- **ORM**: Prisma
- **Authentication**: NextAuth (Email Magic Link)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Scoring Rules

### Sunday Church Scramble Skins Format

1. **Tee-to-Green**: Teams play scramble format
2. **Putting**: All players putt out individually
3. **Scoring**: Each hole score = total under-par makes by team
   - Birdie = +1
   - Eagle = +2
   - Albatross = +3
   - X = no under-par scores

4. **Hole Winner**: Highest score wins the skin
5. **Carryover**: Tied holes accumulate skins for next hole
6. **Tiebreaker**: If skins remain after hole 18, resolve by hardest handicap hole first

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon or Supabase recommended)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sunday-church-golf
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and configure:
- `DATABASE_URL`: Your PostgreSQL connection string
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- Email server settings for magic link authentication

4. Initialize the database:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

5. Seed the database:
```bash
npm run seed
```

This creates:
- Timberlake Country Club with 18 holes
- Default "Sunday Church Scramble Skins" format
- 8 sample players
- Current year season

6. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

### 1. Set Up Database

#### Option A: Neon (Recommended)

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string

#### Option B: Supabase

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Project Settings > Database
4. Copy the connection string (use "Transaction" pooler mode)

### 2. Deploy to Vercel

1. Push your code to GitHub

2. Go to [vercel.com](https://vercel.com) and import your repository

3. Configure environment variables in Vercel:
```
DATABASE_URL=<your-database-url>
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=<your-email>
EMAIL_SERVER_PASSWORD=<your-app-password>
EMAIL_FROM=noreply@yourdomain.com
```

4. Deploy the application

5. Run migrations and seed:
```bash
# SSH into Vercel or run locally with production DATABASE_URL
npx prisma migrate deploy
npm run seed
```

### 3. Set Up Email for Magic Links

For Gmail:
1. Enable 2FA on your Google account
2. Create an App Password: Google Account > Security > 2-Step Verification > App passwords
3. Use the app password as `EMAIL_SERVER_PASSWORD`

## Project Structure

```
sunday-church-golf/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # NextAuth endpoints
│   │   ├── players/      # Player CRUD
│   │   ├── courses/      # Course CRUD
│   │   ├── formats/      # Format CRUD
│   │   ├── rounds/       # Round management & scoring
│   │   ├── teams/        # Team generation
│   │   └── seasons/      # Season management
│   ├── players/          # Player management UI
│   ├── courses/          # Course management UI
│   ├── formats/          # Format management UI
│   ├── rounds/
│   │   ├── new/          # New round wizard
│   │   └── [id]/
│   │       ├── score/    # Live scoring UI
│   │       └── summary/  # Round results
│   ├── stats/            # Season leaderboard
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Dashboard
│   └── globals.css       # Global styles
├── lib/
│   ├── prisma.ts         # Prisma client
│   ├── auth.ts           # NextAuth config
│   └── game-logic.ts     # Business logic (scoring, payouts)
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed data
├── __tests__/            # Tests
└── package.json
```

## Key Files

### Business Logic (`lib/game-logic.ts`)

- `generateTeams()`: Random team generation
- `computeSkins()`: Calculate hole winners and carryover
- `resolveFinalCarryoverByHandicap()`: Tiebreaker logic
- `computePayouts()`: Calculate team and player winnings
- `saveRoundResults()`: Persist computed results

### Database Schema (`prisma/schema.prisma`)

Core models:
- `Season`: Calendar year grouping
- `Player`: Golfer profiles
- `Course`: Golf courses with holes
- `Format`: Game format definitions
- `Round`: Individual game instances
- `Team`: Team assignments per round
- `HoleScore`: Score tracking per team per hole

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/players` | GET, POST | List/create players |
| `/api/players/[id]` | GET, PATCH, DELETE | Manage player |
| `/api/courses` | GET, POST | List/create courses |
| `/api/courses/[id]` | GET, DELETE | Manage course |
| `/api/formats` | GET, POST | List/create formats |
| `/api/formats/[id]` | GET, PATCH, DELETE | Manage format |
| `/api/rounds` | GET, POST | List/create rounds |
| `/api/rounds/[id]` | GET, PATCH, DELETE | Manage round |
| `/api/rounds/[id]/scores` | PATCH | Update hole scores |
| `/api/teams/generate` | POST | Generate random teams |
| `/api/seasons` | POST | Create/find season |

## Mobile Scoring Features

The live scoring UI (`/rounds/[id]/score`) includes:

- **Offline Support**: LocalStorage caching for spotty cell service
- **Large Touch Targets**: Easy scoring buttons (+1, +2, X, Clear)
- **Swipe Navigation**: Move between holes
- **Hole Picker**: Quick jump to any hole
- **Live Winner Display**: Shows current hole winner
- **Carryover Counter**: Visual display of skins riding
- **Progress Indicator**: Track completion (7/18)
- **Lock Round**: Finalize scores on hole 18

## Testing

Run tests:
```bash
npm test
```

The test suite covers:
- Team generation logic
- X (null) treated as 0
- Carryover calculation
- Eagle + birdie math
- Handicap tiebreaker
- Payout calculations

## Common Tasks

### Add a New Player
1. Navigate to Players page
2. Click "+ Add Player"
3. Enter name, optional nickname and handicap
4. Submit

### Create a New Round
1. Dashboard > New Round
2. Select date, course, format
3. Choose players
4. Generate/adjust teams
5. Confirm and start scoring

### Score a Round
1. Open round from Dashboard
2. For each hole, tap +1 for birdie, +2 for eagle, or X for no score
3. Navigate with Prev/Next or hole picker
4. On hole 18, tap "Lock Round & View Results"

### View Season Stats
1. Dashboard > Quick Actions
2. Navigate to Stats page (or `/stats`)
3. View leaderboard sorted by net winnings

## Customization

### Add a New Course
1. Navigate to Courses page
2. Prepare 18 holes with par and handicap ranks (1-18, unique)
3. Use seed script as template or add via UI (future feature)

### Create a New Format
1. Navigate to Formats page
2. Click "+ Add Format"
3. Enter name, description, default team size
4. Submit

## Troubleshooting

**Database connection errors:**
- Verify `DATABASE_URL` is correct
- Check database is accessible
- Run `npx prisma generate`

**Email magic links not working:**
- Verify email server credentials
- Check spam folder
- For Gmail, ensure app password is used (not regular password)

**Scoring not saving:**
- Check browser console for errors
- Verify API route is accessible
- Check localStorage is enabled

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

