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

### Database Setup

1. Create a PostgreSQL database on [Neon](https://neon.tech) or [Supabase](https://supabase.com)
2. Note your connection strings

### Netlify Deployment

1. Connect your GitHub repository to Netlify
2. Add environment variables in Netlify dashboard:
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `DIRECT_URL` - Same as DATABASE_URL for most providers
3. Deploy - Netlify will automatically:
   - Run migrations (`prisma migrate deploy`)
   - Seed the database (idempotent)
   - Build the Next.js application

### Manual Deployment

```bash
# Build for production
npm run build

# Run migrations
npm run db:migrate:prod

# Seed database
npm run db:seed
```

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
