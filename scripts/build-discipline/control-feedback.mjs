import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

function runChild(step, { cwd, stdio }) {
  const startedAt = new Date().toISOString();
  const started = performance.now();

  return new Promise((resolveResult) => {
    const child = spawn(step.command, step.args ?? [], {
      cwd,
      env: { ...process.env, ...step.env },
      stdio,
    });

    child.once("error", (error) => {
      resolveResult({
        id: step.id,
        startedAt,
        durationMs: Math.round(performance.now() - started),
        exitCode: 1,
        error: error.message,
      });
    });
    child.once("close", (exitCode, signal) => {
      resolveResult({
        id: step.id,
        startedAt,
        durationMs: Math.round(performance.now() - started),
        exitCode: exitCode ?? 1,
        signal: signal ?? null,
      });
    });
  });
}

async function writeReport(report, reportPath) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export async function runControlledSteps(
  steps,
  {
    cwd = process.cwd(),
    reportPath = resolve(process.cwd(), ".control-feedback/latest.json"),
    stdio = "inherit",
  } = {}
) {
  const results = [];
  for (const step of steps) {
    const result = await runChild(step, { cwd, stdio });
    results.push(result);
    if (result.exitCode !== 0) {
      const report = await writeReport({ status: "blocked", steps: results }, reportPath);
      console.error(`BLOCKED ${step.id}`);
      return report;
    }
    console.log(`PASSED ${step.id}`);
  }
  return writeReport({ status: "passed", steps: results }, reportPath);
}
