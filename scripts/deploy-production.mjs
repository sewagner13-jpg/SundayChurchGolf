import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runControlledSteps } from "./build-discipline/control-feedback.mjs";
import { PRODUCTION_BRANCH } from "./build-discipline/release-config.mjs";

function run(command, args, { stdio = "pipe" } = {}) {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, { cwd: process.cwd(), stdio });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", (error) => resolveResult({ exitCode: 1, output: error.message }));
    child.once("close", (exitCode) => resolveResult({ exitCode: exitCode ?? 1, output }));
  });
}

async function assertPrimaryDeployCheckout() {
  const [gitDir, commonDir, branch, unstaged, staged] = await Promise.all([
    run("git", ["rev-parse", "--git-dir"]),
    run("git", ["rev-parse", "--git-common-dir"]),
    run("git", ["branch", "--show-current"]),
    run("git", ["diff", "--quiet"]),
    run("git", ["diff", "--cached", "--quiet"]),
  ]);
  if (gitDir.exitCode !== 0 || commonDir.exitCode !== 0) throw new Error("Deployment blocked: Git checkout is unavailable.");
  if (resolve(process.cwd(), gitDir.output.trim()) !== resolve(process.cwd(), commonDir.output.trim())) {
    throw new Error("Deployment blocked: run from the primary checkout, not a linked worktree.");
  }
  if (branch.output.trim() !== PRODUCTION_BRANCH) {
    throw new Error(`Deployment blocked: expected branch ${PRODUCTION_BRANCH}.`);
  }
  if (unstaged.exitCode !== 0 || staged.exitCode !== 0) {
    throw new Error("Deployment blocked: commit or stash tracked changes first.");
  }
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("Deployment blocked: pass --confirm after reviewing the release report.");
    process.exitCode = 1;
    return;
  }

  await assertPrimaryDeployCheckout();
  const head = await run("git", ["rev-parse", "HEAD"]);
  if (head.exitCode !== 0 || !head.output.trim()) {
    throw new Error("Deployment blocked: current commit is unavailable.");
  }
  const report = await runControlledSteps(
    [
      { id: "release-verification", command: process.execPath, args: ["scripts/verify-release.mjs"] },
      {
        id: "netlify-auto-build-check",
        command: process.execPath,
        args: ["scripts/netlify-production-build.mjs", "--check-config"],
      },
      { id: "push-deploy-branch", command: "git", args: ["push", "origin", PRODUCTION_BRANCH] },
      {
        id: "netlify-production-build",
        command: process.execPath,
        args: ["scripts/netlify-production-build.mjs"],
        env: { EXPECTED_COMMIT_SHA: head.output.trim() },
      },
    ],
    { reportPath: resolve(process.cwd(), ".control-feedback/deploy-production.json") }
  );
  if (report.status !== "passed") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
