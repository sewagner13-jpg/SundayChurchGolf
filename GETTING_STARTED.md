# Getting Started with Sunday Church Golf App

## Quick Start (5 Minutes)

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (or free Neon/Supabase account)
- Gmail account (for magic link authentication)

### Setup Steps

1. **Install Node.js** (if not installed)
   - Download from [nodejs.org](https://nodejs.org)
   - Verify: `node --version` should show v18+

2. **Install Dependencies**
   ```bash
   cd "Sunday Church App"
   npm install
   ```

3. **Set Up Database**

   **Option A: Neon (Easiest)**
   - Go to [neon.tech](https://neon.tech) and sign up
   - Create a new project
   - Copy the connection string

   **Option B: Local PostgreSQL**
   ```bash
   # Install PostgreSQL, then:
   createdb sunday_church_golf
   ```

4. **Configure Environment**
   ```bash
   cp .env.example .env
   ```

   Edit `.env`:
   ```
   DATABASE_URL="postgresql://..." # Your connection string
   NEXTAUTH_SECRET="..." # Run: openssl rand -base64 32
   NEXTAUTH_URL="http://localhost:3000"
   EMAIL_SERVER_HOST="smtp.gmail.com"
   EMAIL_SERVER_PORT="587"
   EMAIL_SERVER_USER="your-email@gmail.com"
   EMAIL_SERVER_PASSWORD="..." # Gmail app password (see below)
   EMAIL_FROM="your-email@gmail.com"
   ```

5. **Get Gmail App Password**
   - Go to [myaccount.google.com](https://myaccount.google.com)
   - Security > 2-Step Verification (enable if not enabled)
   - App passwords > Generate
   - Select "Mail" and "Other"
   - Copy the 16-character password
   - Use as `EMAIL_SERVER_PASSWORD`

6. **Initialize Database**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   npm run seed
   ```

7. **Start Development Server**
   ```bash
   npm run dev
   ```

8. **Open App**
   - Visit [http://localhost:3000](http://localhost:3000)
   - You should see the Sunday Church Golf dashboard!

## First Steps in the App

### 1. Explore Pre-Seeded Data
- Click "Players" to see 8 sample players
- Click "Courses" to view Timberlake Country Club scorecard
- Check that the default format exists

### 2. Create Your First Round
1. Click "New Round" from dashboard
2. **Round Details**:
   - Date: Today's date (default)
   - Course: Timberlake Country Club
   - Format: Sunday Church Scramble Skins
   - Buy-in: $30 (default)
   - Team Size: 4 (default)
   - Click "Next: Select Players"

3. **Player Selection**:
   - Click on 8 players to select them all
   - Should show "8 selected"
   - Click "Next: Generate Teams"

4. **Review Teams**:
   - You'll see 2 teams of 4 players each
   - Click "🔄 Reroll" to regenerate teams (optional)
   - Click "Next: Confirm"

5. **Confirmation**:
   - Review details
   - Total Pot should be $240 (8 players × $30)
   - Click "Create Round"

### 3. Score the Round

You'll be taken to the scoring interface:

**Hole 1 - Example Scoring:**
1. Team 1 makes 2 birdies: Click "+1" twice (shows "2")
2. Team 2 makes 1 eagle and 1 birdie: Click "+2" once, "+1" once (shows "3")
3. Result: "Team 2 wins!" (3 > 2)
4. Click "Next →" to move to Hole 2

**Hole 2 - Tie Example:**
1. Team 1: Click "+1" (1 birdie)
2. Team 2: Click "+1" (1 birdie)
3. Result: "Tied - skin carries"
4. Notice: Header shows "2 skins • $27" (carryover!)

**Continue Scoring:**
- Score all 18 holes (you can use random values for testing)
- Use "X" button for holes with no under-par scores
- On Hole 18, click "Lock Round & View Results"

### 4. View Results

After locking, you'll see:
- **Player Winnings**: Sorted leaderboard with medals
- **Hole-by-Hole**: Complete scorecard with winners highlighted
- **Payouts**: Exactly how the pot was divided

### 5. Check Season Stats
- Return to Dashboard
- Click "Stats" in Quick Actions
- See season leaderboard with net winnings

## Understanding the Scoring

### Input Format
For each team on each hole, enter **total under-par strokes made**:
- X = no under-par scores (everyone made par or worse)
- 1 = one birdie made by the team
- 2 = either one eagle, OR two birdies
- 3 = one eagle + one birdie, OR three birdies
- 5 = one eagle + three birdies, etc.

### How Winners Are Determined
- Highest number wins the skin
- If tied (or all X's), skin carries to next hole
- Winner gets all carried skins

### Example Scenario
```
Hole 1: Team 1 = 2, Team 2 = 2 → Tie, carry 1 skin
Hole 2: Team 1 = 1, Team 2 = 3 → Team 2 wins 2 skins ($27)
Hole 3: Team 1 = X, Team 2 = 1 → Team 2 wins 1 skin ($13.50)
```

### Tiebreaker (After Hole 18)
If skins are still tied:
1. Look at Hole 2 (handicap 1 = hardest hole)
2. If still tied, look at Hole 15 (handicap 2)
3. Continue until winner found
4. Edge case: If tied on ALL holes, split remaining skins

## Mobile Usage

### On Your Phone During Play
1. **Before Round**:
   - Create round on computer (easier for team setup)
   - Share round URL to group via text

2. **During Play**:
   - Open round URL on phone
   - One person is "scorekeeper"
   - After each hole, scorekeeper taps scores
   - Auto-saves instantly (works offline!)

3. **After Round**:
   - Lock round from phone or computer
   - Everyone can view results immediately

### Mobile Tips
- Use hole picker (tap hole number) to jump around
- Landscape mode works great on tablets
- Works offline - syncs when signal returns
- Large buttons designed for on-course use

## Common Questions

**Q: Can I add my own players?**
A: Yes! Go to Players page, click "+ Add Player"

**Q: Can I add my own course?**
A: Currently requires editing seed script or manual database entry. Future feature: course creation UI.

**Q: What if someone's phone dies during scoring?**
A: Scores are saved to the database immediately. Just open the round on another phone and continue.

**Q: Can multiple people score at once?**
A: Currently designed for one scorekeeper per round. Multiple scorers may conflict.

**Q: How do I delete a round?**
A: Currently requires database access. Future feature: round deletion in UI.

**Q: Can I edit scores after locking?**
A: No - locking is final. Future feature: admin override.

## Next Steps

### Customize for Your Group
1. **Add Real Players**:
   - Go to Players page
   - Add each regular player
   - Include nicknames and handicaps

2. **Add Your Course**:
   - Get scorecard with handicap ranks
   - Edit `prisma/seed.ts` to add your course
   - Re-run `npm run seed`

3. **Adjust Buy-In**:
   - Default is $30, but you can change per round
   - Set custom buy-in during round creation

4. **Customize Team Size**:
   - Default is 4-person teams
   - Change during round creation for different formats

### Deploy to Production
See **DEPLOYMENT.md** for complete Vercel deployment guide.

### Run Tests
```bash
npm test
```

## Troubleshooting

### "Failed to load players"
- Check database connection in `.env`
- Verify `DATABASE_URL` is correct
- Run `npx prisma studio` to view database

### "Magic link not working"
- Check email settings in `.env`
- Use Gmail app password (not regular password)
- Check spam folder
- Try signing in again

### "Scores not saving"
- Check browser console (F12) for errors
- Verify API is running (check Network tab)
- Clear localStorage and reload
- Check database connection

### Database Errors
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Re-seed
npm run seed
```

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Database commands
npx prisma studio        # Open database GUI
npx prisma migrate dev   # Create new migration
npx prisma generate      # Regenerate Prisma client
npx prisma db push       # Push schema without migration

# Seed database
npm run seed
```

## File Overview

| File | Purpose |
|------|---------|
| `app/page.tsx` | Dashboard home page |
| `app/players/page.tsx` | Player management |
| `app/courses/page.tsx` | Course management |
| `app/rounds/new/page.tsx` | New round wizard |
| `app/rounds/[id]/score/page.tsx` | Live scoring interface |
| `app/rounds/[id]/summary/page.tsx` | Round results |
| `app/stats/page.tsx` | Season leaderboard |
| `lib/game-logic.ts` | Core business logic |
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts` | Seed data |

## Resources

- **Documentation**: See README.md
- **Deployment**: See DEPLOYMENT.md
- **Architecture**: See PROJECT_SUMMARY.md
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
- **Prisma Docs**: [prisma.io/docs](https://prisma.io/docs)
- **Tailwind Docs**: [tailwindcss.com/docs](https://tailwindcss.com/docs)

## Support

If you encounter issues:
1. Check this guide first
2. Review error messages carefully
3. Check browser console (F12)
4. Verify environment variables
5. Test database connection

---

**Ready to Track Your Sunday Church Golf Games!** ⛳️
