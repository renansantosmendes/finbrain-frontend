"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const format = require("../app/core/format.js");
const market = require("../app/core/market-data.js");
const simulation = require("../app/core/simulation-engine.js");
const charts = require("../app/core/charts.js");

test("pt-BR formatting, signed percentages and money", () => {
  assert.equal(format.fmt(1234.5, 2), "1.234,50");
  assert.equal(format.pc(2.5), "+2,50%");
  assert.equal(format.pc(-1.234, 1), "−1,2%");
  assert.equal(format.money(76000), "R$ 76 mil");
  assert.equal(format.money(1250000), "R$ 1,25 mi");
  assert.equal(format.norm("Itaú Câmbio"), "itau cambio");
  assert.equal(format.esc('<b a="1">'), "&lt;b a=&quot;1&quot;&gt;");
});

test("mock series are deterministic and end on the anchor dates", () => {
  assert.equal(market.DATES.length, 252);
  assert.equal(market.DATES[251].toISOString().slice(0, 10), "2026-10-08");
  market.ASSETS.forEach((asset) => {
    assert.equal(asset.data.length, 252);
    asset.data.forEach(([open, high, low, close]) => {
      assert.ok(high >= Math.max(open, close) && low <= Math.min(open, close));
    });
  });
  const again = require("../app/core/market-data.js");
  assert.equal(again.lastClose(again.findAsset("PETR4")), market.lastClose(market.findAsset("PETR4")));
});

test("asset search accepts tickers and accent-free names", () => {
  assert.equal(market.searchAsset("vale3").s, "VALE3");
  assert.equal(market.searchAsset("itau").s, "ITUB4");
  assert.equal(market.searchAsset("Dólar").s, "USD/BRL");
  assert.equal(market.searchAsset("xyz"), null);
  assert.equal(market.searchAsset(""), null);
});

test("statistics: drawdown, moving average and real rate", () => {
  assert.equal(market.maxDrawdown([10, 12, 9, 11]), (9 / 12 - 1) * 100);
  assert.deepEqual(market.sma([1, 2, 3, 4], 2), [1, 1.5, 2.5, 3.5]);
  assert.ok(Math.abs(market.realRate() - ((1.1465 / 1.043 - 1) * 100)) < 1e-9);
  const perf = market.performance(market.findAsset("ITUB4"), "3M");
  assert.ok(perf.high >= perf.last && perf.low <= perf.last);
});

test("Monte Carlo fan is reproducible and ordered", () => {
  const params = { aporte: 500, anos: 10, ret: 5.7, vol: 14.5, ini: 0 };
  const first = simulation.run(params);
  const second = simulation.run(params);
  assert.equal(first.months, 120);
  assert.deepEqual(first.p50, second.p50);
  const final = simulation.finalValues(first);
  assert.equal(final.invested, 60000);
  assert.ok(final.low < final.median && final.median < final.high);
  assert.equal(simulation.clamp("aporte", 99999), 5000);
  assert.equal(simulation.clamp("anos", 0), 1);
});

test("charts use classes for colors, never inline color values", () => {
  const asset = market.findAsset("VALE3");
  const s = market.slice(asset, 21);
  const svg = charts.candles(s.d, s.t, asset.u, asset.d, "teste") + charts.sparkline(asset) +
    charts.fan(simulation.run({ aporte: 500, anos: 2, ret: 5, vol: 10, ini: 0 }));
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(svg));
  assert.equal((svg.match(/class="cd /g) || []).length, 21);
  assert.match(charts.candleTable(s.d, s.t, 2), /<th>Fechamento<\/th>/);
});

test("candles can be drawn at the real pixel size of their box", () => {
  const asset = market.findAsset("PETR4");
  const s = market.slice(asset, 63);
  const svg = charts.candles(s.d, s.t, asset.u, asset.d, "teste", { size: { width: 1500, height: 520 } });
  assert.match(svg, /<svg class="fluid" width="1500" height="520" viewBox="0 0 1500 520"/);
  assert.equal((svg.match(/class="cd /g) || []).length, 63);
  const tooSmall = charts.candles(s.d, s.t, asset.u, asset.d, "teste", { size: { width: 100, height: 80 } });
  assert.match(tooSmall, /viewBox="0 0 960 380"/);
});
