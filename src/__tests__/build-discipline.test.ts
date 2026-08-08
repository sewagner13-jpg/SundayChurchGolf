import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkLineCaps } from "../../scripts/build-discipline/line-caps.mjs";
import { validateStateDocument } from "../../scripts/build-discipline/state.mjs";

test("state validator rejects a document missing the release topology", () => {
  assert.deepEqual(validateStateDocument("# Sunday Church Golf State\n"), [
    "Missing required section: ## Release Topology",
    "Missing required section: ## Quality Gates",
    "Missing required section: ## Browser Coverage",
    "Missing required section: ## Line-Cap Policy",
    "Missing required section: ## Operating Mode",
  ]);
});

test("line-cap checker rejects a new 501-line TypeScript file", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "sunday-church-line-cap-"));
  const sourceDir = join(rootDir, "src");

  try {
    await mkdir(sourceDir);
    await writeFile(join(sourceDir, "too-large.ts"), "export const value = 1;\n".repeat(501));

    assert.deepEqual(await checkLineCaps({ rootDir, baseline: {}, defaultCap: 500 }), [
      { path: "src/too-large.ts", lines: 501, maxLines: 500 },
    ]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
