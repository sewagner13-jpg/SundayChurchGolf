# SCG-004 — Phone scoring and saved partner scores

Status: validated locally; production release pending.

## Behavior

- Current-hole shots, saved gross/net scores, cross-cart partner names, and applicable games appear above score entry.
- The score-entry shortcut and main panel controls have phone-size targets. The full 18-hole stroke allocation is collapsed on the live scoring screen.
- Saved scores refresh every 10 seconds and on focus/manual refresh. Refresh does not overwrite local score-entry drafts; stale hole responses are discarded and blind visibility fails closed.
- Cross-Foursome and Cross-Threesome holes require all partners' scores before a winner or tie is declared. Games with zero completed holes have no projected winner or payout.
- The recovered candidate also includes shared burger selection, cross-cart partner draw, net/gross setup and locked handicap choices. Existing rounds retain legacy defaults.

## Reconciliation and checks

The recovered Library patch applies cleanly to full repository main `973a4370100d7b07868b6d37e98ecaa13628ac99`. No schema, migration, seed, dependency-lock or production configuration changes were needed.

The Cross-Foursome engine exceeded the 500-line cap. Types were extracted to `src/lib/cross-foursome-types.ts`; the engine is now 444 lines and the cap is unchanged. Five new-test lint errors were corrected without disabling rules.

An additional Cross-Threesome defect was reproduced with failing regression tests: only one cart's scores could count as a complete hole and zero played holes could show payouts. The same completeness protections now cover both cross-group formats.

`npm run verify:release` passes: state, line caps, release config, 189 unit tests, full-app typecheck, lint (51 warnings, zero errors), production build, and 7 Playwright tests. `npm run verify:negative-probes` passes all guarded failure probes. The intentionally failed browser test in that command is expected evidence of the gate working.

The new browser fixture mounts the real partner panel and uses the real scoring engine at 320x844 and 390x844. It proves no document overflow, >=44px panel controls, gross/net values, pending-to-complete behavior, blind hiding, segment switching, and draft preservation. Saved records are simulated in this fixture; it does not prove production persistence, the full live-round screen or two-device database concurrency. Server-action visibility and refresh cancellation have separate unit coverage.

## Release investigation — no production action taken

Read-only Netlify inspection on 2026-11-01 confirmed site `6b411aac-31d6-463d-8f59-de1289a2d9f7`, repository `sewagner13-jpg/SundayChurchGolf`, branch `main`, automatic builds stopped (`stop_builds: true`), and existing published deploy `6a81a14ea3bffef87ae12014`.

The checked-in Netlify build command performs `prisma db push` and `db:seed`. `scripts/build-discipline/release-config.mjs` explicitly requires those operations, and negative probes require the seed gate. The attended deployment script invokes this configuration. None of those commands were run, and neither production settings nor live rounds were changed.

A code-only release requires a separately reviewed change to the build command and its validator/probes so it generates Prisma, runs verification and packages the Next.js application without schema sync or seed. The release must still enforce exact commit identity, stopped automatic builds, attended authorization and post-deploy smoke checks. Uploading `.next` alone is not a validated replacement for Netlify's Next.js adapter packaging.

Before any production release: verify the production database mapping and recovery point, approve the code-only gate change, test the Netlify adapter packaging under that gate, then authorize the attended release. Production database mapping/recovery and code-only Netlify packaging remain unverified. This candidate needs no database data transformation.
