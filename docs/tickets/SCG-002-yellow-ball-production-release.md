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
