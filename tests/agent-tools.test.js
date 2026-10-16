"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const agentTools = require("../app/screens/brain/agent-tools.js");

test("a data-collection tool names the ticker it is working on", () => {
  assert.equal(agentTools.describe("collect_yfinance_data", { ticker: "PETR4.SA", period: "1mo" }), "Coletando dados da ação PETR4.SA");
  assert.equal(agentTools.describe("collect_technical_indicators", { ticker: "VALE3.SA" }), "Calculando os indicadores técnicos de VALE3.SA");
});

test("comparisons list every ticker", () => {
  assert.equal(agentTools.describe("compare_assets", { tickers: "PETR4.SA,VALE3.SA" }), "Comparando PETR4.SA,VALE3.SA");
});

test("crypto tools name the symbol and the exchange", () => {
  assert.equal(agentTools.describe("get_crypto_price", { exchange_name: "binance", symbol: "BTC/USDT" }), "Consultando o preço de BTC/USDT em binance");
});

test("without arguments the description is still readable", () => {
  assert.equal(agentTools.describe("collect_yfinance_data"), "Coletando dados de cotação");
  assert.equal(agentTools.describe("get_bcb_series", {}), "Consultando séries do Banco Central");
});

test("unknown tools fall back to a generic phrase", () => {
  assert.equal(agentTools.describe("alguma_nova_tool", { x: 1 }), "Usando alguma_nova_tool");
  assert.equal(agentTools.describe(undefined), "Usando uma ferramenta");
});

test("every label the agent is known to use has a description", () => {
  const known = [
    "collect_yfinance_data", "collect_fundamental_indicators", "collect_technical_indicators", "compare_assets",
    "generate_synthetic_stock_series_garch_arch", "get_bcb_series", "get_ptax_dolar_periodo", "get_market_expectations",
    "get_world_bank_indicator", "search_world_bank_indicator", "compare_countries_latest", "get_crypto_price",
    "get_crypto_ohlcv", "get_crypto_order_book", "list_available_exchanges", "read_credit_card_invoices",
    "write_todos", "task", "read_file", "ls", "glob", "grep",
  ];
  known.forEach((name) => {
    assert.ok(agentTools.LABELS[name], "missing label for " + name);
    assert.ok(!agentTools.describe(name, {}).startsWith("Usando "), "generic label for " + name);
  });
});
