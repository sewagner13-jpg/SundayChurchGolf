import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("unit discovery includes TS and TSX regressions recursively", async () => {
  const { findUnitTests } = await import(new URL("../../scripts/run-unit-tests.mjs", import.meta.url).href);
  const root = await mkdtemp(join(tmpdir(), "scg-discovery-"));
  try {
    await mkdir(join(root, "nested"));
    for (const name of ["one.test.ts", "two.test.tsx", "not-a-test.ts", "nested/three.test.tsx"]) {
      await writeFile(join(root, name), "");
    }
    const files: string[] = await findUnitTests(root);
    assert.deepEqual(files.map((file) => file.slice(root.length + 1)), ["nested/three.test.tsx", "one.test.ts", "two.test.tsx"]);
  } finally {
    await rm(root, { recursive: true });
  }
});
