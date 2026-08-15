import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkLineCaps } from "../../scripts/build-discipline/line-caps.mjs";
import { runControlledSteps } from "../../scripts/build-discipline/control-feedback.mjs";
import {
  validateProductionBranch,
  validateReleaseConfiguration,
} from "../../scripts/build-discipline/release-config.mjs";
import { validateStateDocument } from "../../scripts/build-discipline/state.mjs";
import {
  assertAutomaticBuildsStopped,
  runNetlifyProductionBuild,
  validateProductionFormats,
} from "../../scripts/netlify-production-build.mjs";
import { findUnitTests } from "../../scripts/run-unit-tests.mjs";

const GATED_DEPLOY_SOURCE = "node scripts/netlify-production-build.mjs";

test("state validator rejects a document missing the release topology", () => {
  assert.deepEqual(validateStateDocument("# Sunday Church Golf State\n"), [
    "Missing required section: ## Release Topology",
    "Missing required section: ## Quality Gates",
    "Missing required section: ## Browser Coverage",
    "Missing required section: ## Line-Cap Policy",
    "Missing required section: ## Operating Mode",
  ]);
});

test("state validator rejects documents over 150 lines", () => {
  const headings = [
    "# Sunday Church Golf State",
    "## Release Topology",
    "## Quality Gates",
    "## Browser Coverage",
    "## Line-Cap Policy",
    "## Operating Mode",
  ];
  const document = [...headings, ...Array.from({ length: 145 }, () => "state")].join("\n");

  assert.deepEqual(validateStateDocument(document), [
    "docs/STATE.md exceeds the 150-line limit (151 lines).",
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
        "npx prisma generate && npx prisma db push --skip-generate && npm run verify:netlify && npm run db:seed",
      deployProductionSource: GATED_DEPLOY_SOURCE,
    }),
    ["Netlify must run verify:netlify before prisma db push."]
  );
});

test("release configuration requires database seeding after schema sync", () => {
  assert.deepEqual(
    validateReleaseConfiguration({
      scripts: {
        "verify:netlify": "node scripts/verify-release.mjs --netlify",
        "verify:release": "node scripts/verify-release.mjs",
        "deploy:production": "node scripts/deploy-production.mjs",
        lint: "eslint . --ignore-pattern '.worktrees/**'",
      },
      netlifyBuildCommand:
        "npx prisma generate && npm run verify:netlify && npx prisma db push --skip-generate",
      deployProductionSource: GATED_DEPLOY_SOURCE,
    }),
    ["Netlify build command must run db:seed after prisma db push."]
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
        "npx prisma generate && npm run verify:netlify && npx prisma db push --skip-generate && npm run db:seed",
      deployProductionSource: GATED_DEPLOY_SOURCE,
    }),
    ["Lint script must exclude linked worktrees."]
  );
});

test("release configuration rejects any production branch other than main", () => {
  assert.deepEqual(validateProductionBranch("claude/master-spec-consolidation-Y6XjM"), [
    "Production releases must use the main branch.",
  ]);
  assert.deepEqual(validateProductionBranch("main"), []);
});

test("release configuration requires an attended Netlify production build", () => {
  assert.deepEqual(
    validateReleaseConfiguration({
      scripts: {
        "verify:netlify": "node scripts/verify-release.mjs --netlify",
        "verify:release": "node scripts/verify-release.mjs",
        "deploy:production": "node scripts/deploy-production.mjs",
        lint: "eslint . --ignore-pattern '.worktrees/**'",
      },
      netlifyBuildCommand:
        "npx prisma generate && npm run verify:netlify && npx prisma db push --skip-generate && npm run db:seed",
      deployProductionSource: "git push origin main",
    }),
    ["Production deploy gate must run the attended Netlify production build."]
  );
});

test("attended Netlify build verifies the exact commit and seeded format", async () => {
  const calls: string[] = [];
  let buildsStopped = true;
  const api = async (method: string, data?: Record<string, unknown>) => {
    const stopped = (data?.body as { build_settings?: { stop_builds?: boolean } } | undefined)
      ?.build_settings?.stop_builds;
    calls.push(stopped === undefined ? method : `${method}:${stopped}`);
    if (method === "getSite") return { build_settings: { stop_builds: buildsStopped } };
    if (method === "updateSite") {
      buildsStopped = stopped ?? buildsStopped;
      return { build_settings: { stop_builds: buildsStopped } };
    }
    if (method === "createSiteBuild") return { id: "build-1", deploy_id: "deploy-1" };
    if (method === "getSiteBuild") return { done: true, deploy_id: "deploy-1" };
    return { state: "ready", commit_ref: "abc123" };
  };
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    return {
      ok: true,
      status: 200,
      json: async () =>
        url.includes("/api/formats")
          ? [{ definitionId: "sunday_church_yellow_ball_skins" }]
          : {},
    } as Response;
  }) as typeof fetch;

  assert.deepEqual(
    await runNetlifyProductionBuild({
      expectedCommitSha: "abc123",
      api,
      fetchImpl,
      attempts: 1,
      intervalMs: 0,
    }),
    { buildId: "build-1", deployId: "deploy-1", commitSha: "abc123" }
  );
  assert.deepEqual(calls, [
    "getSite",
    "updateSite:false",
    "getSite",
    "createSiteBuild",
    "getSiteBuild",
    "getSiteDeploy",
    "updateSite:true",
    "getSite",
  ]);
});

test("attended Netlify build restores stopped builds after a failed trigger", async () => {
  const calls: string[] = [];
  let buildsStopped = true;
  const api = async (method: string, data?: Record<string, unknown>) => {
    const stopped = (data?.body as { build_settings?: { stop_builds?: boolean } } | undefined)
      ?.build_settings?.stop_builds;
    calls.push(stopped === undefined ? method : `${method}:${stopped}`);
    if (method === "getSite") return { build_settings: { stop_builds: buildsStopped } };
    if (method === "updateSite") {
      buildsStopped = stopped ?? buildsStopped;
      return { build_settings: { stop_builds: buildsStopped } };
    }
    throw new Error("forced build trigger failure");
  };

  await assert.rejects(
    () => runNetlifyProductionBuild({ expectedCommitSha: "abc123", api }),
    /forced build trigger failure/
  );
  assert.deepEqual(calls, [
    "getSite",
    "updateSite:false",
    "getSite",
    "createSiteBuild",
    "updateSite:true",
    "getSite",
  ]);
});

test("attended Netlify build restores stopped builds after activation verification fails", async () => {
  const calls: string[] = [];
  let buildsStopped = true;
  let getSiteCount = 0;
  const api = async (method: string, data?: Record<string, unknown>) => {
    const stopped = (data?.body as { build_settings?: { stop_builds?: boolean } } | undefined)
      ?.build_settings?.stop_builds;
    calls.push(stopped === undefined ? method : `${method}:${stopped}`);
    if (method === "updateSite") {
      buildsStopped = stopped ?? buildsStopped;
      return { build_settings: { stop_builds: buildsStopped } };
    }
    if (method === "getSite") {
      getSiteCount += 1;
      if (getSiteCount === 2) throw new Error("forced activation verification failure");
      return { build_settings: { stop_builds: buildsStopped } };
    }
    throw new Error(`Unexpected API call: ${method}`);
  };

  await assert.rejects(
    () => runNetlifyProductionBuild({ expectedCommitSha: "abc123", api }),
    /forced activation verification failure/
  );
  assert.deepEqual(calls, [
    "getSite",
    "updateSite:false",
    "getSite",
    "updateSite:true",
    "getSite",
  ]);
});

test("attended deploy refuses to race Netlify automatic Git builds", async () => {
  await assert.rejects(
    () =>
      assertAutomaticBuildsStopped({
        api: async () => ({ build_settings: { stop_builds: false } }),
      }),
    /automatic Git builds must be stopped/i
  );
});

test("production format smoke validation fails closed", () => {
  assert.equal(validateProductionFormats([]), false);
  assert.equal(validateProductionFormats([{ definitionId: "default-sunday-church" }]), false);
  assert.equal(
    validateProductionFormats([{ definitionId: "sunday_church_yellow_ball_skins" }]),
    true
  );
});
