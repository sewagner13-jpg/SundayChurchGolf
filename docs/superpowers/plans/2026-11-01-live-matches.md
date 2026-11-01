# Live Matches Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans and test-driven-development.

**Goal:** Show separate live match cards and expandable saved-hole scores.
**Architecture:** A pure presenter converts existing engine summaries into typed match cards; the server action supplies these to a responsive component in the current leaderboard modal.
**Tech Stack:** Existing Next.js, React, Tailwind 3, Node tests, Playwright.
**Spec:** docs/superpowers/specs/2026-11-01-live-matches-design.md

## Global Constraints
No database mutation, schema, engine, dependencies or release configuration changes. Refresh cadence stays ten seconds. Names remain black. Blind details stay hidden.

## Review Focus
No scores: no leader. Partial scores: no premature wins. Ties: preserve two-tie-all-tie. Phone layout: long names wrap. Different game lengths: use actual hole counts.

### Task 1: Present existing match outcomes
- [ ] Add failing tests for `buildCrossMatchStandings(summaries, names, hidden)` in `src/__tests__/cross-match-standings.test.ts`: empty/partial/tied/leading/complete games and blind suppression.
- [ ] Implement types and pure presenter in `src/lib/cross-match-standings.ts`.
- [ ] Run targeted Node tests, then unit suite.

### Task 2: Display cards and integrate
- [ ] Add failing browser test at 320/390px for four cards, expanded saved-hole scores and preserved unsaved input after refresh.
- [ ] Implement `CrossMatchStandings` component and gated fixture; integrate optional matches payload into `getLiveLeaderboard` and the scoring modal. Cross cards replace the combined entries/segment lists for cross formats.
- [ ] Verify release gate and review diff; commit, fast-forward main and deploy through the authorized code-only gate. Confirm live identity, read-only leaderboard rendering and fixture 404.
