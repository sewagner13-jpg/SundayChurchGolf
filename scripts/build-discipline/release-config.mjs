import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function validateReleaseConfiguration({ scripts, netlifyBuildCommand }) {
  const errors = [];
  if (!scripts["verify:netlify"]) errors.push("Missing required npm script: verify:netlify.");
  if (!scripts["verify:release"]) errors.push("Missing required npm script: verify:release.");
  if (!scripts["deploy:production"]) errors.push("Missing required npm script: deploy:production.");
  if (!scripts.lint?.includes(".worktrees/**")) {
    errors.push("Lint script must exclude linked worktrees.");
  }

  const verificationIndex = netlifyBuildCommand.indexOf("npm run verify:netlify");
  const mutationIndex = netlifyBuildCommand.indexOf("prisma db push");
  if (verificationIndex === -1) errors.push("Netlify build command must run verify:netlify.");
  if (mutationIndex === -1) errors.push("Netlify build command must run prisma db push.");
  if (verificationIndex !== -1 && mutationIndex !== -1 && verificationIndex > mutationIndex) {
    errors.push("Netlify must run verify:netlify before prisma db push.");
  }
  return errors;
}

function readBuildCommand(netlifyToml) {
  const match = netlifyToml.match(/^\s*command\s*=\s*"([^"]+)"/m);
  if (!match) throw new Error("Netlify build command is missing.");
  return match[1];
}

async function main() {
  const rootDir = process.cwd();
  const packageJson = JSON.parse(await readFile(resolve(rootDir, "package.json"), "utf8"));
  const netlifyToml = await readFile(resolve(rootDir, "netlify.toml"), "utf8");
  const errors = validateReleaseConfiguration({
    scripts: packageJson.scripts ?? {},
    netlifyBuildCommand: readBuildCommand(netlifyToml),
  });
  if (errors.length === 0) {
    console.log("Release configuration check passed.");
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
