import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_HEADINGS = [
  "## Release Topology",
  "## Quality Gates",
  "## Browser Coverage",
  "## Line-Cap Policy",
  "## Operating Mode",
];

const MAX_STATE_LINES = 150;

function countLines(contents) {
  if (contents.length === 0) return 0;
  return contents.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

export function validateStateDocument(contents) {
  const errors = REQUIRED_HEADINGS.filter((heading) => !contents.includes(heading)).map(
    (heading) => `Missing required section: ${heading}`
  );
  const lineCount = countLines(contents);
  if (lineCount > MAX_STATE_LINES) {
    errors.push(`docs/STATE.md exceeds the 150-line limit (${lineCount} lines).`);
  }
  return errors;
}

async function main() {
  const path = resolve(process.cwd(), process.argv[2] ?? "docs/STATE.md");
  const errors = validateStateDocument(await readFile(path, "utf8"));
  if (errors.length === 0) {
    console.log("State document check passed.");
    return;
  }

  for (const error of errors) console.error(error);
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
