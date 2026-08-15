import assert from "node:assert/strict";
import test from "node:test";

import {
  runControlledAction,
  type ControlledActionState,
} from "@/components/controlled-action";

test("controlled action reports pending and success beside a completed control", async () => {
  const states: ControlledActionState[] = [];
  const result = await runControlledAction(
    async () => ({ message: "Score saved." }),
    (state) => states.push(state)
  );

  assert.deepEqual(result, { message: "Score saved." });
  assert.deepEqual(states, [
    { status: "pending", message: "Working..." },
    { status: "success", message: "Score saved." },
  ]);
});

test("controlled action restores the control and renders an actionable failure", async () => {
  const states: ControlledActionState[] = [];
  const result = await runControlledAction(
    async () => {
      throw new Error("Enter both gross scores.");
    },
    (state) => states.push(state)
  );

  assert.equal(result, null);
  assert.deepEqual(states, [
    { status: "pending", message: "Working..." },
    { status: "error", message: "Enter both gross scores." },
  ]);
});
