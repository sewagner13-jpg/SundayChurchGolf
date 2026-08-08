# Build Discipline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add enforceable repository state, line-cap, browser-E2E, controlled-release, and negative-probe mechanisms before the UI/UX walkthrough.

**Architecture:** Small Node ESM scripts own each control and expose testable functions. A control-feedback runner executes release steps and writes local evidence. The Git release command invokes that runner; Netlify repeats non-browser quality gates before database writes.

**Tech Stack:** Node.js ESM, `node:test`, Playwright, Next.js, Netlify, npm scripts.

## Global Constraints

- New source files are capped at 500 lines; listed legacy files may only shrink.
- Browser tests use intercepted fixtures and never require a database.
- Production releases use the Git deploy branch, never a direct local Netlify upload.
- Netlify runs quality checks before `prisma db push` or `db:seed`.
- Negative probes must prove every control can block invalid input.
- Do not change golf scoring behavior or redesign application UI in this work.

---

### Task 1: State and line-cap controls

**Files:**
- Create: `docs/STATE.md`
- Create: `scripts/line-cap-baseline.json`
- Create: `scripts/build-discipline/line-caps.mjs`
- Create: `scripts/build-discipline/state.mjs`
- Modify: `package.json`, `.gitignore`
- Test: `src/__tests__/build-discipline.test.ts`

**Interfaces:**
- Produces `validateStateDocument(contents: string): string[]`.
- Produces `checkLineCaps({ rootDir, baseline, defaultCap }): Array<{ path, lines, maxLines }>`.
- `npm run check:state` and `npm run check:line-caps` exit nonzero when violations exist.

- [ ] Write failing tests requiring all state headings and rejecting a 501-line fixture.

```ts
assert.deepEqual(validateStateDocument("# Sunday Church Golf State\n"), [
  "Missing required section: ## Release Topology",
]);
assert.deepEqual(checkLineCaps({ rootDir: fixtureRoot, baseline: {}, defaultCap: 500 }), [
  { path: "src/too-large.ts", lines: 501, maxLines: 500 },
]);
```

- [ ] Run `npx tsx --test src/__tests__/build-discipline.test.ts`; expect missing-module failure.
- [ ] Implement the validators and CLI entrypoints. `docs/STATE.md` names the Netlify deploy branch, Node 20, all required quality commands, `deploy:production -- --confirm`, and the 500-line policy. The JSON baseline records every current source file over 500 lines at its present count. Ignore `.control-feedback/`, `playwright-report/`, and `test-results/`.

```js
export function validateStateDocument(contents) {
  return REQUIRED_HEADINGS.filter((heading) => !contents.includes(heading))
    .map((heading) => `Missing required section: ${heading}`);
}

export function checkLineCaps({ rootDir, baseline, defaultCap = 500 }) {
  return sourceFiles(rootDir).flatMap((path) => {
    const lines = countLines(path);
    const maxLines = baseline[relative(rootDir, path)] ?? defaultCap;
    return lines > maxLines ? [{ path: relative(rootDir, path), lines, maxLines }] : [];
  });
}
```

- [ ] Run `npx tsx --test src/__tests__/build-discipline.test.ts && npm run check:state && npm run check:line-caps`; expect pass.
- [ ] Commit with `feat: add state and line-cap controls`.

### Task 2: Browser E2E and negative browser probe

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/new-round-format-selector.spec.ts`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- `npm run e2e` starts Next.js on port 3100 and executes Playwright.
- `E2E_EXPECTED_FORMAT_NAME` overrides only the expected format label.
- `npm run probe:e2e` succeeds only when the deliberately wrong label makes Playwright fail.

- [ ] Write the browser test first. It intercepts `/api/courses` and `/api/formats`, loads `/rounds/new`, changes the accessible `Format` select to Cross-Threesome, and verifies the selection and description.

```ts
const expectedFormat = process.env.E2E_EXPECTED_FORMAT_NAME ?? "Cross-Threesome 6-6-6";
await page.route("**/api/courses", (route) => route.fulfill({ json: [courseFixture] }));
await page.route("**/api/formats", (route) => route.fulfill({ json: formatFixtures }));
await page.goto("/rounds/new");
await page.getByLabel("Format").selectOption("cross-threesome");
await expect(page.getByText(expectedFormat)).toBeVisible();
```

- [ ] Run `npm run e2e`; expect missing Playwright/config failure.
- [ ] Install `@playwright/test`, configure Chromium and `webServer: npm run dev -- --port 3100`, then add `e2e` and `probe:e2e` scripts. The probe runs the same spec with `E2E_EXPECTED_FORMAT_NAME=__missing_format__` and treats nonzero Playwright exit as its expected result.
- [ ] Run `npx playwright install chromium && npm run e2e && npm run probe:e2e`; expect both commands to pass according to their control contracts.
- [ ] Commit with `test: add deterministic browser coverage`.

### Task 3: Control-feedback runner and release gate

**Files:**
- Create: `scripts/build-discipline/control-feedback.mjs`
- Create: `scripts/verify-release.mjs`
- Create: `scripts/deploy-production.mjs`
- Create: `scripts/negative-probes.mjs`
- Modify: `package.json`, `netlify.toml`, `src/__tests__/build-discipline.test.ts`

**Interfaces:**
- `runControlledSteps(steps, { cwd, reportPath }): Promise<{ status, steps }>`.
- `npm run verify:netlify` runs line caps, unit tests, typecheck, lint, and build.
- `npm run verify:release` adds browser E2E through the control-feedback runner.
- `npm run deploy:production -- --confirm` validates checkout, branch, and tracked cleanliness before pushing the deploy branch.

- [ ] Add failing tests: a successful fixture followed by a failing fixture must return `blocked` and never run its third fixture; the Netlify command must place `verify:netlify` before `prisma db push`.

```ts
const result = await runControlledSteps([
  { id: "pass", command: process.execPath, args: ["-e", "process.exit(0)"] },
  { id: "fail", command: process.execPath, args: ["-e", "process.exit(7)"] },
  { id: "must-not-run", command: process.execPath, args: ["-e", "process.exit(0)"] },
]);
assert.equal(result.status, "blocked");
assert.equal(result.steps.at(-1)?.id, "fail");
```

- [ ] Run `npx tsx --test src/__tests__/build-discipline.test.ts`; expect runner/config failure.
- [ ] Implement the runner, verification scripts, and guarded deploy command. The runner emits pass/block records and writes `.control-feedback/latest.json`. The deploy command rejects no `--confirm`, a linked worktree, wrong branch, or tracked diff before it runs validation or Git. It pushes only `claude/master-spec-consolidation-Y6XjM` after `verify:release` passes.

```js
export async function runControlledSteps(steps, options) {
  const results = [];
  for (const step of steps) {
    const result = await runChild(step, options.cwd);
    results.push(result);
    if (result.exitCode !== 0) return writeReport({ status: "blocked", steps: results }, options);
  }
  return writeReport({ status: "passed", steps: results }, options);
}
```

- [ ] Change Netlify to `npx prisma generate && npm run verify:netlify && npx prisma db push --skip-generate && npm run db:seed`. The build command inside `verify:netlify` builds before database mutation.
- [ ] Implement `verify:negative-probes` and run it. It must observe state failure, 501-line failure, wrong E2E label, controlled failure stopping downstream work, and an unconfirmed deploy stopping before Git or Netlify.
- [ ] Run `npm run verify:release`; expect line caps, state, unit tests, typecheck, lint, build, and browser E2E to pass with a control-feedback pass report.
- [ ] Commit with `feat: gate production releases`.

### Task 4: Final evidence

**Files:**
- Modify: `docs/STATE.md`

**Interfaces:**
- State records command results and names the next operating action: a user-operated UI/UX defect walkthrough.

- [ ] Run `npm test && npm run typecheck && npm run lint && npm run build && npm run e2e && npm run verify:negative-probes`.
- [ ] Run `git diff --check && git status --short`; expect no whitespace errors and only intended discipline files.
- [ ] Update `docs/STATE.md` with the exact verification evidence and commit with `docs: record build discipline verification`.
