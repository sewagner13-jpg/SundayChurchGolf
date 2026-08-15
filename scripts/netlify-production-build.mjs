import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SITE_ID = "6b411aac-31d6-463d-8f59-de1289a2d9f7";
const SITE_URL = "https://sundaychurchgolf.netlify.app";
const PRODUCTION_BRANCH = "main";
const REQUIRED_FORMAT_ID = "sunday_church_yellow_ball_skins";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function runNetlifyApi(method, data) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["--yes", "netlify-cli@27.1.1", "api", method, "--data", JSON.stringify(data)],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode) => {
      if (exitCode !== 0) {
        reject(new Error(stderr.trim() || `${method} failed with exit code ${exitCode}.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`${method} returned an invalid response.`));
      }
    });
  });
}

export function validateProductionFormats(payload) {
  if (!Array.isArray(payload)) return false;
  return payload.some(
    (format) =>
      format &&
      typeof format === "object" &&
      (format.definitionId === REQUIRED_FORMAT_ID || format.id === REQUIRED_FORMAT_ID)
  );
}

export async function assertAutomaticBuildsStopped({ api = runNetlifyApi } = {}) {
  const site = await api("getSite", { site_id: SITE_ID });
  if (site?.build_settings?.stop_builds !== true) {
    throw new Error(
      "Netlify automatic Git builds must be stopped before the gated production push."
    );
  }
}

async function setAutomaticBuildsStopped(stopped, { api = runNetlifyApi } = {}) {
  await api("updateSite", {
    site_id: SITE_ID,
    body: { build_settings: { stop_builds: stopped } },
  });
  const site = await api("getSite", { site_id: SITE_ID });
  if (site?.build_settings?.stop_builds !== stopped) {
    throw new Error(
      `Netlify build status did not change to ${stopped ? "stopped" : "active"}.`
    );
  }
}

async function pollUntil(check, { attempts, intervalMs, timeoutMessage }) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await check();
    if (result.done) return result.value;
    if (attempt < attempts - 1) await sleep(intervalMs);
  }
  throw new Error(timeoutMessage);
}

/**
 * @param {{
 *   expectedCommitSha: string;
 *   api?: (method: string, data: Record<string, unknown>) => Promise<any>;
 *   fetchImpl?: typeof fetch;
 *   attempts?: number;
 *   intervalMs?: number;
 * }} options
 */
export async function runNetlifyProductionBuild({
  expectedCommitSha,
  api = runNetlifyApi,
  fetchImpl = fetch,
  attempts = 180,
  intervalMs = 5000,
}) {
  if (!expectedCommitSha) throw new Error("EXPECTED_COMMIT_SHA is required.");
  await assertAutomaticBuildsStopped({ api });
  try {
    await setAutomaticBuildsStopped(false, { api });
    const created = await api("createSiteBuild", {
      site_id: SITE_ID,
      branch: PRODUCTION_BRANCH,
      title: `Gated production deploy ${expectedCommitSha.slice(0, 12)}`,
    });
    if (!created?.id) throw new Error("Netlify did not return a production build ID.");

    const build = await pollUntil(async () => {
      const current = await api("getSiteBuild", { build_id: created.id });
      if (current?.error) throw new Error(`Netlify build failed: ${current.error}`);
      return { done: current?.done === true, value: current };
    }, {
      attempts,
      intervalMs,
      timeoutMessage: "Timed out waiting for the Netlify production build.",
    });
    const deployId = build.deploy_id ?? created.deploy_id;
    if (!deployId) throw new Error("Netlify did not return a production deploy ID.");

    const deploy = await pollUntil(async () => {
      const current = await api("getSiteDeploy", { site_id: SITE_ID, deploy_id: deployId });
      if (["error", "failed"].includes(current?.state)) {
        throw new Error(`Netlify deploy failed: ${current.error_message || current.state}`);
      }
      return { done: current?.state === "ready", value: current };
    }, {
      attempts,
      intervalMs,
      timeoutMessage: "Timed out waiting for the Netlify production deploy.",
    });
    if (deploy.commit_ref !== expectedCommitSha) {
      throw new Error(
        `Netlify deployed ${deploy.commit_ref || "an unknown commit"}; expected ${expectedCommitSha}.`
      );
    }

    const cacheBust = `release=${encodeURIComponent(expectedCommitSha)}`;
    const [homeResponse, formatsResponse] = await Promise.all([
      fetchImpl(`${SITE_URL}/?${cacheBust}`, { cache: "no-store" }),
      fetchImpl(`${SITE_URL}/api/formats?${cacheBust}`, { cache: "no-store" }),
    ]);
    if (!homeResponse.ok) {
      throw new Error(`Production home smoke check failed with HTTP ${homeResponse.status}.`);
    }
    if (!formatsResponse.ok) {
      throw new Error(`Production format smoke check failed with HTTP ${formatsResponse.status}.`);
    }
    const formats = await formatsResponse.json();
    if (!validateProductionFormats(formats)) {
      throw new Error("Production format smoke check did not find Sunday Church Yellow Ball Skins.");
    }

    return { buildId: created.id, deployId, commitSha: deploy.commit_ref };
  } finally {
    await setAutomaticBuildsStopped(true, { api });
  }
}

async function main() {
  if (process.argv.includes("--check-config")) {
    await assertAutomaticBuildsStopped();
    console.log("Netlify automatic Git builds are stopped.");
    return;
  }
  const result = await runNetlifyProductionBuild({
    expectedCommitSha: process.env.EXPECTED_COMMIT_SHA,
  });
  console.log(`Production deploy verified: ${result.commitSha} (${result.deployId}).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
