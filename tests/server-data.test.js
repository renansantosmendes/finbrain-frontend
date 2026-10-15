"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../app/core/format.js");
const market = require("../app/core/market-data.js");
const api = require("../app/core/api.js");
const live = require("../app/core/live-data.js");

function jsonResponse(status, body) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

function withFetch(stub, action) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return Promise.resolve()
    .then(action)
    .finally(() => {
      globalThis.fetch = original;
    });
}

function barsFor(count, startClose) {
  return Array.from({ length: count }, (_v, i) => {
    const close = startClose + i;
    return { date: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10), open: close - 1, high: close + 1, low: close - 2, close, volume: 10 };
  });
}

test("query strings encode values and skip empty parameters", () => {
  assert.equal(api.query({ tickers: "PETR4.SA,^BVSP", period: "1y", empty: undefined }), "tickers=PETR4.SA%2C%5EBVSP&period=1y");
});

test("dashboard sends the tickers as one comma-separated parameter", async () => {
  const seen = [];
  await withFetch(
    (url) => {
      seen.push(url);
      return Promise.resolve(jsonResponse(200, { assets: [] }));
    },
    () => api.dashboard(["PETR4.SA", "VALE3.SA"], "1y")
  );
  const parsed = new URL(seen[0]);
  assert.equal(parsed.searchParams.get("tickers"), "PETR4.SA,VALE3.SA");
  assert.equal(parsed.searchParams.getAll("tickers").length, 1);
});

test("requests go to the public server and parse the JSON body", async () => {
  const seen = [];
  const body = await withFetch(
    (url, options) => {
      seen.push({ url, options });
      return Promise.resolve(jsonResponse(200, { status: "ok" }));
    },
    () => api.request("GET", "/health")
  );
  assert.deepEqual(body, { status: "ok" });
  assert.equal(seen[0].url, "https://finbrain-server.vercel.app/api/v1/health");
  assert.equal(seen[0].options.method, "GET");
});

test("POST sends the body as JSON", async () => {
  const seen = [];
  await withFetch(
    (url, options) => {
      seen.push(options);
      return Promise.resolve(jsonResponse(200, {}));
    },
    () => api.garchAsset({ ticker: "PETR4.SA", horizon_days: 252 })
  );
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(seen[0].body), { ticker: "PETR4.SA", horizon_days: 252 });
});

test("server errors become ApiError with the server's code", async () => {
  const error = await withFetch(
    () => Promise.resolve(jsonResponse(404, { code: "asset_not_found", message: "Ativo não encontrado." })),
    () => api.dashboard(["XXXX"], "1y").then(() => null, (failure) => failure)
  );
  assert.ok(error instanceof api.ApiError);
  assert.equal(error.status, 404);
  assert.equal(error.code, "asset_not_found");
  assert.equal(error.message, "Ativo não encontrado.");
});

test("network failures and missing fetch are reported as ApiError", async () => {
  const offline = await withFetch(
    () => Promise.reject(new TypeError("Failed to fetch")),
    () => api.macroSummary().then(() => null, (failure) => failure)
  );
  assert.equal(offline.code, "network");
  const original = globalThis.fetch;
  delete globalThis.fetch;
  try {
    const missing = await api.macroSummary().then(() => null, (failure) => failure);
    assert.equal(missing.code, "no_fetch");
  } finally {
    globalThis.fetch = original;
  }
});

test("server bars replace the mock candles, keeping their dates", () => {
  const applied = live.applyDashboard({
    assets: [
      { ticker: "PETR4.SA", bars: barsFor(5, 40) },
      { ticker: "^BVSP", bars: barsFor(5, 130000) },
    ],
  });
  assert.equal(applied, 2);
  const petr = market.findAsset("PETR4");
  assert.equal(petr.source, "live");
  assert.equal(petr.data.length, 5);
  assert.deepEqual(petr.data[4], [43, 45, 42, 44]);
  assert.equal(market.lastClose(petr), 44);
  assert.equal(market.lastDate(petr).toISOString().slice(0, 10), "2026-01-05");
  const slice = market.slice(petr, 3);
  assert.equal(slice.t.length, 3);
  assert.equal(market.findAsset("VALE3").source, undefined);
});

test("macro summary sets the Selic, CDI and IPCA used on screen", () => {
  assert.equal(live.applyMacro({ selic: { value: 13.75 }, cdi: { value: 13.65 }, ipca_12m: { value: 4.58 } }), true);
  assert.equal(market.MACRO.selic, 13.75);
  assert.equal(market.MACRO.cdi, 13.65);
  assert.equal(market.MACRO.ipca, 4.58);
});

test("status is live only when prices and macro both come from the server", () => {
  assert.equal(live.statusFor(market.ASSETS.length, true), "live");
  assert.equal(live.statusFor(market.ASSETS.length, false), "partial");
  assert.equal(live.statusFor(2, true), "partial");
  assert.equal(live.statusFor(0, false), "mock");
});

test("the Selic history yields the changes of the last year and a sentence about them", () => {
  live.applySelicSeries({
    observations: [
      { date: "2026-01-10", value: 15 },
      { date: "2026-02-10", value: 15 },
      { date: "2026-03-18", value: 14.75 },
      { date: "2026-04-29", value: 14.5 },
    ],
  });
  const summary = market.selicSummary();
  assert.equal(summary.changes.length, 2);
  assert.equal(summary.lastChange.value, 14.5);
  assert.match(market.selicText(), /houve 2 alterações: de 15,00% para 14,50% a\.a\., com a última em 29\/04\/2026\./);
});

test("a flat Selic is described as unchanged", () => {
  live.applySelicSeries({ observations: [{ date: "2026-01-10", value: 13.75 }, { date: "2026-10-10", value: 13.75 }] });
  assert.match(market.selicText(), /ela não mudou/);
});

test("an empty Selic series is rejected", () => {
  assert.throws(() => live.applySelicSeries({ observations: [] }));
});

test("load falls back to the mock data when the server cannot be reached", async () => {
  const realDashboard = api.dashboard;
  const realMacro = api.macroSummary;
  const realSeries = api.macroSeries;
  api.dashboard = () => Promise.reject(new api.ApiError(0, "network", "offline"));
  api.macroSummary = () => Promise.reject(new api.ApiError(0, "network", "offline"));
  api.macroSeries = () => Promise.reject(new api.ApiError(0, "network", "offline"));
  try {
    assert.equal(await live.load(), "mock");
    assert.equal(live.status(), "mock");
  } finally {
    api.dashboard = realDashboard;
    api.macroSummary = realMacro;
    api.macroSeries = realSeries;
  }
});

test("load requests every asset ticker in one dashboard call", async () => {
  const realDashboard = api.dashboard;
  const requested = [];
  api.dashboard = (tickers, period) => {
    requested.push({ tickers, period });
    return Promise.resolve({ assets: [] });
  };
  api.macroSummary = () => Promise.resolve({ selic: { value: 1 }, cdi: { value: 1 }, ipca_12m: { value: 1 } });
  api.macroSeries = () => Promise.resolve({ observations: [{ date: "2026-01-01", value: 1 }] });
  try {
    assert.equal(await live.load(), "partial");
    assert.deepEqual(requested[0].tickers, market.ASSETS.map((asset) => asset.tk));
    assert.equal(requested[0].period, "1y");
  } finally {
    api.dashboard = realDashboard;
  }
});

test("the server's fixed tickers match the mock asset list", () => {
  assert.deepEqual(
    market.ASSETS.map((asset) => asset.tk),
    ["PETR4.SA", "VALE3.SA", "ITUB4.SA", "^BVSP", "AAPL", "USDBRL=X"]
  );
});
