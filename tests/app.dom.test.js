"use strict";

/*
 * Loads app/index.html with all its scripts in jsdom and drives the central
 * screen like a user: switching tabs, selecting assets, asking the Brain
 * and checking that the other tabs react.
 */
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");

const APP_DIR = path.join(__dirname, "..", "app");

function fakeMedia(initial) {
  const listeners = [];
  return {
    matches: initial,
    addEventListener: (_type, listener) => listeners.push(listener),
    set(value) {
      this.matches = value;
      listeners.forEach((listener) => listener({ matches: value }));
    },
  };
}

const openWindows = [];
after(() => openWindows.forEach((dom) => dom.window.close()));

function loadApp(hash, media, server) {
  let html = fs.readFileSync(path.join(APP_DIR, "index.html"), "utf8");
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_tag, src) =>
    "<script>" + fs.readFileSync(path.join(APP_DIR, src), "utf8") + "</script>"
  );
  const errors = [];
  const dom = new JSDOM(html, {
    url: "http://localhost/app/" + (hash || ""),
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.scrollTo = () => {};
      if (media) window.matchMedia = () => media;
      if (server) window.fetch = server.fetch;
    },
  });
  dom.window.addEventListener("error", (event) => errors.push(event.message));
  openWindows.push(dom);
  return { dom, window: dom.window, document: dom.window.document, errors };
}

function visibleTab(document) {
  return [...document.querySelectorAll(".tabpanel")].filter((panel) => !panel.hidden).map((panel) => panel.id);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SERVER_TICKERS = ["PETR4.SA", "VALE3.SA", "ITUB4.SA", "^BVSP", "AAPL", "USDBRL=X"];

function barsFor(seed, count) {
  const bars = [];
  for (let i = 0; i < count; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
    const close = 10 + seed + i * 0.1;
    bars.push({ date: day, open: close - 0.2, high: close + 0.5, low: close - 0.6, close, volume: 1000 });
  }
  return bars;
}

function dashboardFixture(tickers) {
  return {
    generated_at: "2026-10-15T16:27:57Z",
    period: "1y",
    assets: (tickers || SERVER_TICKERS).map((ticker, index) => ({
      ticker,
      currency: "BRL",
      last_close: 10 + index,
      previous_close: 9 + index,
      day_change_percent: 1.2,
      last_date: "2026-04-10",
      bars: barsFor(index, 120),
    })),
  };
}

function macroFixture() {
  return {
    selic: { date: "2026-10-15", value: 13.75 },
    cdi: { date: "2026-10-14", value: 13.65 },
    ipca_12m: { date: "2026-09-01", value: 4.58 },
    real_rate: 8.67,
    source: "Banco Central do Brasil · SGS",
  };
}

function selicFixture() {
  const observations = [];
  for (let month = 0; month < 12; month += 1) {
    const value = month < 6 ? 15 : 13.75;
    observations.push({ date: "2026-" + String(month + 1).padStart(2, "0") + "-15", value });
  }
  return { name: "selic", observations };
}

function garchFixture(horizonDays, ticker, pathCount) {
  const series = (scale) => Array.from({ length: horizonDays }, (_v, i) => (58 + i * 0.05) * scale);
  const p50 = series(1);
  const percentiles = { p5: series(0.8), p10: series(0.9), p25: series(0.96), p50, p75: series(1.04), p90: series(1.1), p95: series(1.2) };
  const last = (key) => percentiles[key][horizonDays - 1];
  return {
    ticker,
    last_close: 58.04,
    last_date: "2026-10-15",
    n_paths: pathCount,
    observations_used: 497,
    parameters: { mu: 0.1, omega: 1.08, alpha: 0.19, beta: 0.39, persistence: 0.58, annualized_volatility_percent: 25.7 },
    dates: Array.from({ length: horizonDays }, (_v, i) => "2026-10-" + String(16 + (i % 14)).padStart(2, "0")),
    percentiles,
    sample_paths: [],
    final: { p5: last("p5"), p10: last("p10"), p25: last("p25"), p50: last("p50"), p75: last("p75"), p90: last("p90"), p95: last("p95"), prob_above_last: 0.78 },
  };
}

function serverStub(reply) {
  const calls = [];
  const fetch = (url, options = {}) => {
    const parsed = new URL(url, "http://localhost/app/");
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ method: options.method || "GET", path: parsed.pathname + parsed.search, body });
    const answer = reply(parsed.pathname, body, parsed.searchParams);
    return Promise.resolve({ ok: answer.status < 400, status: answer.status, json: () => Promise.resolve(answer.body) });
  };
  return { fetch, calls };
}

function quoteFixture(ticker) {
  return {
    ticker,
    name: ticker === "BBAS3.SA" ? "Banco do Brasil ON" : "Petrobras PN",
    currency: "BRL",
    price: 58.02,
    previous_close: 58.11,
    day_change_percent: -0.15,
    fifty_day_average: 47.58,
    volume: 17263100,
    average_volume: 44341633,
    market_time: "2026-10-15T16:12:55Z",
  };
}

function intradayFixture() {
  const bars = [57.6, 57.9, 58.1, 57.8, 58.0, 58.02];
  return {
    ticker: "PETR4.SA",
    period: "1d",
    interval: "5m",
    currency: "BRL",
    bars: bars.map((close, index) => ({ date: "2026-10-15", open: close - 0.1, high: close + 0.2, low: close - 0.3, close, volume: 1000 + index })),
  };
}

function healthyServer(garch) {
  return serverStub((pathname, body, search) => {
    if (pathname.endsWith("/dashboard")) return { status: 200, body: dashboardFixture(search.get("tickers") && search.get("tickers").split(",")) };
    const quoteMatch = pathname.match(/\/assets\/(.+)\/quote$/);
    if (quoteMatch) return { status: 200, body: quoteFixture(decodeURIComponent(quoteMatch[1])) };
    if (pathname.match(/\/assets\/.+\/history$/)) return { status: 200, body: intradayFixture() };
    if (pathname.endsWith("/macro/brasil/summary")) return { status: 200, body: macroFixture() };
    if (pathname.endsWith("/macro/brasil/series/selic")) return { status: 200, body: selicFixture() };
    if (pathname.endsWith("/simulations/garch/asset")) {
      return garch ? garch(body) : { status: 200, body: garchFixture(body.horizon_days, body.ticker, body.n_paths) };
    }
    return { status: 404, body: { code: "not_found", message: "Não encontrado." } };
  });
}

function runSimulation(document, window) {
  const horizon = document.getElementById("sim-horizonte");
  horizon.value = "2";
  horizon.dispatchEvent(new window.Event("change", { bubbles: true }));
  document.querySelector('#sim [data-act="run"]').click();
}

test("starts on Início with every screen rendered and no errors", () => {
  const { document, errors } = loadApp();
  assert.deepEqual(errors, []);
  assert.deepEqual(visibleTab(document), ["tab-inicio"]);
  assert.equal(document.getElementById("tabbtn-inicio").getAttribute("aria-selected"), "true");
  assert.equal(document.querySelectorAll("#wlb tr").length, 6);
  assert.ok(document.querySelector("#asset svg .cd"));
  assert.match(document.querySelector("#sim .gs-status").textContent, /Simular/);
  assert.ok(document.querySelector("#bm .msg-a"));
  assert.match(document.querySelector("#mini").textContent, /IBOV/);
  assert.equal(document.getElementById("tabbtn-dashboards").getAttribute("aria-selected"), "false");
});

test("an unknown hash falls back to Início", () => {
  const { window, document } = loadApp("#nada");
  assert.deepEqual(visibleTab(document), ["tab-inicio"]);
  assert.equal(window.location.hash, "#inicio");
});

test("Início greets the generic user and the top bar shows who is signed in", () => {
  const { document } = loadApp("#inicio");
  assert.match(document.getElementById("hiTitle").textContent, /^(Bom dia|Boa tarde|Boa noite), Investidor$/);
  assert.match(document.getElementById("hiDate").textContent, /dados ilustrativos até 08\/10\/2026/);
  assert.equal(document.getElementById("usrNm").textContent, "Investidor");
  assert.equal(document.getElementById("usrAv").textContent, "I");
  assert.equal(document.querySelector("#usr .out").getAttribute("href"), "../login/index.html");
  assert.equal(document.querySelectorAll("#hiMarket .hi-mk").length, 4);
  assert.equal(document.querySelectorAll("#hiMarket .spark").length, 2);
});

test("Início cards open each of the other tabs", () => {
  const { document } = loadApp("#inicio");
  const cards = [...document.querySelectorAll("#hiFeatures [data-goto]")];
  assert.deepEqual(cards.map((card) => card.getAttribute("data-goto")), ["dashboards", "brain", "simulacoes", "transparencia"]);
  for (const card of cards) {
    document.getElementById("tabbtn-inicio").click();
    card.click();
    assert.deepEqual(visibleTab(document), ["tab-" + card.getAttribute("data-goto")]);
  }
});

test("Início quick starts drive the other tabs and the session panel follows", async () => {
  const { document } = loadApp("#inicio");
  assert.match(document.getElementById("hiSession").textContent, /PETR4/);
  document.getElementById("tabbtn-dashboards").click();
  document.querySelector('#wlb tr[data-sym="VALE3"]').click();
  assert.match(document.getElementById("hiSession").textContent, /VALE3/);

  document.getElementById("tabbtn-inicio").click();
  document.querySelector("#hiQuick [data-asset]").click();
  assert.deepEqual(visibleTab(document), ["tab-dashboards"]);
  assert.match(document.querySelector("#asset h1").textContent, /PETR4/);

  document.getElementById("tabbtn-inicio").click();
  document.querySelector("#hiQuick [data-sim-asset]").click();
  assert.deepEqual(visibleTab(document), ["tab-simulacoes"]);
  assert.equal(document.getElementById("sim-ativo").value, "PETR4");

  document.getElementById("tabbtn-inicio").click();
  document.querySelector("#hiQuick [data-ask]").click();
  assert.deepEqual(visibleTab(document), ["tab-brain"]);
  await wait(900);
  assert.match(document.getElementById("bm").textContent, /Selic/);
  await wait(50);
  assert.match(document.getElementById("hiSession").textContent, /Transparência[1-9]/);
});

test("the hash opens the requested tab and tab clicks update it", () => {
  const { window, document } = loadApp("#simulacoes");
  assert.deepEqual(visibleTab(document), ["tab-simulacoes"]);
  document.getElementById("tabbtn-transparencia").click();
  assert.deepEqual(visibleTab(document), ["tab-transparencia"]);
  assert.equal(window.location.hash, "#transparencia");
  assert.match(document.getElementById("trailBody").textContent, /Nenhuma chamada ainda/);
});

test("arrow keys move between tabs", () => {
  const { window, document } = loadApp("#dashboards");
  const first = document.getElementById("tabbtn-dashboards");
  first.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.deepEqual(visibleTab(document), ["tab-homebroker"]);
  document.getElementById("tabbtn-homebroker").dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
  assert.deepEqual(visibleTab(document), ["tab-transparencia"]);
});

test("selecting an asset in the watchlist updates the chart and the Brain context", () => {
  const { document } = loadApp("#dashboards");
  document.querySelector('#wlb tr[data-sym="VALE3"]').click();
  assert.match(document.querySelector("#asset h1").textContent, /VALE3/);
  assert.match(document.getElementById("ctxAsset").textContent, /VALE3/);
  assert.ok([...document.querySelectorAll("#bc .chp")].some((chip) => chip.textContent.includes("VALE3")));
  document.querySelector('#asset [data-rng="1A"]').click();
  assert.equal(document.querySelectorAll("#asset .cd").length, 252);
  document.querySelector('#asset [data-act="tbl"]').click();
  assert.ok(document.querySelector("#asset .chart").hidden);
  assert.ok(!document.querySelector("#asset .dtab-wrap").hidden);
});

test("searching an asset in the top bar opens it on Dashboards", () => {
  const { window, document } = loadApp("#brain");
  const search = document.getElementById("sq");
  search.value = "itau";
  search.dispatchEvent(new window.Event("change"));
  assert.deepEqual(visibleTab(document), ["tab-dashboards"]);
  assert.match(document.querySelector("#asset h1").textContent, /ITUB4/);
});

test("asking the Brain for a simulation answers locally and records the trail", async () => {
  const { document } = loadApp("#brain");
  const input = document.getElementById("bq");
  input.value = "Simule aporte de R$ 800 por 15 anos";
  document.getElementById("bf").dispatchEvent(new document.defaultView.Event("submit", { cancelable: true }));
  assert.match(document.getElementById("bm").textContent, /Consultando as fontes/);
  await wait(900);
  assert.match(document.getElementById("bm").textContent, /R\$ 800\/mês/);
  assert.equal(document.querySelector('#bm [data-goto="simulacoes"]'), null);
  assert.match(document.getElementById("ctxSim").textContent, /R\$ 800/);
  await wait(50);
  const badge = document.querySelector("#tabbtn-transparencia .cnt");
  assert.equal(badge.textContent, "1");
  assert.ok(!badge.hasAttribute("data-zero"));
  assert.match(document.getElementById("trailBody").textContent, /simulate_dca/);
});

test("Dashboards and Simulações send questions to the Brain tab", async () => {
  const { document } = loadApp("#dashboards");
  document.querySelector("#asset [data-ask]").click();
  assert.deepEqual(visibleTab(document), ["tab-brain"]);
  await wait(900);
  assert.equal(document.querySelectorAll("#bm .msg-u").length, 1);
  document.getElementById("tabbtn-simulacoes").click();
  document.querySelector('#sim [data-act="explain"]').click();
  assert.deepEqual(visibleTab(document), ["tab-brain"]);
  await wait(900);
  assert.equal(document.querySelectorAll("#bm .msg-u").length, 2);
});

test("running a GARCH simulation asks the server and draws the fan", async () => {
  const server = healthyServer();
  const { window, document } = loadApp("#simulacoes", null, server);
  assert.match(document.querySelector("#sim .gs-status").textContent, /Simular/);
  runSimulation(document, window);
  assert.match(document.querySelector("#sim .gs-status").textContent, /Consultando/);
  await wait(50);
  const request = server.calls.find((call) => call.method === "POST");
  assert.equal(request.path, "/api/v1/simulations/garch/asset");
  assert.deepEqual(request.body, { ticker: "PETR4.SA", horizon_days: 504, n_paths: 500, history_period: "2y" });
  assert.ok(document.querySelector("#sim svg.fan"));
  assert.match(document.querySelector("#sim .sk").textContent, /78%/);
  assert.match(document.querySelector("#sim .fine").textContent, /25,7%/);
});

test("a failed simulation explains the problem in the panel", async () => {
  const server = healthyServer(() => ({ status: 502, body: { code: "upstream_unavailable", message: "Fonte fora." } }));
  const { window, document } = loadApp("#simulacoes", null, server);
  runSimulation(document, window);
  await wait(50);
  assert.match(document.querySelector("#sim .gs-error").textContent, /indisponível/);
  assert.equal(document.querySelector("#sim svg.fan"), null);
});

test("changing the asset in focus discards the last simulation", async () => {
  const server = healthyServer();
  const { window, document } = loadApp("#simulacoes", null, server);
  runSimulation(document, window);
  await wait(50);
  assert.ok(document.querySelector("#sim svg.fan"));
  document.getElementById("sim-ativo").value = "VALE3";
  document.getElementById("sim-ativo").dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(document.querySelector("#sim svg.fan"), null);
  assert.match(document.querySelector("#sim .gs-status").textContent, /Simular/);
});

test("the server's prices replace the mock series when the page loads", async () => {
  const server = healthyServer();
  const { document } = loadApp("#dashboards", null, server);
  await wait(50);
  assert.equal(document.getElementById("srcBadge").textContent, "Dados do servidor FinBrain");
  assert.match(document.getElementById("mini").textContent, /13,75%/);
  assert.match(document.getElementById("macro").textContent, /Banco Central/);
  assert.match(document.querySelector("#asset .fine").textContent, /servidor FinBrain/);
  const dashboardCalls = server.calls.filter((call) => call.path.startsWith("/api/v1/dashboard"));
  assert.equal(dashboardCalls.length, 1);
  assert.match(dashboardCalls[0].path, /tickers=PETR4\.SA/);
  assert.match(dashboardCalls[0].path, /period=1y/);
});

test("when the server is unreachable the screens keep the mock data and say so", async () => {
  const server = { calls: [], fetch: () => Promise.reject(new TypeError("Failed to fetch")) };
  const { document, errors } = loadApp("#dashboards", null, server);
  await wait(50);
  assert.deepEqual(errors, []);
  assert.equal(document.getElementById("srcBadge").textContent, "Mock · dados ilustrativos");
  assert.equal(document.querySelectorAll("#wlb tr").length, 6);
  assert.match(document.querySelector("#asset .fine").textContent, /Não são cotações reais/);
});

test("user text in the chat is escaped", async () => {
  const { document } = loadApp("#brain");
  document.getElementById("bq").value = '<img src=x onerror="window.hacked=1">';
  document.getElementById("bf").dispatchEvent(new document.defaultView.Event("submit", { cancelable: true }));
  assert.equal(document.querySelector("#bm img"), null);
  assert.equal(document.defaultView.hacked, undefined);
  await wait(900);
});

test("phones get compact charts and a short chat placeholder", async () => {
  const media = fakeMedia(true);
  const { window, document } = loadApp("#dashboards", media, healthyServer());
  assert.equal(document.querySelector("#asset svg").getAttribute("viewBox"), "0 0 560 430");
  assert.ok(document.querySelector("#asset svg").classList.contains("compact"));
  document.getElementById("tabbtn-simulacoes").click();
  runSimulation(document, window);
  await wait(50);
  assert.equal(document.querySelector("#sim svg.fan").getAttribute("viewBox"), "0 0 560 400");
  assert.equal(document.getElementById("bq").placeholder, "Pergunte ao Brain…");
});

test("charts are redrawn when the screen crosses the phone breakpoint", async () => {
  const media = fakeMedia(false);
  const { window, document } = loadApp("#dashboards", media, healthyServer());
  assert.equal(document.querySelector("#asset svg").getAttribute("viewBox"), "0 0 960 380");
  document.getElementById("tabbtn-simulacoes").click();
  runSimulation(document, window);
  await wait(50);
  assert.equal(document.querySelector("#sim svg.fan").getAttribute("viewBox"), "0 0 960 330");
  media.set(true);
  assert.equal(document.querySelector("#asset svg").getAttribute("viewBox"), "0 0 560 430");
  assert.equal(document.querySelector("#sim svg.fan").getAttribute("viewBox"), "0 0 560 400");
  media.set(false);
  assert.equal(document.querySelector("#sim svg.fan").getAttribute("viewBox"), "0 0 960 330");
});

test("trail rows carry labels for the phone card layout", async () => {
  const { document } = loadApp("#brain");
  document.getElementById("bq").value = "Como estão a Selic e o IPCA?";
  document.getElementById("bf").dispatchEvent(new document.defaultView.Event("submit", { cancelable: true }));
  await wait(900);
  const labels = [...document.querySelectorAll("#trailBody tr:first-child td")].map((td) => td.getAttribute("data-label"));
  assert.deepEqual(labels, ["Ferramenta", "Fonte", "Parâmetros", "Consultado", "Hash"]);
});

test("the homebroker shows the day's price, range and an intraday chart from the server", async () => {
  const server = healthyServer();
  const { document } = loadApp("#homebroker", null, server);
  await wait(80);
  assert.match(document.querySelector("#hb .hb-price").textContent, /R\$ 58,02/);
  assert.match(document.querySelector("#hb .sk").textContent, /Fechamento anterior58,11/);
  assert.match(document.querySelector("#hb .sk").textContent, /Abertura57,50/);
  assert.ok(document.querySelector("#hb svg.intra polyline.intra-line"));
  assert.match(document.querySelector("#hb .fine").textContent, /atrasar até 15 minutos/);
  assert.ok(server.calls.some((call) => call.path === "/api/v1/assets/PETR4.SA/quote"));
  assert.ok(server.calls.some((call) => call.path.startsWith("/api/v1/assets/PETR4.SA/history?period=1d&interval=5m")));
});

test("changing the homebroker asset requests that asset's quote", async () => {
  const server = healthyServer();
  const { window, document } = loadApp("#homebroker", null, server);
  await wait(80);
  const select = document.getElementById("hb-ativo");
  select.value = "VALE3";
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
  await wait(80);
  assert.ok(server.calls.some((call) => call.path === "/api/v1/assets/VALE3.SA/quote"));
});

test("without the server the homebroker says so and shows no example prices", async () => {
  const server = { calls: [], fetch: () => Promise.reject(new TypeError("Failed to fetch")) };
  const { document } = loadApp("#homebroker", null, server);
  await wait(80);
  assert.match(document.querySelector("#hb .gs-error").textContent, /Não foi possível falar com o servidor/);
  assert.equal(document.querySelector("#hb svg.intra"), null);
});

test("the watchlist dropdown hides an asset and remembers the choice", async () => {
  const { window, document } = loadApp("#dashboards", null, healthyServer());
  await wait(50);
  const box = document.querySelector('#wlPicker [data-watch="AAPL"]');
  box.checked = false;
  box.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(document.querySelectorAll("#wlb tr").length, 5);
  assert.ok(!document.querySelector('#wlb tr[data-sym="AAPL"]'));
  assert.ok(!JSON.parse(window.localStorage.getItem("finbrain.watchlist")).includes("AAPL"));
  assert.match(document.querySelector("#wlPicker summary").textContent, /5 de 6/);
});

test("adding a ticker asks the server and puts it in the watchlist", async () => {
  const { window, document } = loadApp("#dashboards", null, healthyServer());
  await wait(50);
  const input = document.getElementById("wlTicker");
  input.value = "bbas3.sa";
  document.getElementById("wlAdd").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  await wait(120);
  assert.ok(document.querySelector('#wlb tr[data-sym="BBAS3"]'));
  assert.match(document.getElementById("wlMsg").textContent, /BBAS3 adicionado/);
  assert.match(document.querySelector('#wlPicker [data-watch="BBAS3"]').parentNode.textContent, /Banco do Brasil ON/);
});


function agentServer(reply) {
  return serverStub((pathname, body) => {
    if (pathname.endsWith("/chat")) return reply(body);
    return { status: 404, body: { code: "not_found", message: "Nao encontrado." } };
  });
}

function askBrain(document, window, text) {
  document.getElementById("bq").value = text;
  document.getElementById("bf").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
}

test("the Brain sends questions to the agent and shows its formatted reply", async () => {
  const server = agentServer((body) => ({
    status: 200,
    body: { session_id: body.session_id || "s1", reply: "Resposta **importante** do agente" + String.fromCharCode(10) + "- primeiro item" + String.fromCharCode(10) + "- segundo item" },
  }));
  const { window, document } = loadApp("#brain", null, server);
  askBrain(document, window, "ola");
  await wait(120);
  const messages = document.querySelectorAll("#bm .msg-a");
  const message = messages[messages.length - 1];
  assert.ok(message.textContent.includes("Resposta importante do agente"));
  assert.equal(message.querySelectorAll("li").length, 2);
  assert.ok(message.querySelector("b"));
  assert.ok(message.textContent.includes("Resposta do agente FinBrain"));
  const sent = server.calls.find((call) => call.path === "/agent/chat");
  assert.equal(sent.body.message, "ola");
  assert.ok(sent.body.session_id);
});

test("when the agent is unreachable the Brain answers locally and says so", async () => {
  const server = { calls: [], fetch: () => Promise.reject(new TypeError("Failed to fetch")) };
  const { window, document } = loadApp("#brain", null, server);
  askBrain(document, window, "Simule aporte de R$ 800 por 15 anos");
  await wait(900);
  const text = document.getElementById("bm").textContent;
  assert.ok(text.includes("R$ 800/mês"));
  assert.ok(text.includes("O agente FinBrain não respondeu agora"));
});
