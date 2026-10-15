"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../app/core/format.js");
require("../app/core/market-data.js");
require("../app/core/simulation-engine.js");
const brain = require("../app/screens/brain/brain-engine.js");

const CONTEXT = { sym: "PETR4", rng: "3M", sim: { aporte: 500, anos: 10, ret: 5.7, vol: 14.5, ini: 0 } };

test("never recommends buying or selling", () => {
  const result = brain.think("Devo comprar PETR4?", CONTEXT);
  assert.equal(result.reply.cls, "blk");
  assert.match(result.reply.html, /Não faço recomendação/);
  assert.equal(result.calls.length, 0);
});

test("never executes orders", () => {
  const result = brain.think("compre 100 ações agora", CONTEXT);
  assert.match(result.reply.html, /Não executo ordens/);
});

test("contribution questions are answered locally and log the call", () => {
  const result = brain.think("Simule aporte de R$ 800 por 15 anos", CONTEXT);
  assert.deepEqual(result.changes.sim, { aporte: 800, anos: 15 });
  assert.equal(result.reply.goto, undefined);
  assert.deepEqual(result.calls.map((c) => c[0]), ["simulate_dca"]);
  assert.match(result.reply.html, /R\$ 800\/mês/);
  assert.match(result.reply.html, /Este cálculo é local/);
});

test("macro questions cite the Central Bank series", () => {
  const result = brain.think("Como estão a Selic e o IPCA?", CONTEXT);
  assert.equal(result.calls.length, 3);
  assert.ok(result.reply.refs.includes("Banco Central · SGS 432"));
  assert.equal(result.changes.asset, undefined);
});

test("mentioning another asset and period switches the dashboard", () => {
  const result = brain.think("Resuma o desempenho da Vale nos últimos 6 meses", CONTEXT);
  assert.deepEqual(result.changes.asset, { sym: "VALE3", rng: "6M" });
  assert.equal(result.reply.goto.tab, "dashboards");
  assert.match(result.reply.html, /VALE3/);
});

test("comparison with Ibovespa and its limit on the index itself", () => {
  const compare = brain.think("Compare PETR4 com o Ibovespa", CONTEXT);
  assert.deepEqual(compare.calls.map((c) => c[0]), ["get_history", "get_history", "calc_compare"]);
  const self = brain.think("compare o ibovespa", { ...CONTEXT, sym: "IBOV" });
  assert.equal(self.reply.cls, "lim");
});

test("says it does not know instead of guessing", () => {
  const result = brain.think("Qual será o preço do petróleo em 2030?", { ...CONTEXT, sym: "AAPL" });
  assert.equal(result.reply.cls, undefined);
  const unknown = brain.think("Qual a capital da França?", CONTEXT);
  assert.equal(unknown.reply.cls, "lim");
  assert.match(unknown.reply.html, /Não tenho dados/);
});

test("suggestions follow the selected asset", () => {
  assert.ok(brain.suggestions("ITUB4").some((q) => q.includes("ITUB4")));
});
