# SCG-002: Yellow Ball Production Release

## Status

Active. Authorized by the owner on 2026-08-15.

## User Outcome

The user can select and complete Sunday Church Yellow Ball Skins in production.

## Scope

- Run only `npm run deploy:production -- --confirm` from primary `main`.
- Require the full release gate before any production database mutation.
- Require Netlify to run `prisma db push` and `npm run db:seed`.
- Verify the exact deployed commit and the format through `/api/formats`.
- Complete one disposable eight-player, two-team production round through scoring and cleanup.
- Restore Netlify automatic builds to stopped after the attended build.

## Authorization Boundary

Production deployment, schema synchronization, seeding, and one disposable Yellow Ball smoke round are authorized. No unrelated production data changes are authorized.

## Work Log

- 2026-08-15: The first gate run stopped before push because duplicate generated `node_modules/@types/* 2` folders broke typecheck. `npm ci` repaired the dependency tree and typecheck passed.
- 2026-08-15: The second gate passed all local checks and pushed `1ad00bc`, but Netlify's API-triggered build failed before checkout with `Host key verification failed`; no database or production mutation occurred and builds were restored to stopped.
- 2026-08-15: Replaced the failing API trigger with one Git-triggered build inside the attended gate. Red-green tests enforce exact-commit polling and stopped-build restoration after activation or push failures.
