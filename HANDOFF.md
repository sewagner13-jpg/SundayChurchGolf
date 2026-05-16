# Sunday Church Golf App — Handoff for Codex

**Last updated:** 2026-05-16
**Owner:** Sean Wagner (sean@clear-edge.net)
**Outgoing:** Claude (Sonnet 4.6)

This document tells the next coding agent everything needed to take over development of the Sunday Church Golf app.

---

## 1. Where things live

| Resource | Location |
|---|---|
| Local working copy | `/Users/seanwagner/Desktop/Sunday Church App/` |
| GitHub repo | https://github.com/sewagner13-jpg/SundayChurchGolf |
| **Deploy branch (active)** | `claude/master-spec-consolidation-Y6XjM` |
| Production hosting | Vercel (auto-deploys from the deploy branch) |
| Production database | Neon project **flat-violet-56138252** ("Sunday Golf App"), region `aws-us-east-1` |
| Neon org | `org-bold-water-15781020` (sewagner13@gmail.com) |

> ⚠️ `main` is **stale** — do not push there. The Vercel-tracked branch is `claude/master-spec-consolidation-Y6XjM`. The branch `port-formats` is also stale; all its work was merged into the deploy branch via PRs #3–#7.

---

## 2. Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5.9
- **Styling:** Tailwind CSS 3.4
- **ORM/DB:** Prisma 6 + PostgreSQL (Neon)
- **Auth:** NextAuth.js (magic-link email)
- **Hosting:** Vercel
- **Build:** `next build --webpack`
- **Tests:** `tsx --test src/__tests__/**/*.test.ts`

`package.json` scripts:
```bash
npm run dev          # local dev on :3000
npm run build        # production build
npm run lint
npm run typecheck    # tsc --noEmit
npm run test         # scoring engine tests
npm run db:migrate:dev   # prisma migrate dev
npm run db:migrate:prod  # prisma migrate deploy
npm run db:seed
```

Local Prisma binary (v6): `./node_modules/.bin/prisma`. Avoid `npx prisma` — it has pulled v7 in the past, which strips `directUrl` from `schema.prisma`.

---

## 3. Environment variables

Local `.env` has had stale Neon credentials in the past. The Vercel deploy uses its own env vars and is unaffected.

Required vars (see `.env.example`):
- `DATABASE_URL` — pooled Neon URL (host contains `-pooler`)
- `DIRECT_URL` — same URL **without** `-pooler`, used by Prisma migrations
- Auth-related vars for NextAuth (email provider config)

If migrations fail with `password authentication failed`, rotate the Neon password from the Neon console and update both `DATABASE_URL` and `DIRECT_URL`. Production is fine — Vercel keeps its own copy.

---

## 4. Repository layout

```
prisma/
  schema.prisma          # Source of truth for DB
  seed.ts                # Seeds formats + courses
  migrations/            # 13 migrations through 20260322000000_add_manual_settlements

src/
  actions/               # All server actions ("use server")
    chat.ts, courses.ts, formats.ts, handicaps.ts,
    par3-contests.ts, player-scores.ts, players.ts,
    quick-rounds.ts,     # NEW — Record Past Round
    rounds.ts, scoring.ts, season-stats.ts,
    settlements.ts,      # Manual money-only settlements
    teams.ts

  lib/
    db.ts                # Prisma client singleton — import { prisma } from "@/lib/db"
    format-definitions.ts  # SOURCE OF TRUTH for all 17 formats
    scoring-engine.ts      # Pure scoring functions, no DB
    format-scoring.ts      # Dispatcher used by player-scores action
    irish-golf.ts          # Irish 6-6-6 segment logic
    payout-breakdown.ts    # Pot distribution
    scoring-order.ts       # Hole rotation order
    team-labels.ts         # Display labels for teams
    par3-contests.ts/.server.ts
    ghin.ts                # GHIN handicap import

  app/                   # App Router
    page.tsx             # Dashboard with leaderboard + quick links
    layout.tsx
    rounds/
      page.tsx           # Round Log
      new/page.tsx       # Create-a-round wizard
      record/page.tsx    # NEW — Record Past Round (quick rounds)
      [id]/
        setup/           # Pre-round setup
        sunday-setup/    # Sunday-format-specific setup
        scoring/         # Live scoring UI
        summary/         # Round summary
        payouts/         # Live payouts view
        final-payouts/   # Final payouts after FINISHED
    settlements/
      page.tsx           # List/delete manual settlements
      new/page.tsx       # Create manual settlement (money only)
    players/, courses/, formats/, leaderboard/, stats/
    api/                 # REST endpoints (formats, rounds, payouts, player-scores)
```

---

## 5. Data model — the parts that bite

### Rounds
- `Round.status`: `DRAFT | LIVE | FINISHED`
- `Round.formatConfig` (JSON) — bag for format-specific settings:
  - `manualEntry: true` — marks quick-recorded rounds (no hole scores)
  - `loneRangerOrder[teamId]: string[]` — yellow ball player order per team
  - `segment1FormatId`, `segment2FormatId`, `segment3FormatId` — Irish 6-6-6
  - `shambleCountMode`, `enableDriveMinimums`, `excludePar3sFromDriveMinimums`, etc.

### Scores — two parallel tables, easy to confuse
- **`HoleScore`** — one per **team** per hole. Used by all formats.
  - `value`: **for skins formats** this is `underParStrokes` (1 = birdie). For stroke formats it equals `grossScore`.
  - `grossScore`: raw strokes (3 for birdie on par 4). Added when `requiresTeamGrossScore` was introduced.
  - `holeData` (JSON): per-format extras (countedPlayerIds, displayScore, effectiveFormatId, designatedPlayerId, etc.)
- **`PlayerScore`** — one per **player** per team per hole. Used by formats with `requiresIndividualScores: true`.
  - `grossScore`, `extraData` (driveSelected, moneyBallLost, wolfPartnerPlayerId, etc.)

### Money tracking — three paths
1. **Live-played round:** scoring computes `RoundPlayer.payoutAmount` and `Team.totalPayout`. `Team.isTopPayingTeam` set on top-payout team. Players on that team have `wasOnTopPayingTeam: true`.
2. **Manual Settlement** (`ManualSettlement` + `ManualSettlementEntry`): pure money record, no teams. Use for free-floating credits/debits. Flows into `SeasonPlayerStat.totalWinnings` only.
3. **Quick Round / Record Past Round:** real `Round` with `status=FINISHED`, `formatConfig.manualEntry=true`, real `Team` and `RoundPlayer` records with `payoutAmount` set. Counts toward `roundsPlayed`, `totalBuyInsPaid`, partnership history.

### `SeasonPlayerStat` (per year, per player)
Rebuilt by `rebuildSeasonStats(year)` in `src/actions/season-stats.ts`. Sums:
- `totalWinnings` = Σ payoutAmount from FINISHED rounds + Σ ManualSettlementEntry.amount
- `totalBuyInsPaid` = Σ buyInPerPlayer for each round played
- `roundsPlayed` = count of FINISHED rounds the player appeared in
- `topTeamAppearances` = count where `wasOnTopPayingTeam=true`

**Important:** there's no DB trigger. Mutations that touch payouts must call `rebuildSeasonStats(year)` explicitly. Both `createQuickRound` and `deleteQuickRound` do this.

---

## 6. Format catalog (17 formats)

Defined in `src/lib/format-definitions.ts` — this is the single source of truth. Adding a format means editing this file, adding a case to `scoring-engine.ts`, and seeding it via `prisma/seed.ts`.

| Format ID | Name | Skins/Strokes |
|---|---|---|
| `default-sunday-church` | Sunday Church Scramble Skins | skins (`+N` entry) |
| `scramble_rotating_drives` | Scramble with Rotating Drives | gross strokes |
| `captains_choice` | Captain's Choice Scramble | gross strokes |
| `step_aside_scramble` | Step-Aside Scramble | gross strokes |
| `match_play` | Match Play | gross strokes |
| `one_best_ball_of_four` | 1 Best Ball of 4 | gross strokes (individual scores) |
| `two_best_balls_of_four` | 2 Best Balls of 4 | same |
| `three_best_balls_of_four` | 3 Best Balls of 4 | same |
| `lone_ranger` | Lone Ranger / Yellow Ball | individual + designated player |
| `money_ball` | Money Ball | individual + designated player |
| `cha_cha_cha` | Cha Cha Cha | individual |
| `wolf_team` | Wolf | individual + partner pick |
| `shamble_team` | Shamble | individual |
| `chicago_points_team` | Chicago Points | individual |
| `train_game` | Train Game | individual |
| `vegas` | Vegas | individual (special team math) |
| `irish_golf_6_6_6` | Irish Golf / 6-6-6 | dispatches to 3 sub-formats per 6-hole segment |

Key flags on each definition:
- `requiresIndividualScores` — uses `PlayerScore` table (per-player entry)
- `requiresTeamGrossScore` — gross strokes UI (3,4,5,…) vs skins UI (`+1`,`+2`,…)
- `formatCategory` — `"skins" | "stroke" | ...`
- `configOptions` — UI-driven options surfaced in `/rounds/new`

`IRISH_GOLF_ELIGIBLE_SEGMENT_FORMATS` lists which formats can be used as Irish segments.

---

## 7. Recent work shipped (last 4 weeks)

In chronological order on `claude/master-spec-consolidation-Y6XjM`:

1. **Full format port + scoring engine** (PR #3) — 14 new formats, `PlayerScore` model, `formatConfig` JSON.
2. **Gross score entry fix** (PR #4) — `requiresTeamGrossScore` flag. Scramble/Captain's Choice/Match Play now take 2–9 stroke buttons; old skins UI (`+N`) preserved for skins formats. Fixed birdie-as-bogey bug.
3. **Manual Settlements** (PR #5) — `ManualSettlement` + `ManualSettlementEntry` for off-round payouts. `/settlements` UI + season-stats integration.
4. **Lone Ranger pre-round order** (PR #6) — required pre-round yellow ball rotation, free-pick selector for overflow holes (e.g. 17–18 with 4 players).
5. **Irish Golf 6-6-6 pot fix** (PR #7) — correct pot distribution when overall 18-hole game is enabled.
6. **Irish Golf match-play scoring fix** — restored live scoreboard for the match-play segment.
7. **Round summary improvements** — per-hole winner column, team-level scores in summary table.
8. **Record Past Round** (latest, commits `167ef62` + `00f99be`) — quick-round entry: date, course, format, team builder, per-team payout (split per player), no hole scores. Routes: `/rounds/record`. Server actions: `src/actions/quick-rounds.ts`.

### Historical data backfill — 2026-04-20 and 2026-04-26
Two previously-entered Manual Settlements were converted to Quick Rounds (with team data) on 2026-05-16. The teams in the database now reflect actual partnerships:

**2026-04-20** (`Round.id = 'manual-2026-04-20'`)
- Team 1 (+$120, winners): David Hamilton, Albert Bueno, Al Samudio, Tony Wiest
- Team 2 ($0, neutral): Julien Jenkins, Matt Roe, Trevor Barrett
- Team 3 (-$120, losers): Scott Mathias, Scott Walker, Ross Hetlinger, Mike Walsh

**2026-04-26** (`Round.id = 'manual-2026-04-26'`)
- Team 1 (+$120, winners): Tony Wiest, Eddie Dennis, Griff Hamilton, Jim Medlin
- Team 2 (-$37.50): Ross Hetlinger, Matt Roe, Jay Medlin
- Team 3 (-$70): David Hamilton, Albert Bueno, Trevor Barrett, Al Samudio

Both have `formatConfig: { manualEntry: true }` and team IDs prefixed `manual-2026-04-20-tN` / `manual-2026-04-26-tN`.

---

## 8. Current state snapshot (2026-05-16)

**Database content (year 2026):**
- 6 live-played rounds + 2 manual-entry rounds
- 20 active `SeasonPlayerStat` records
- 1 remaining Manual Settlement (2026-03-22, kept intentionally — see `description`: "Game played but scoring app had wrong login")
- 22 players, 1 course (Timberlake Country Club), 17 formats seeded

**Working tree:** clean. `claude/master-spec-consolidation-Y6XjM` is at `00f99be` and up-to-date with origin.

**TypeScript:** `npm run typecheck` passes with no errors.

**Known minor things:**
- `package-lock.json` sometimes drifts because of npm peer-dependency rewrites — usually safe to discard or commit if intentional.
- Local `.env` may have stale Neon credentials — production unaffected.

---

## 9. Common operations — recipes

### Add a new format
1. Add definition to `src/lib/format-definitions.ts` (set `requiresTeamGrossScore` / `requiresIndividualScores` correctly).
2. Add a case to `computeFormatScore` in `src/lib/scoring-engine.ts`.
3. Add format to `prisma/seed.ts`.
4. If it can be used as an Irish segment, add to `IRISH_GOLF_ELIGIBLE_SEGMENT_FORMATS`.
5. Run `npm run db:seed`.
6. Write tests in `src/__tests__/scoring-engine.test.ts`.

### Migrate the DB
```bash
./node_modules/.bin/prisma migrate dev --name <name>   # local dev
./node_modules/.bin/prisma migrate deploy              # production (Vercel runs this)
```

### Rebuild season stats for a year
```ts
import { rebuildSeasonStats } from "@/actions/season-stats";
await rebuildSeasonStats(2026);
```
Required after any direct DB write that affects `RoundPlayer.payoutAmount`, `ManualSettlementEntry`, or after creating/deleting FINISHED rounds.

### Direct Neon SQL via MCP
Project ID: `flat-violet-56138252`. Settlement and round IDs are stable strings — see the data section above for examples.

### Deploy
Push to `claude/master-spec-consolidation-Y6XjM`. Vercel auto-deploys. There is no manual step.

---

## 10. Conventions & gotchas

- **Imports:** `import { prisma } from "@/lib/db"`. Not `@/lib/prisma`.
- **Server actions** live in `src/actions/`, all start with `"use server"`. Don't import them client-side except as actions.
- **Prisma Decimal:** when sending to client components, coerce with `Number(d.toString())` or type as `{ toString(): string } | number | string`. Don't pass raw `Decimal` to client JSX.
- **`useCallback` for loaders** — `useEffect` should depend on the memoized function, not re-fetch on every render.
- **CUIDs vs UUIDs:** Prisma uses `@default(cuid())` but the column type is just `String`. When inserting via raw SQL, any unique string works (e.g. `manual-2026-04-20`).
- **Enum casts in raw SQL:** Prisma enums are native PostgreSQL enums. Use `'FINISHED'::"RoundStatus"` if implicit casting fails (it usually works).
- **Hole numbering:** 1-indexed throughout. `scoringPosition` (0-indexed) is the position within `scoringOrder`, not the literal hole number.
- **`requiresTeamGrossScore` vs skins:** they take different UI inputs and store different values in `HoleScore.value`. Don't conflate them.

---

## 11. Suggested next moves

The user hasn't asked for these yet — listed only so you have context for likely future requests:

- **Per-player payout override** in Record Past Round (currently splits team payout evenly — fine for most cases).
- **Per-week leaderboard** view (currently only season-wide).
- **Edit existing quick round** (currently only delete-and-recreate).
- **Import bulk historical seasons** (CSV upload). Mentioned but not built.
- **Mobile responsiveness audit** — most pages are mobile-optimized; record-round form could be tightened.

---

## 12. Where to look for examples

| If you need to… | Read |
|---|---|
| Create a round programmatically | `src/actions/quick-rounds.ts` `createQuickRound` |
| Compute payouts for a format | `src/lib/scoring-engine.ts` + `src/lib/payout-breakdown.ts` |
| Add a UI page that creates a round | `src/app/rounds/record/page.tsx` |
| Update season stats | `src/actions/season-stats.ts` `rebuildSeasonStats` |
| Work with team labels | `src/lib/team-labels.ts` `getTeamDisplayLabel` |
| Understand Irish 6-6-6 segment dispatch | `src/lib/irish-golf.ts` + `getIrishGolfSegmentFormatId` in `format-scoring.ts` |

---

## 13. Contact

If something is unclear, the user (Sean) prefers terse, direct answers. He reads code. Show diffs, file paths, and line numbers rather than long prose. He owns the GitHub repo and Vercel deploy.

Good luck.
