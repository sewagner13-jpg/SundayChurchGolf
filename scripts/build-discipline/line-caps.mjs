import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_ROOTS = ["src", "scripts", "e2e"];
const SOURCE_FILE_PATTERN = /\.(?:[cm]?js|tsx?)$/;

function countLines(contents) {
  if (contents.length === 0) return 0;
  return contents.endsWith("\n") ? contents.split("\n").length - 1 : contents.split("\n").length;
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) return listSourceFiles(entryPath);
      return SOURCE_FILE_PATTERN.test(entry.name) ? [entryPath] : [];
    })
  );
  return files.flat();
}

function toRepositoryPath(rootDir, filePath) {
  return relative(rootDir, filePath).split(sep).join("/");
}

export async function checkLineCaps({ rootDir, baseline = {}, defaultCap = 500 }) {
  const sourceFiles = (
    await Promise.all(
      SOURCE_ROOTS.map((sourceRoot) => {
        const directory = resolve(rootDir, sourceRoot);
        return existsSync(directory) ? listSourceFiles(directory) : [];
      })
    )
  )
    .flat()
    .sort();

  const violations = [];
  for (const filePath of sourceFiles) {
    const path = toRepositoryPath(rootDir, filePath);
    const lines = countLines(await readFile(filePath, "utf8"));
    const maxLines = baseline[path] ?? defaultCap;
    if (lines > maxLines) violations.push({ path, lines, maxLines });
  }
  return violations;
}

async function main() {
  const rootDir = process.cwd();
  const baselinePath = resolve(rootDir, "scripts/line-cap-baseline.json");
  const contents = JSON.parse(await readFile(baselinePath, "utf8"));
  const violations = await checkLineCaps({
    rootDir,
    baseline: contents.entries,
    defaultCap: contents.defaultCap,
  });

  if (violations.length === 0) {
    console.log("Line-cap check passed.");
    return;
  }

  for (const violation of violations) {
    console.error(`${violation.path}: ${violation.lines} lines exceeds cap ${violation.maxLines}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
