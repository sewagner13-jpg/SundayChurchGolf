# SCG-005 — Code-only release gate

Status: prepared and tested locally on `code-only-release-20261101`; not pushed or deployed.

## Change

The Netlify build now only runs `npx prisma generate && npm run verify:netlify`. Prisma generation creates the local client; it does not change the database. The release validator accepts exactly this command and rejects appended commands, alternate script aliases, schema sync, migrations, seeds and resets. The corresponding unit tests and negative probes replace the old seed-required policy.

The attended deployment, main-branch requirement, clean-checkout check, automatic-build stop check, exact commit identity and post-deploy format smoke checks remain in place. No Prisma schema, migration, seed, dependency, connection string or hosted configuration changed.

## Verification

- Regression tests failed against the old validator, then passed after the change.
- Full Node 20.19.4 release verification passed: 197 unit tests, typecheck, lint (51 existing warnings, zero errors), production build and 7 Playwright tests.
- All negative probes passed, including the new database-command rejection probe.
- Local packaging passed with Netlify CLI 27.1.1, `@netlify/build` 36.4.8 and Next.js Runtime 5.16.5, using `netlify build --offline --context production` under Node 20.19.4. Both database URLs pointed at dummy local port 1; no production environment pull, deployment or database operation occurred.
- The generated `.netlify/netlify.toml` contains the code-only command. The Next.js server handler and its approximately 39 MB ZIP were generated locally under ignored `.netlify/` paths.
- A local production server with fixtures disabled returned HTTP 404 for all four `/e2e/` fixture routes.

Local evidence is in the parent workspace: `code-only-release-node20.log`, `code-only-negative-probes.log`, and `code-only-netlify-packaging.log`.

## Read-only production findings

Netlify site `6b411aac-31d6-463d-8f59-de1289a2d9f7` still has automatic builds stopped and published deploy `6a81a14ea3bffef87ae12014`. The published deploy title identifies commit `b4b32c35e956d77bd8d444682aace1b13f76f2f1`; Prisma files are unchanged from that commit through merged scoring commit `d2ce9991692b3023338e6609d0909f0f46e4088b`.

The existing production connection strings remain unchanged and route endpoint `ep-billowing-bread-ahk9ehmd` to the currently serving branch `br-old-credit-ah99dlge` (named `production`, primary/default), database `neondb`, project `flat-violet-56138252`. Original branch `br-late-hall-ahcuero3` remains preserved with endpoint `ep-cold-glade-ahl3zaro`.

## Recovery evidence and incident

Snapshot `snap-super-dew-aha4ennd` was created at 2026-11-01 03:56:59 UTC and expires 2026-11-08 04:00 UTC. The attempted rehearsal mistakenly passed `finalize: true`, which switched production endpoint/default/name onto the restored branch. This was reported; do not repeat it or attempt to reverse topology as part of this release.

Subsequent read-only checks found all 25 non-system tables equal between branches, all 16 application tables unchanged from the pre-snapshot baseline, and matching columns, constraints, indexes and enums. The public app read checks passed at 04:03 UTC. These are point-in-time observations, not a guarantee that no subsequent writes exist.

Sean's current instruction is to keep the serving database and both branches in place. No further recovery branch, snapshot restore, endpoint movement, name/default change or cleanup is required for the code-only app release. Never treat a provider restore finalization as an isolated rehearsal: it moves endpoints and replaces branch identity.

## Proposed deployment procedure — requires authorization

1. Review this local diff; commit it on a release branch, then record the new full release SHA containing `d2ce999`. Recheck stopped automatic builds before any authorized push/merge. Use skip-Netlify markers for repository publication.
2. Confirm the new SHA is on clean primary `main`, rerun `npm run verify:release` and `npm run verify:negative-probes` under Node 20, and repeat local adapter packaging for that exact committed state. Keep fixtures disabled and do not publish the dummy-URL packaging artifact.
3. Review the snapshot/incident evidence, confirm the currently serving branch and both copies remain in place, automatic builds remain stopped, and the resolved production build command is the code-only command. Make no hosted configuration or connection-string edits.
4. After explicit attended deployment authorization, run `npm run deploy:production -- --confirm` from the clean primary checkout. This gate pins CLI 27.1.1/Node 20.19.4, rebuilds using the reviewed code-only configuration and verifies the full release SHA in the deploy identity. Do not use `--no-build` with stale output.
5. Confirm ready deployment identity, HTTP 200 home and formats responses, required format presence, fixture HTTP 404, and stopped automatic builds. Inspect a real phone scoring screen read-only without editing an existing round.
6. On failure, stop and report the exact stage. Do not run schema sync/seed or restore/overwrite the production database. For a published code defect, prepare a reviewed forward correction using the same code-only gate.

Repository publication was approved previously but is paused pending the money-safety review. Attended deployment still needs separate explicit approval. No release publication or deployment is performed by this preparation task.
