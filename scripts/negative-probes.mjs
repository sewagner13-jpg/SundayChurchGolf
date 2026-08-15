import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runControlledSteps } from "./build-discipline/control-feedback.mjs";
import { checkLineCaps } from "./build-discipline/line-caps.mjs";
import { validateReleaseConfiguration } from "./build-discipline/release-config.mjs";
import { validateStateDocument } from "./build-discipline/state.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, env = {}) {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, { cwd: rootDir, env: { ...process.env, ...env }, stdio: "inherit" });
    child.once("error", () => resolveResult(1));
    child.once("close", (exitCode) => resolveResult(exitCode ?? 1));
  });
}

async function expectFailure(id, command, args, env) {
  const exitCode = await run(command, args, env);
  if (exitCode === 0) throw new Error(`${id} negative probe unexpectedly passed.`);
  console.log(`NEGATIVE PROBE PASSED ${id}`);
}

async function probeState() {
  if (validateStateDocument("# Sunday Church Golf State\n").length === 0) {
    throw new Error("state negative probe unexpectedly passed.");
  }
  console.log("NEGATIVE PROBE PASSED state");
}

async function probeStateLineCap() {
  const headings = [
    "# Sunday Church Golf State",
    "## Release Topology",
    "## Quality Gates",
    "## Browser Coverage",
    "## Line-Cap Policy",
    "## Operating Mode",
  ];
  const document = [...headings, ...Array.from({ length: 145 }, () => "state")].join("\n");
  if (!validateStateDocument(document).some((error) => error.includes("150-line limit"))) {
    throw new Error("state line-cap negative probe unexpectedly passed.");
  }
  console.log("NEGATIVE PROBE PASSED state-line-cap");
}

async function probeLineCap() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "sunday-church-negative-line-cap-"));
  try {
    await mkdir(join(fixtureRoot, "src"));
    await writeFile(join(fixtureRoot, "src/too-large.ts"), "export const value = 1;\n".repeat(501));
    if ((await checkLineCaps({ rootDir: fixtureRoot, baseline: {}, defaultCap: 500 })).length === 0) {
      throw new Error("line-cap negative probe unexpectedly passed.");
    }
    console.log("NEGATIVE PROBE PASSED line-cap");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

async function probeControlFeedback() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "sunday-church-negative-control-"));
  const marker = join(fixtureRoot, "downstream-ran");
  try {
    const report = await runControlledSteps(
      [
        { id: "fail", command: process.execPath, args: ["-e", "process.exit(1)"] },
        { id: "downstream", command: process.execPath, args: ["-e", `require(\"node:fs\").writeFileSync(${JSON.stringify(marker)}, \"ran\")`] },
      ],
      { cwd: fixtureRoot, reportPath: join(fixtureRoot, "report.json"), stdio: "ignore" }
    );
    if (report.status !== "blocked") throw new Error("control-feedback negative probe unexpectedly passed.");
    await access(marker).then(
      () => {
        throw new Error("control-feedback ran a blocked downstream step.");
      },
      () => undefined
    );
    console.log("NEGATIVE PROBE PASSED control-feedback");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

async function probeDatabaseSeedGate() {
  const errors = validateReleaseConfiguration({
    scripts: {
      "verify:netlify": "node scripts/verify-release.mjs --netlify",
      "verify:release": "node scripts/verify-release.mjs",
      "deploy:production": "node scripts/deploy-production.mjs",
      lint: "eslint . --ignore-pattern '.worktrees/**'",
    },
    netlifyBuildCommand:
      "npx prisma generate && npm run verify:netlify && npx prisma db push --skip-generate",
    deployProductionSource: "node scripts/netlify-production-build.mjs",
  });
  if (!errors.some((error) => error.includes("db:seed after prisma db push"))) {
    throw new Error("database seed gate negative probe unexpectedly passed.");
  }
  console.log("NEGATIVE PROBE PASSED database-seed-gate");
}

async function probeNetlifyProductionBuildGate() {
  const errors = validateReleaseConfiguration({
    scripts: {
      "verify:netlify": "node scripts/verify-release.mjs --netlify",
      "verify:release": "node scripts/verify-release.mjs",
      "deploy:production": "node scripts/deploy-production.mjs",
      lint: "eslint . --ignore-pattern '.worktrees/**'",
    },
    netlifyBuildCommand:
      "npm run verify:netlify && npx prisma db push --skip-generate && npm run db:seed",
    deployProductionSource: "git push origin main",
  });
  if (!errors.some((error) => error.includes("attended Netlify production build"))) {
    throw new Error("Netlify production build gate negative probe unexpectedly passed.");
  }
  console.log("NEGATIVE PROBE PASSED netlify-production-build-gate");
}

async function main() {
  await probeState();
  await probeStateLineCap();
  await probeLineCap();
  await probeControlFeedback();
  await probeDatabaseSeedGate();
  await probeNetlifyProductionBuildGate();
  await expectFailure("production-branch", process.execPath, ["scripts/build-discipline/release-config.mjs"], {
    PRODUCTION_BRANCH_PROBE: "claude/master-spec-consolidation-Y6XjM",
  });
  await expectFailure(
    "netlify-expected-commit",
    process.execPath,
    ["scripts/netlify-production-build.mjs"],
    { EXPECTED_COMMIT_SHA: "" }
  );
  await expectFailure("browser-e2e", npmCommand, ["exec", "playwright", "test"], {
    E2E_EXPECTED_FORMAT_NAME: "__missing_format__",
  });
  await expectFailure("deploy-confirmation", process.execPath, ["scripts/deploy-production.mjs"]);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
