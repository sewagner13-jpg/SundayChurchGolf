import assert from "node:assert/strict";
import test from "node:test";
import * as cross from "@/lib/cross-foursome-66618";

test("net round start rejects missing and invalid handicaps but accepts zero", () => {
  const getStartConfig = cross.getCrossFoursome66618StartConfig;
  assert.equal(typeof getStartConfig, "function");
  const config = cross.createDefaultCrossFoursome66618Config();
  config.crossFoursome66618.scoreMode = "best_net_ball";
  for (const missing of [null, undefined, NaN, Infinity]) {
    assert.throws(() => getStartConfig(config, [0, 2, 4, 6, 8, 10, 12, missing]), /Every Cross-Foursome player needs a valid handicap/);
  }
  assert.equal(getStartConfig(config, [0, 2, 4, 6, 8, 10, 12, 14]).scoreMode, "best_net_ball");
});

test("gross round start remains available without handicaps", () => {
  const getStartConfig = cross.getCrossFoursome66618StartConfig;
  assert.equal(typeof getStartConfig, "function");
  assert.equal(getStartConfig(cross.createDefaultCrossFoursome66618Config(), [null]).scoreMode, "best_ball");
});

test("live cross-foursome scoring choices are locked but unrelated settings can change", () => {
  const guard = cross.assertCrossFoursome66618LiveConfigChange;
  assert.equal(typeof guard, "function");
  const config = cross.createDefaultCrossFoursome66618Config();
  const round = {formatId:cross.CROSS_FOURSOME_66618_FORMAT_ID, formatConfig:config};
  assert.doesNotThrow(() => guard(round, {...config, burgerOrders:["a"]}));
  assert.throws(() => guard(round, {...config,crossFoursome66618:{...config.crossFoursome66618,scoreMode:"best_net_ball"}}), /before starting/);
  config.crossFoursome66618.scoreMode = "best_net_ball";
  assert.throws(() => guard(round, {...config,crossFoursome66618:{...config.crossFoursome66618,handicapMode:"full"}}), /before starting/);
});

test("new rounds default net and require an explicit handicap-method choice", () => {
  const createNew = cross.createNewCrossFoursome66618Config;
  assert.equal(typeof createNew, "function");
  const formatConfig = createNew();
  assert.equal(formatConfig.crossFoursome66618.scoreMode, "best_net_ball");
  assert.throws(() => cross.getCrossFoursome66618StartConfig(formatConfig, [0,2,4,6,8,10,12,14]), /Choose a handicap method/);
  formatConfig.crossFoursome66618.handicapModeConfirmed = true;
  assert.throws(() => cross.getCrossFoursome66618StartConfig(formatConfig, [0,2,4,6,8,10,12,14]), /Draw cross-cart partners/);
  formatConfig.crossFoursome66618.partnerOrder = ["A1","A2","A3","A4"];
  assert.doesNotThrow(() => cross.getCrossFoursome66618StartConfig(formatConfig, [0,2,4,6,8,10,12,14]));
});
