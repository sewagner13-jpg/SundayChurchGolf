# Yellow Ball Handicap Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each Yellow Ball team a dot-based 18-hole handicap map before and after it locks the player rotation, then release it to the existing morning round.

**Architecture:** Extend the shared handicap card with a tested display formatter and reuse it inside the dedicated Yellow Ball scoring component. The display uses the same locked round handicaps and course ranks as server scoring; it remains informational and submits no derived values.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Node test runner, Playwright, Prisma, Netlify.

## Global Constraints

- `•` represents one received stroke, repeated once per stroke; `-` represents zero.
- Existing numeric handicap displays remain unchanged.
- Relative handicaps use the full round roster; lowest rounded handicap plays zero.
- No slope or tee adjustment.
- The map is omitted when Yellow Ball handicaps are disabled.
- Player labels remain sticky and only the table scrolls horizontally on phones.
- No disposable production smoke round.
- Preserve the morning draft's roster, teams, course, date, visibility, and buy-in.

---

### Task 1: Dot Stroke Formatter

**Files:**
- Modify: `src/components/handicap-stroke-card.tsx`
- Test: `src/__tests__/handicap-scoring.test.ts`

**Interfaces:**
- Produces: `formatHandicapStrokeMark(strokes: number | null, displayMode?: "number" | "dots"): string`

- [ ] **Step 1: Write the failing formatter test**

Add assertions that dot mode returns `-`, `•`, `••`, and `+•` for zero, one, two, and negative one strokes, while number mode retains `2`.

- [ ] **Step 2: Prove the test red**

Run: `node --import tsx --test src/__tests__/handicap-scoring.test.ts`

Expected: FAIL because `formatHandicapStrokeMark` is not exported.

- [ ] **Step 3: Implement the formatter and display prop**

Export the pure formatter, add `strokeDisplay?: "number" | "dots"` to `HandicapStrokeCardProps`, default it to `"number"`, and render each table cell through the formatter.

- [ ] **Step 4: Prove the focused test green**

Run: `node --import tsx --test src/__tests__/handicap-scoring.test.ts`

Expected: all handicap scoring tests pass.

### Task 2: Yellow Ball Map Integration

**Files:**
- Modify: `src/components/sunday-church-yellow-ball-scoring.tsx`
- Modify: `src/app/rounds/[id]/scoring/page.tsx`
- Test: `src/__tests__/sunday-church-yellow-ball-skins.test.ts`

**Interfaces:**
- Consumes: `HandicapStrokeCard` with `strokeDisplay="dots"`.
- Adds prop: `holes: Array<{ holeNumber: number; handicapRank: number }>`.

- [ ] **Step 1: Write the failing integration guard**

Assert the Yellow Ball component renders the shared card in dot mode and the scoring page passes `round.course.holes`.

- [ ] **Step 2: Prove the guard red**

Run: `node --import tsx --test src/__tests__/sunday-church-yellow-ball-skins.test.ts`

Expected: FAIL because the map and holes prop are absent.

- [ ] **Step 3: Render the shared map before both Yellow Ball states**

Pass ordered course holes from the scoring page. Render the map before the unlocked order card and before the locked score card only when `useYellowBallHandicaps` is true. Use title `Yellow Ball Handicap Shots` and dot mode.

- [ ] **Step 4: Prove focused tests green**

Run both focused test files and require all tests to pass.

### Task 3: Browser And Phone Verification

**Files:**
- Modify: `src/components/sunday-church-yellow-ball-sandbox.tsx`
- Modify: `e2e/yellow-ball-walkthrough.spec.ts`

**Interfaces:**
- Consumes: the shared dot-mode `HandicapStrokeCard` and existing Yellow Ball fixture data.

- [ ] **Step 1: Add failing E2E expectations**

Before locking orders, require the heading, four player rows, 18 hole headers, relative handicaps, and dot marks. After locking, require the same map and current-hole highlight.

- [ ] **Step 2: Prove the browser test red**

Run: `npx playwright test e2e/yellow-ball-walkthrough.spec.ts`

Expected: FAIL because the sandbox does not expose the handicap map.

- [ ] **Step 3: Add the shared card to the fixture**

Render the same card and handicap data used by the production component. Do not duplicate stroke calculations in the fixture.

- [ ] **Step 4: Verify desktop and 390x844**

Run the focused Playwright file. Require no page overflow, grid-only horizontal scrolling, sticky player labels, current-hole highlighting, screenshots, and traces.

### Task 4: Full Verification, Release, And Morning Draft

**Files:**
- Modify: `docs/STATE.md`
- Modify: `docs/tickets/SCG-003-yellow-ball-handicap-map.md`

- [ ] **Step 1: Run all gates**

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run e2e`, `npm run verify:negative-probes`, and `npm run verify:release`.

- [ ] **Step 2: Commit and push reviewed source**

Commit only SCG-003 files and push `main`. Leave the five unrelated untracked build/copy paths untouched.

- [ ] **Step 3: Deploy through the sole production gate**

Run: `npm run deploy:production -- --confirm`

Require the exact full commit SHA in the ready Netlify deploy, HTTP 200 from the live app, and `stop_builds: true` afterward.

- [ ] **Step 4: Update the existing morning draft**

Through the production UI, edit only draft `cmsuqvycj0001la09ri2bq1fr`, select `Sunday Church Yellow Ball Skins`, enable Yellow Ball handicaps, and save. Do not start, delete, regenerate, or score the round.

- [ ] **Step 5: Verify saved production state**

Reload the setup page and confirm the format, handicap toggle, 12 selected players, three four-player teams, Timberlake course, and $30 buy-in. Capture a browser artifact without creating a smoke round.

- [ ] **Step 6: Close repository state**

Record exact test results, deployed SHA/deploy ID, saved draft state, and stopped-build state in the ticket and `docs/STATE.md`; run `npm run check:state`, commit, and push the documentation-only closure while automatic builds remain stopped.
