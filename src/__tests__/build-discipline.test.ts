import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkLineCaps } from "../../scripts/build-discipline/line-caps.mjs";
import { runControlledSteps } from "../../scripts/build-discipline/control-feedback.mjs";
import { validateReleaseConfiguration } from "../../scripts/build-discipline/release-config.mjs";
import { validateStateDocument } from "../../scripts/build-discipline/state.mjs";
import { findUnitTests } from "../../scripts/run-unit-tests.mjs";

test("state validator rejects a document missing the release topology", () => {
  assert.deepEqual(validateStateDocument("# Sunday Church Golf State\n"), [
    "Missing required section: ## Release Topology",
    "Missing required section: ## Quality Gates",
    "Missing required section: ## Browser Coverage",
    "Missing required section: ## Line-Cap Policy",
    "Missing required section: ## Operating Mode",
  ]);
});

test("line-cap checker rejects a new 501-line TypeScript file", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "sunday-church-line-cap-"));
  const sourceDir = join(rootDir, "src");

  try {
    await mkdir(sourceDir);
    await writeFile(join(sourceDir, "too-large.ts"), "export const value = 1;\n".repeat(501));

    assert.deepEqual(await checkLineCaps({ rootDir, baseline: {}, defaultCap: 500 }), [
      { path: "src/too-large.ts", lines: 501, maxLines: 500 },
    ]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("unit test discovery is recursive without relying on shell glob expansion", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "sunday-church-unit-tests-"));
  const testDir = join(rootDir, "src/__tests__");

  try {
    await mkdir(join(testDir, "nested"), { recursive: true });
    await writeFile(join(testDir, "z.test.ts"), "");
    await writeFile(join(testDir, "nested/a.test.ts"), "");
    await writeFile(join(testDir, "nested/ignore.ts"), "");

    assert.deepEqual(await findUnitTests(testDir), [
      join(testDir, "nested/a.test.ts"),
      join(testDir, "z.test.ts"),
    ]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("control-feedback stops before a configured downstream command", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "sunday-church-control-feedback-"));
  const marker = join(rootDir, "must-not-run");

  try {
    const result = await runControlledSteps(
      [
        { id: "pass", command: process.execPath, args: ["-e", "process.exit(0)"] },
        { id: "fail", command: process.execPath, args: ["-e", "process.exit(7)"] },
        {
          id: "must-not-run",
          command: process.execPath,
          args: ["-e", `require(\"node:fs\").writeFileSync(${JSON.stringify(marker)}, \"ran\")`],
        },
      ],
      { cwd: rootDir, reportPath: join(rootDir, "report.json") }
    );

    assert.equal(result.status, "blocked");
    assert.deepEqual(result.steps.map((step: { id: string }) => step.id), ["pass", "fail"]);
    await assert.rejects(access(marker));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("release configuration rejects database mutation before the quality gate", () => {
  assert.deepEqual(
    validateReleaseConfiguration({
      scripts: {
        "verify:netlify": "node scripts/verify-release.mjs --netlify",
        "verify:release": "node scripts/verify-release.mjs",
        "deploy:production": "node scripts/deploy-production.mjs",
        lint: "eslint . --ignore-pattern '.worktrees/**'",
      },
      netlifyBuildCommand:
        "npx prisma generate && npx prisma db push --skip-generate && npm run verify:netlify",
    }),
    ["Netlify must run verify:netlify before prisma db push."]
  );
});

test("release configuration rejects linting linked worktrees", () => {
  assert.deepEqual(
    validateReleaseConfiguration({
      scripts: {
        "verify:netlify": "node scripts/verify-release.mjs --netlify",
        "verify:release": "node scripts/verify-release.mjs",
        "deploy:production": "node scripts/deploy-production.mjs",
        lint: "eslint .",
      },
      netlifyBuildCommand:
        "npx prisma generate && npm run verify:netlify && npx prisma db push --skip-generate",
    }),
    ["Lint script must exclude linked worktrees."]
  );
});
