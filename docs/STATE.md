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
