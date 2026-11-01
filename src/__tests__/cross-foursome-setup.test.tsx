import assert from "node:assert/strict";
import test from "node:test";
import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrossFoursome66618Setup } from "@/components/cross-foursome-66618-setup";
import { createDefaultCrossFoursome66618Config } from "@/lib/cross-foursome-66618";

function elements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children)];
}

test("setup offers gross and net without changing the saved/default mode", () => {
  for (const mode of ["best_ball", "best_net_ball"] as const) {
    const formatConfig = createDefaultCrossFoursome66618Config();
    formatConfig.crossFoursome66618.scoreMode = mode;
    const tree = CrossFoursome66618Setup({ players: [], formatConfig, onChange: () => {} });
    const select = elements(tree).find(el => el.type === "select" && el.props.value === mode);
    assert.ok(select, "scoring mode selector must be available");
    assert.deepEqual(elements(select.props.children).filter(el => el.type === "option").map(el => el.props.value), ["best_ball", "best_net_ball"]);
  }
});

test("selecting net preserves player assignments and unrelated format settings", () => {
  const formatConfig = { ...createDefaultCrossFoursome66618Config(), requiredDrivesPerPlayer: 4 };
  formatConfig.crossFoursome66618.foursomeA.A1 = "player-a";
  let saved: Record<string, unknown> | undefined;
  const tree = CrossFoursome66618Setup({ players: [], formatConfig, onChange: next => { saved = next; } });
  const select = elements(tree).find(el => el.type === "select" && el.props.value === "best_ball");
  assert.ok(select, "scoring mode selector must be available");
  (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "best_net_ball" } });
  assert.deepEqual(saved, { ...formatConfig, crossFoursome66618: { ...formatConfig.crossFoursome66618, handicapMode: "relative", scoreMode: "best_net_ball" } });
});

test("locked setup disables scoring choice and explains the actual handicap rule", () => {
  const tree = CrossFoursome66618Setup({ players: [], formatConfig: createDefaultCrossFoursome66618Config(), onChange: () => {}, disabled: true });
  const select = elements(tree).find(el => el.type === "select" && el.props.value === "best_ball");
  assert.ok(select);
  assert.equal(select.props.disabled, true);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /100% of the difference/);
  assert.match(html, /lowest of all eight players/);
  assert.match(html, /No slope, tee, or percentage adjustment/);
});

test("net setup warns for missing handicaps but gross setup does not", () => {
  for (const mode of ["best_net_ball", "best_ball"] as const) {
    const formatConfig = createDefaultCrossFoursome66618Config();
    formatConfig.crossFoursome66618.scoreMode = mode;
    const html = renderToStaticMarkup(CrossFoursome66618Setup({
      players: [{ playerId: "a", name: "A", handicapIndex: null }], formatConfig, onChange: () => {},
    }));
    assert.equal(html.includes("Every player needs a handicap"), mode === "best_net_ball");
  }
});

test("net setup lets the organizer select full handicaps without changing scoring or pairings", () => {
  const formatConfig = createDefaultCrossFoursome66618Config();
  formatConfig.crossFoursome66618.scoreMode = "best_net_ball";
  let saved: Record<string, unknown> | undefined;
  const tree = CrossFoursome66618Setup({players: [], formatConfig, onChange: next => {saved = next;}});
  const select = elements(tree).find(el => el.type === "select" && el.props.value === "relative");
  assert.ok(select);
  (select.props.onChange as (event: {target:{value:string}}) => void)({target:{value:"full"}});
  assert.deepEqual(saved, {...formatConfig, crossFoursome66618:{...formatConfig.crossFoursome66618, handicapMode:"full", handicapModeConfirmed:true}});
});

test("filling the last cart slot automatically draws partners and keeps physical carts", () => {
  const formatConfig = createDefaultCrossFoursome66618Config();
  Object.assign(formatConfig.crossFoursome66618.foursomeA,{A1:"a",A2:"b",A3:"c",A4:"d"});
  Object.assign(formatConfig.crossFoursome66618.foursomeB,{B1:"e",B2:"f",B3:"g"});
  let saved: Record<string, unknown> | undefined;
  const players = "abcdefgh".split("").map(playerId=>({playerId,name:playerId,handicapIndex:10}));
  const tree = CrossFoursome66618Setup({players,formatConfig,onChange:next=>{saved=next;}});
  const slot = elements(tree).find(el=>el.type==="select" && el.props.value==="");
  assert.ok(slot);
  (slot.props.onChange as (event:{target:{value:string}})=>void)({target:{value:"h"}});
  const next = saved!.crossFoursome66618 as typeof formatConfig.crossFoursome66618;
  assert.deepEqual(next.foursomeA,formatConfig.crossFoursome66618.foursomeA);
  assert.deepEqual(next.foursomeB,{B1:"e",B2:"f",B3:"g",B4:"h"});
  assert.deepEqual([...next.partnerOrder!].sort(),["A1","A2","A3","A4"]);
  const html = renderToStaticMarkup(tree);
  assert.match(html,/Red Cart/);
  assert.match(html,/Blue Cart/);
});
