# Handicap Stroke Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every physical-group player's relative handicap shots across all 18 holes and make gross-versus-net scoring unmistakable.

**Architecture:** A pure shared helper converts locked event handicaps to relative playing handicaps. Cross-group scoring and a focused scoring-screen component consume that same output, preventing display and result drift while keeping the legacy scoring page below its tracked line ceiling.

**Tech Stack:** TypeScript, React 19, Next.js 16, Node test runner, Playwright.

## Global Constraints

- Lowest rounded event handicap plays from zero.
- Do not adjust for slope or tee position.
- Scorers enter gross scores only; the app calculates net.
- Show all players in the selected physical group and all 18 holes.
- Do not add a database migration or change stored handicap snapshots.
- Do not grow legacy files beyond their tracked line-cap baseline.

---

### Task 1: Relative Handicap Allocation

**Files:**
- Modify: `src/lib/handicap-scoring.ts`
- Modify: `src/__tests__/handicap-scoring.test.ts`
- Modify: `src/lib/cross-threesome-666.ts`
- Modify: `src/lib/cross-foursome-66618.ts`
- Modify: `src/__tests__/cross-threesome-666.test.ts`
- Modify: `src/__tests__/cross-foursome-66618.test.ts`

**Interfaces:**
- Produces: `getRelativePlayingHandicaps(playerHandicapIndexes)` returning adjusted whole handicaps by player ID.
- Consumes: existing `getPlayingHandicap`, `getStrokesReceivedForHole`, and `getNetScore`.

- [ ] Write failing unit tests showing handicaps 6, 9, and 12 become 0, 3, and 6 and allocate strokes only on eligible course ranks.
- [ ] Run the focused tests and confirm the unimplemented relative resolver fails.
- [ ] Implement the pure resolver and make both cross-group scorers use adjusted values.
- [ ] Run handicap and cross-group tests and confirm they pass.

### Task 2: Scoring-Screen Visibility

**Files:**
- Create: `src/components/handicap-stroke-card.tsx`
- Modify: `src/app/rounds/[id]/scoring/page.tsx`
- Create: `e2e/handicap-stroke-visibility.spec.ts`
- Modify: `playwright.config.ts` only if deterministic scoring-route fixtures require configuration.

**Interfaces:**
- Consumes: selected physical-group players, all locked round handicaps, course hole ranks, current hole, and gross score strings.
- Produces: a responsive 18-hole allocation table and current-hole gross/net score details.

- [ ] Write a browser test that expects every selected-group player, the 18-hole allocation, the current-hole highlight, `Enter gross score`, and a calculated net score.
- [ ] Run the focused browser test and confirm it fails because the visibility component is absent.
- [ ] Implement the focused component and integrate it only for formats that use net scoring.
- [ ] Remove the existing Cross-Threesome-only preview code so the scoring page does not grow.
- [ ] Run the browser test, line-cap check, typecheck, and focused unit tests.

### Task 3: Release Proof

**Files:**
- Modify: `docs/STATE.md`

**Interfaces:**
- Consumes: repository quality gates.
- Produces: durable verification evidence for the draft PR.

- [ ] Run `npm run verify:release` and require all unit, type, lint, build, and browser checks to pass.
- [ ] Run `npm run verify:negative-probes` and require every control probe to block as expected.
- [ ] Record exact results in `docs/STATE.md`.
- [ ] Commit the implementation and push the active draft PR branch without deploying production.
