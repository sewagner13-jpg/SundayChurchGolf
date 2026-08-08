import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runControlledSteps } from "./build-discipline/control-feedback.mjs";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function npmStep(id, script) {
  return { id, command: npmCommand, args: ["run", script] };
}

export async function verifyRelease({ netlify = false } = {}) {
  const steps = [
    npmStep("state", "check:state"),
    npmStep("line-caps", "check:line-caps"),
    npmStep("release-config", "check:release-config"),
    npmStep("unit-tests", "test"),
    npmStep("typecheck", "typecheck"),
    npmStep("lint", "lint"),
    npmStep("build", "build"),
  ];
  if (!netlify) steps.push(npmStep("browser-e2e", "e2e"));
  return runControlledSteps(steps, {
    reportPath: resolve(process.cwd(), ".control-feedback/latest.json"),
  });
}

async function main() {
  const report = await verifyRelease({ netlify: process.argv.includes("--netlify") });
  if (report.status !== "passed") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
