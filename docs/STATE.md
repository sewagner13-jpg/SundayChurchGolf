# Sunday Church Golf State

## Release Topology

- Hosting: Netlify
- Deploy branch: `claude/master-spec-consolidation-Y6XjM`
- Production deployment: push the deploy branch through `npm run deploy:production -- --confirm` from the primary checkout.
- Runtime: Netlify builds with Node 20.

## Quality Gates

- `npm run check:state`
- `npm run check:line-caps`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run e2e`
- `npm run verify:negative-probes`

## Browser Coverage

The Playwright suite runs against a local Next.js server with intercepted API fixtures. It never requires or writes a production database.

## Line-Cap Policy

New JavaScript, TypeScript, and TSX source files are capped at 500 lines. The checked-in baseline lists legacy files already above that cap; those files may shrink but may not grow.

## Operating Mode

Finish build-discipline controls before the user-operated UI/UX defect walkthrough. The user operates the application; the agent diagnoses and fixes verified defects.

## Verification Evidence

- `npm run verify:release` passed on 2026-08-08: state, line caps, release configuration, 89 unit tests, typecheck, lint with 43 existing warnings and no errors, production build, and Playwright E2E.
- `npm run verify:negative-probes` passed on 2026-08-08: malformed state, a 501-line source file, an impossible browser expectation, a failed controlled command, and an unconfirmed deployment each blocked as required.
- The browser test uses intercepted `/api/courses` and `/api/formats` fixtures and does not require `DATABASE_URL`.
- `npm run verify:release` passed on 2026-08-08 after handicap visibility work: 90 unit tests, typecheck, lint with 43 existing warnings and no errors, production build, and 2 Playwright tests.
- `npm run verify:negative-probes` passed after handicap visibility work; every expected state, line-cap, control-feedback, browser, and deploy-confirmation failure blocked correctly.
- The handicap browser fixture passed at desktop and 390x844 phone widths. The phone page stayed within the viewport, all 4 group players rendered, and only the 18-hole table scrolled horizontally.
- The production build returned HTTP 404 for `/e2e/handicap-strokes` without `E2E_FIXTURES=1`.
