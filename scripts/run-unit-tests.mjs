import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));

export async function findUnitTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return findUnitTests(path);
      return entry.isFile() && entry.name.endsWith(".test.ts") ? [path] : [];
    })
  );
  return files.flat().sort();
}

async function main() {
  const testFiles = await findUnitTests(resolve(rootDir, "src/__tests__"));
  if (testFiles.length === 0) throw new Error("No unit test files found.");

  const child = spawn(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
    cwd: rootDir,
    stdio: "inherit",
  });
  child.once("error", (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.once("close", (exitCode) => {
    process.exitCode = exitCode ?? 1;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
