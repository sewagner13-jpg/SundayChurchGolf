import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultSundayChurchSimonSaysConfig,
  getSundayChurchSimonSaysInstruction,
  getSundayChurchSimonSaysInstructionDraftValue,
  validateSundayChurchSimonSaysConfig,
} from "@/lib/sunday-church-simon-says";

test("simon says default config creates 18 editable instruction slots", () => {
  const config = createDefaultSundayChurchSimonSaysConfig();

  assert.equal(Object.keys(config.simonSaysInstructions ?? {}).length, 18);
  assert.equal(config.simonSaysInstructions?.["1"], "");
  assert.equal(config.simonSaysInstructions?.["18"], "");
});

test("simon says validation requires an instruction for every hole", () => {
  assert.deepEqual(validateSundayChurchSimonSaysConfig(null), [
    "Enter Simon Says instructions for every hole.",
  ]);

  const config = createDefaultSundayChurchSimonSaysConfig();
  config.simonSaysInstructions = {
    ...config.simonSaysInstructions,
    "1": "Play this hole as a one-club challenge.",
  };

  assert.deepEqual(validateSundayChurchSimonSaysConfig(config), [
    "Hole 2 is missing Simon Says instructions.",
    "Hole 3 is missing Simon Says instructions.",
    "Hole 4 is missing Simon Says instructions.",
    "Hole 5 is missing Simon Says instructions.",
    "Hole 6 is missing Simon Says instructions.",
    "Hole 7 is missing Simon Says instructions.",
    "Hole 8 is missing Simon Says instructions.",
    "Hole 9 is missing Simon Says instructions.",
    "Hole 10 is missing Simon Says instructions.",
    "Hole 11 is missing Simon Says instructions.",
    "Hole 12 is missing Simon Says instructions.",
    "Hole 13 is missing Simon Says instructions.",
    "Hole 14 is missing Simon Says instructions.",
    "Hole 15 is missing Simon Says instructions.",
    "Hole 16 is missing Simon Says instructions.",
    "Hole 17 is missing Simon Says instructions.",
    "Hole 18 is missing Simon Says instructions.",
  ]);
});

test("simon says instruction lookup trims stored instructions", () => {
  const config = createDefaultSundayChurchSimonSaysConfig();
  config.simonSaysInstructions = {
    ...config.simonSaysInstructions,
    "3": "  Putt with the flagstick in.  ",
  };

  assert.equal(
    getSundayChurchSimonSaysInstruction(config, 3),
    "Putt with the flagstick in."
  );
});

test("simon says draft lookup preserves spaces while typing", () => {
  const config = createDefaultSundayChurchSimonSaysConfig();
  config.simonSaysInstructions = {
    ...config.simonSaysInstructions,
    "4": "Use only irons on this hole ",
  };

  assert.equal(
    getSundayChurchSimonSaysInstructionDraftValue(config, 4),
    "Use only irons on this hole "
  );
});
