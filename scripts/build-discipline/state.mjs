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

export function validateStateDocument(contents) {
  return REQUIRED_HEADINGS.filter((heading) => !contents.includes(heading)).map(
    (heading) => `Missing required section: ${heading}`
  );
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
