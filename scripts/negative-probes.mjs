import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runControlledSteps } from "./build-discipline/control-feedback.mjs";
import { checkLineCaps } from "./build-discipline/line-caps.mjs";
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

async function main() {
  await probeState();
  await probeLineCap();
  await probeControlFeedback();
  await expectFailure("browser-e2e", npmCommand, ["exec", "playwright", "test"], {
    E2E_EXPECTED_FORMAT_NAME: "__missing_format__",
  });
  await expectFailure("deploy-confirmation", process.execPath, ["scripts/deploy-production.mjs"]);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
