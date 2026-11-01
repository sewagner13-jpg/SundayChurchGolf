# Sunday Church Golf

A mobile-first web application for running weekly golf scramble skins games and tracking year-long winnings.

**Public access / No login / No auth - Trusted group usage only.**

## Features

- **Player Management**: Master player list with optional handicaps
- **Round Creation**: Select players, generate balanced or random teams
- **Live Scoring**: Mobile-optimized on-course scoring with skins/carryover tracking
- **Blind Mode**: Anti-cheat mode where teams can only see their own scores
- **Year Leaderboard**: Track season winnings and top team appearances
- **Round History**: Complete hole-by-hole results with payout breakdowns

## Tech Stack

- **Next.js 15** (App Router) with TypeScript
- **Tailwind CSS** for styling
- **Prisma ORM** with PostgreSQL
- **Hosting**: Netlify

## Local Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL database (local or hosted via Neon/Supabase)

### Steps

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd SundayChurchGolf
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your database connection strings:
   ```
   DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
   DIRECT_URL="postgresql://user:password@host:5432/database?sslmode=require"
   ```

4. **Run database migrations**
   ```bash
   npm run db:migrate:dev
   ```

5. **Seed the database**
   ```bash
   npm run db:seed
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Production Deployment (Netlify)

Production releases use the attended gate from a clean primary checkout on `main`:

```bash
npm run deploy:production -- --confirm
```

Run it only after explicit release approval and review of the verification report.
Automatic Git builds must remain stopped. The gate verifies the exact release
commit, runs the checks, packages Next.js with Netlify, and checks production HTTP
responses. The build only generates Prisma Client and runs verification; it does
not push schemas, run migrations, or seed data.

Database changes require a separate reviewed plan and recovery evidence. Do not
add them to the Netlify build. Production connection strings remain managed in
Netlify, and must not be committed.

See `docs/tickets/SCG-005-code-only-release.md` for the prepared gate change,
packaging evidence, and recovery/deployment proposal. Keep the currently serving database and both preserved branches unchanged.
Attended app deployment still requires explicit release authorization.

## Database Commands

| Command | Description |
|---------|-------------|
| `npm run db:migrate:dev` | Create and apply new migrations (development) |
| `npm run db:migrate:prod` | Apply pending migrations (production) |
| `npm run db:seed` | Seed database with initial data |
| `npm run db:reset` | Reset database (development only) |

## Scoring Rules

- **X** = Par or worse (cannot win skins)
- **Positive Integer** = Total strokes under par made on the hole
- Exactly one team with the highest score > 0 wins the skin
- Ties carry over to the next hole
- Pot = Players × Buy-in
- Base skin value = Pot ÷ 18

## Security Notice

This application has **no authentication**. Anyone with the URL can access all features including:
- Creating/editing players
- Starting/managing rounds
- Viewing all financial data

Only share the URL with trusted group members.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── courses/           # Course management
│   ├── formats/           # Format management
│   ├── leaderboard/       # Year standings & player details
│   ├── players/           # Player management
│   └── rounds/            # Round setup, scoring, summary
├── actions/               # Server actions
├── components/            # Reusable UI components
└── lib/                   # Utilities & scoring engine

prisma/
├── schema.prisma          # Database schema
└── seed.ts               # Initial data seeding
```

## License

Private - For authorized use only.
