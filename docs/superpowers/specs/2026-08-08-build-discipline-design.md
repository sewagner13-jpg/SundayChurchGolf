# Build Discipline Design

**Status:** Approved for implementation

## Purpose

Establish a local, repeatable release discipline before further UI/UX work. The
mechanisms must provide evidence that the application can be checked in a
browser, that oversized files cannot grow unchecked, and that production
release commands stop before a push or database mutation when validation fails.

This work does not change golf formats, scoring rules, or the visual design of
the application.

## State Contract

Add `docs/STATE.md` as the repository's concise operational reference. It will
identify the deploy branch, hosting provider, supported Node version, required
quality commands, the production release command, and the current line-cap
policy. A validator will require those named sections so an incomplete or stale
state document is rejected by the discipline suite.

`HANDOFF.md` remains historical context. `docs/STATE.md` is the current
operating contract and corrects its obsolete Vercel deployment references.

## Line-Cap Policy

Production TypeScript and TSX files, including tests, have a default cap of
500 lines. The current files over that limit form a checked-in legacy baseline:
each baseline entry records its present maximum line count, and the file can
only stay the same size or shrink. Any new file, renamed file, or unlisted
existing file over 500 lines fails the check.

The checker exposes a programmatic API and a command-line entrypoint. The unit
test uses a 501-line fixture to prove the command blocks an over-cap file.
This preserves delivery momentum for the planned UI work while preventing the
existing large modules from growing further.

## Browser E2E

Add Playwright with a deterministic browser test for the new-round format
selector. The test starts the local Next.js app and intercepts its data API
requests with fixtures, so it never reads or writes a production database. It
asserts that a user can load the selector and choose a seeded format.

The browser test accepts an expected-format environment override used only by
the negative-probe command. The normal suite expects the real label; the
negative probe supplies a deliberately nonexistent label and asserts that
Playwright exits nonzero. This demonstrates that the E2E assertion is capable
of detecting a broken UI rather than merely starting a browser.

## Control and Feedback

Add a control-feedback runner for release steps. Each controlled command has a
stable identifier, runs as a child process, emits a concise pass or block
record with duration, and stops the remaining steps on the first failure. It
writes the latest structured report under an ignored local directory for
operator inspection.

An enforcement test will use a successful fixture command followed by a failing
fixture command and prove that the configured next command is not run. This
keeps feedback tied to an executable control rather than a written checklist.

## Release Gates

Add the following command layers:

- `check:line-caps`: line-cap policy only.
- `e2e`: deterministic Playwright browser test.
- `verify:netlify`: line caps, unit tests, typecheck, lint, and build. It does
  not run browser tests because a Netlify build environment has no supported
  browser fixture runtime.
- `verify:release`: the Netlify checks plus browser E2E, executed through the
  control-feedback runner.
- `deploy:production -- --confirm`: rejects missing confirmation, linked
  worktrees, an unexpected branch, uncommitted tracked changes, or failed
  release verification before running `git push` for the deploy branch.

The Netlify build command will run `prisma generate`, then `verify:netlify`,
before `prisma db push` and `db:seed`. A direct push therefore cannot activate
code that fails the non-browser quality gate, and database writes occur only
after that gate passes. The local deploy command uses the Git deployment path,
not a direct Netlify CLI upload.

The enforcement test will validate the package scripts and Netlify command
ordering. A negative probe invokes `deploy:production` without `--confirm` and
asserts it stops before it can push.

## Negative-Probe Suite

`verify:negative-probes` will execute the following expected failures and
return success only when each mechanism rejects its invalid input:

1. An incomplete state-document fixture fails validation.
2. A 501-line TypeScript fixture fails the line-cap check.
3. The browser selector fails when asked to find a nonexistent format label.
4. A controlled command failure blocks its configured downstream step.
5. A production deploy without `--confirm` stops before any Git or Netlify
   command is run.

## Verification

Implementation is complete only after the discipline tests, existing unit
tests, typecheck, lint, browser E2E, negative-probe suite, and production build
all pass. Production deployment remains a separate user approval.
