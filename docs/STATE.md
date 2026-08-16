# Sunday Church Golf State

## Release Topology

- Hosting: Netlify
- Deploy branch: `main`
- Production deployment: run `npm run deploy:production -- --confirm` from a clean primary checkout on `main`.
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

- Active ticket: none.
- Last completed ticket: `SCG-003` - Yellow Ball handicap map.
- Outcome: teams can compare every player's relative handicap shots by hole while choosing and using the Yellow Ball order.
- Branch of truth: `main`.
- Deployment requires a new attended approval and must use the production gate.
- Ticket record: `docs/tickets/SCG-003-yellow-ball-handicap-map.md`.

## Verification Evidence

- `npm run verify:release` passed on 2026-08-08: state, line caps, release configuration, 89 unit tests, typecheck, lint with 43 existing warnings and no errors, production build, and Playwright E2E.
- `npm run verify:negative-probes` passed on 2026-08-08: malformed state, a 501-line source file, an impossible browser expectation, a failed controlled command, and an unconfirmed deployment each blocked as required.
- The browser test uses intercepted `/api/courses` and `/api/formats` fixtures and does not require `DATABASE_URL`.
- `npm run verify:release` passed on 2026-08-08 after handicap visibility work: 90 unit tests, typecheck, lint with 43 existing warnings and no errors, production build, and 2 Playwright tests.
- `npm run verify:negative-probes` passed after handicap visibility work; every expected state, line-cap, control-feedback, browser, and deploy-confirmation failure blocked correctly.
- The handicap browser fixture passed at desktop and 390x844 phone widths. The phone page stayed within the viewport, all 4 group players rendered, and only the 18-hole table scrolled horizontally.
- The production build returned HTTP 404 for `/e2e/handicap-strokes` without `E2E_FIXTURES=1`.
- `npm run verify:release` passed after the Netlify preview fix: 91 unit tests, typecheck, lint with 43 existing warnings and no errors, production build, and 3 Playwright tests.
- Unit tests are discovered recursively by `scripts/run-unit-tests.mjs`; the release no longer depends on shell-specific glob expansion.
- The Cross-Threesome sandbox browser test covers gross score entry, relative handicap strokes, best-net match play, two-tie-all-tie outcomes, and a $30-per-player payout breakdown.
- `npm run verify:negative-probes` passed after the preview fix; all five guarded failure paths blocked correctly.
- Primary-checkout release verification passed with 92 unit tests and 3 Playwright tests after excluding `.worktrees/**` from lint; the release-config test rejects removal of that exclusion.
- Production Cross-Threesome verification found and fixed a final-payout display defect: recorded per-player payouts now remain authoritative for cross-group games instead of being re-split across physical playing groups.
- The payout regression probe failed with `[30, 30, 30, 30]` before the fix and passed with the recorded `[60, 30, 15, 15]` distribution after the fix.
- `npm run verify:release` passed for the payout correction with 93 unit tests, typecheck, lint with 43 existing warnings and no errors, production build, and 3 Playwright tests; all guarded negative probes also passed.
- SCG-001 release verification passed with 117 unit tests, typecheck, lint with the same 43 warnings and no errors, production build, and 5 Playwright tests including Yellow Ball desktop and 390x844 coverage.
- SCG-001 negative probes proved state, line-cap, control-feedback, seed-order, branch, expected-commit, browser, and deploy-confirmation gates fail closed. Netlify activation, trigger failure, and restoration paths were separately proven red then green.
- Before SCG-002, production remained at commit `85ea086`; SCG-001 had not yet been deployed or seeded.
- SCG-001 was fast-forwarded into local `main` after release verification and independent review. Push and production deployment remain separately gated.
- SCG-002 API checkout failed with `Host key verification failed`, and the Git webhook produced no build. Production and the database remained unchanged. The release gate now uses a manual Netlify CLI production deploy while automatic builds stay stopped.
- The first manual CLI deploy published and seeded production, but failed closed because Netlify leaves `commit_ref` empty for CLI deploys. The gate now requires the exact full commit SHA in the manual deploy title and rejects abbreviated or mismatched titles.
- SCG-002 gated deployment passed on 2026-08-15 with 119 unit tests, typecheck, lint with 43 existing warnings and no errors, production build, and 5 Playwright tests. Netlify deploy `6a81102bea98cba787dc3ea2` is ready for commit `28ea251419e8d50b8a8aa19c56ec591ab14350d7`; schema sync and seed ran in the production build, `/api/formats` includes Yellow Ball, and automatic builds remain stopped.
- Production UI verification showed Sunday Church Yellow Ball Skins selectable with handicaps enabled by default. The disposable production round is blocked by the existing user-owned draft `cmsuqvycj0001la09ri2bq1fr` (12 players, 3 teams, $30 buy-in); the one-active-round guard was preserved and the draft was not changed.
- SCG-003 release verification passed with 122 unit tests, typecheck, lint with 43 existing warnings and no errors, production build, and 5 browser tests. Dot sizing and the sticky handicap player column were each proven red before restoration and green afterward.
- Production deploy `6a81a14ea3bffef87ae12014` is ready for exact commit `b4b32c35e956d77bd8d444682aace1b13f76f2f1`; live HTTP returned 200 and automatic builds remain stopped.
- Live round `cmsvpapkh0001jt09ia7sx74t` was already Sunday Church Yellow Ball Skins with handicaps enabled. The live screen showed all four team players' dot map above the unlocked order, with 0/18 scores; no score, order, roster, team, or round mutation was made.
