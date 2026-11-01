import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import test from "node:test";
import ts from "typescript";
import { PrismaClient } from "@prisma/client";
import { FORMAT_DEFINITIONS } from "../../src/lib/format-definitions";

const rawUrl = process.env.SCG_TEST_DATABASE_URL;
if (!rawUrl) throw new Error("SCG_TEST_DATABASE_URL must identify a disposable localhost database");
const url = new URL(rawUrl);
if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.startsWith("/scg_test_")) {
  throw new Error("Persistence tests refuse non-local or non-test databases");
}
const prisma = new PrismaClient({ datasourceUrl: rawUrl });
const require = createRequire(import.meta.url);

function loadAction<T>(path: string, database: object): T {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  const actionModule = { exports: {} };
  new Function("require", "module", "exports", code)((name: string) => {
    if (name === "@/lib/db") return { prisma: database };
    if (name === "next/cache") return { revalidatePath: () => {} };
    return require(name);
  }, actionModule, actionModule.exports);
  return actionModule.exports as T;
}

type ScoreActions = typeof import("../../src/actions/player-scores");
type FinishActions = typeof import("../../src/actions/scoring");

for (const {size, buyIn, fractional} of [{size: 6, buyIn: 30, fractional: false}, {size: 8, buyIn: 30, fractional: false}, {size: 6, buyIn: 25, fractional: true}, {size: 8, buyIn: 25, fractional: true}]) {
  test(`$${buyIn} ${size}-player save/reload and concurrent finish persist money once`, async () => {
    const prefix = `fixture-${randomUUID()}`;
    const ids = Array.from({length: size}, (_, i) => `${prefix}-p${i}`);
    const courseId = `${prefix}-course`, roundId = `${prefix}-round`;
    const teamIds = [`${prefix}-a`, `${prefix}-b`];
    const formatId = size === 6 ? "cross_threesome_6_6_6" : "cross_foursome_6_6_6_18";
    const definition = FORMAT_DEFINITIONS.find(format => format.id === formatId)!;
    let synchronize = false, arrivals = 0, failNextPayout = false;
    let release!: () => void;
    const bothReadLive = new Promise<void>(resolve => { release = resolve; });
    const database = new Proxy(prisma, {get(target, key) {
      if (key === "$transaction" && failNextPayout) {
        return async (callback: (tx: unknown) => Promise<unknown>) => {
          failNextPayout = false;
          return target.$transaction(tx => callback(new Proxy(tx, {get(client, model) {
            if (model === "roundPlayer") return new Proxy(client.roundPlayer, {get(delegate, method) {
              if (method === "update") return async () => { throw new Error("Injected payout write failure"); };
              return Reflect.get(delegate, method);
            }});
            return Reflect.get(client, model);
          }})));
        };
      }
      if (key === "round") return new Proxy(target.round, {get(delegate, method) {
        if (method === "findUnique") return async (args: unknown) => {
          const value = await Reflect.apply(delegate.findUnique, delegate, [args]);
          if (synchronize) { if (++arrivals === 2) release(); await bothReadLive; }
          return value;
        };
        return Reflect.get(delegate, method);
      }});
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    }});
    const scores = loadAction<ScoreActions>("../../src/actions/player-scores.ts", database);
    const scoring = loadAction<FinishActions>("../../src/actions/scoring.ts", database);
    try {
      await prisma.course.create({data: {id: courseId, name: courseId, holes: {create:
        Array.from({length: 18}, (_, i) => ({holeNumber: i + 1, par: 4, handicapRank: i + 1})),
      }}});
      await prisma.format.upsert({where: {id: formatId}, update: {}, create: {
        id: formatId, name: definition.name, description: "Synthetic fixture",
      }});
      await prisma.player.createMany({data: ids.map(id => ({id, fullName: id, handicapIndex: 0}))});
      const slots = (group: number) => Object.fromEntries(ids.slice(group * size / 2, (group + 1) * size / 2)
        .map((id, i) => [`${group === 0 ? "A" : "B"}${i + 1}`, id]));
      const formatConfig = size === 6
        ? {crossThreesome666: {scoreMode: "best_net_ball", threesomeA: slots(0), threesomeB: slots(1)}}
        : {crossFoursome66618: {scoreMode: "best_net_ball", foursomeA: slots(0), foursomeB: slots(1)}};
      const grossFor = (playerId: string, hole: number) => {
        if (!fractional) return playerId === ids[0] ? 4 : 6;
        if (hole > 6) return 6;
        const winningPairs = size === 6
          ? [[ids[3], ids[0]], [ids[4], ids[2]]]
          : [[ids[4], ids[0]], [ids[5], ids[3]], [ids[6], ids[2]]];
        return winningPairs[Math.floor((hole - 1) / (size === 6 ? 3 : 2))].includes(playerId) ? 4 : 6;
      };
      await prisma.round.create({data: {
        id: roundId, date: new Date("2026-11-01"), status: "LIVE", visibility: "OPEN",
        courseId, formatId, formatConfig, startingHole: 1, buyInPerPlayer: buyIn,
        pot: size * buyIn, baseSkinValue: size * buyIn / 18,
        teams: {create: teamIds.map((id, i) => ({id, teamNumber: i + 1}))},
        roundPlayers: {create: ids.map((id, i) => ({playerId: id, teamId: teamIds[i < size / 2 ? 0 : 1], eventHandicapIndex: 0}))},
      }});
      for (let hole = 1; hole <= 18; hole++) {
        for (let group = 0; group < 2; group++) {
          await scores.upsertPlayerScoresForHole(roundId, teamIds[group], hole,
            ids.slice(group * size / 2, (group + 1) * size / 2).map(playerId => ({
              playerId, grossScore: hole === 18 && playerId === ids.at(-1) ? null : grossFor(playerId, hole),
            })));
        }
      }
      const loaded = await scores.getPlayerScores(roundId);
      assert.equal(loaded.length, size * 18);
      assert.equal(loaded.filter(score => score.grossScore === null).length, 1);
      await assert.rejects(() => scoring.finishRound(roundId), /incomplete/i);
      assert.equal((await prisma.round.findUniqueOrThrow({where: {id: roundId}})).status, "LIVE");
      await scores.upsertPlayerScoresForHole(roundId, teamIds[1], 18,
        ids.slice(size / 2).map(playerId => ({playerId, grossScore: 6})));
      failNextPayout = true;
      await assert.rejects(() => scoring.finishRound(roundId), /Injected payout write failure/);
      const rolledBack = await prisma.round.findUniqueOrThrow({where: {id: roundId}, include: {roundPlayers: true}});
      assert.equal(rolledBack.status, "LIVE");
      assert.ok(rolledBack.roundPlayers.every(player => Number(player.payoutAmount) === 0));
      assert.equal(await prisma.seasonPlayerStat.count({where: {playerId: {in: ids}}}), 0);
      synchronize = true;
      const finishes = await Promise.allSettled([scoring.finishRound(roundId), scoring.finishRound(roundId)]);
      synchronize = false;
      assert.equal(finishes.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(finishes.filter(result => result.status === "rejected").length, 1);
      const rejected = finishes.find(result => result.status === "rejected")!;
      assert.match(String(rejected.reason), /already finished by another scorer/);
      const savedRound = await prisma.round.findUniqueOrThrow({where: {id: roundId}, include: {roundPlayers: true, teams: true}});
      assert.equal(savedRound.status, "FINISHED");
      assert.equal(savedRound.roundPlayers.reduce((sum, player) => sum + Math.round(Number(player.payoutAmount) * 100), 0), size * buyIn * 100);
      if (!fractional) {
        assert.equal(Number(savedRound.roundPlayers.find(player => player.playerId === ids[0])!.payoutAmount), size * 15);
        for (const player of savedRound.roundPlayers.filter(player => player.playerId !== ids[0])) {
          assert.equal(Number(player.payoutAmount), ids.slice(size / 2).includes(player.playerId) ? 30 : 0);
        }
      }
      assert.equal(savedRound.teams.reduce((sum, team) => sum + Math.round(Number(team.totalPayout) * 100), 0), size * buyIn * 100);
      const stats = await prisma.seasonPlayerStat.findMany({where: {playerId: {in: ids}}});
      assert.equal(stats.length, size);
      for (const stat of stats) {
        assert.equal(Number(stat.totalWinnings), Number(savedRound.roundPlayers.find(player => player.playerId === stat.playerId)!.payoutAmount));
      }
      assert.ok(stats.every(stat => stat.roundsPlayed === 1 && Number(stat.totalBuyInsPaid) === buyIn));
      assert.equal(stats.reduce((sum, stat) => sum + Math.round(Number(stat.totalWinnings) * 100), 0), size * buyIn * 100);
      await assert.rejects(() => scoring.finishRound(roundId), /LIVE|already/i);
      await assert.rejects(() => scores.upsertPlayerScoresForHole(roundId, teamIds[0], 1, [{playerId: ids[0], grossScore: 3}]), /LIVE/);
    } finally {
      await prisma.round.deleteMany({where: {id: roundId}});
      await prisma.player.deleteMany({where: {id: {in: ids}}});
      await prisma.course.deleteMany({where: {id: courseId}});
    }
  });
}
test.after(async () => { await prisma.$disconnect(); });
