"use strict";

/*
 * Loads app/index.html with all its scripts in jsdom and drives the central
 * screen like a user: switching tabs, selecting assets, asking the Brain
 * and checking that the other tabs react.
 */
const test = require("node:test");
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

function loadApp(hash, media) {
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
    },
  });
  dom.window.addEventListener("error", (event) => errors.push(event.message));
  return { dom, window: dom.window, document: dom.window.document, errors };
}

function visibleTab(document) {
  return [...document.querySelectorAll(".tabpanel")].filter((panel) => !panel.hidden).map((panel) => panel.id);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("starts on Início with every screen rendered and no errors", () => {
  const { document, errors } = loadApp();
  assert.deepEqual(errors, []);
  assert.deepEqual(visibleTab(document), ["tab-inicio"]);
  assert.equal(document.getElementById("tabbtn-inicio").getAttribute("aria-selected"), "true");
  assert.equal(document.querySelectorAll("#wlb tr").length, 6);
  assert.ok(document.querySelector("#asset svg .cd"));
  assert.ok(document.querySelector("#sim svg.fan"));
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
  document.getElementById("sim-aporte").value = "1500";
  document.querySelector("#hiQuick [data-sim]").click();
  assert.deepEqual(visibleTab(document), ["tab-simulacoes"]);
  assert.equal(document.getElementById("sim-aporte").value, "500");
  assert.equal(document.getElementById("sim-anos").value, "10");

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
  assert.deepEqual(visibleTab(document), ["tab-brain"]);
  document.getElementById("tabbtn-brain").dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
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

test("asking for a simulation updates Simulações and records the trail", async () => {
  const { document } = loadApp("#brain");
  const input = document.getElementById("bq");
  input.value = "Simule aporte de R$ 800 por 15 anos";
  document.getElementById("bf").dispatchEvent(new document.defaultView.Event("submit", { cancelable: true }));
  assert.match(document.getElementById("bm").textContent, /Consultando as fontes/);
  await wait(900);
  assert.match(document.getElementById("bm").textContent, /R\$ 800\/mês/);
  assert.equal(document.getElementById("sim-aporte").value, "800");
  assert.equal(document.getElementById("sim-anos").value, "15");
  await wait(50);
  const badge = document.querySelector("#tabbtn-transparencia .cnt");
  assert.equal(badge.textContent, "1");
  assert.ok(!badge.hasAttribute("data-zero"));
  assert.match(document.getElementById("trailBody").textContent, /simulate_dca/);
  document.querySelector('#bm [data-goto="simulacoes"]').click();
  assert.deepEqual(visibleTab(document), ["tab-simulacoes"]);
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

test("moving a slider re-runs the simulation", async () => {
  const { window, document } = loadApp("#simulacoes");
  const before = document.querySelector("#sim .sk").textContent;
  const slider = document.getElementById("sim-aporte");
  slider.value = "2000";
  slider.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(document.getElementById("out-aporte").textContent, "R$ 2.000");
  await wait(200);
  assert.notEqual(document.querySelector("#sim .sk").textContent, before);
  assert.match(document.getElementById("ctxSim").textContent, /R\$ 2\.000/);
});

test("user text in the chat is escaped", async () => {
  const { document } = loadApp("#brain");
  document.getElementById("bq").value = '<img src=x onerror="window.hacked=1">';
  document.getElementById("bf").dispatchEvent(new document.defaultView.Event("submit", { cancelable: true }));
  assert.equal(document.querySelector("#bm img"), null);
  assert.equal(document.defaultView.hacked, undefined);
  await wait(900);
});

test("phones get compact charts and a short chat placeholder", () => {
  const media = fakeMedia(true);
  const { document } = loadApp("#dashboards", media);
  assert.equal(document.querySelector("#asset svg").getAttribute("viewBox"), "0 0 560 430");
  assert.ok(document.querySelector("#asset svg").classList.contains("compact"));
  assert.equal(document.querySelector("#sim svg.fan").getAttribute("viewBox"), "0 0 560 400");
  assert.equal(document.getElementById("bq").placeholder, "Pergunte ao Brain…");
});

test("charts are redrawn when the screen crosses the phone breakpoint", () => {
  const media = fakeMedia(false);
  const { document } = loadApp("#dashboards", media);
  assert.equal(document.querySelector("#asset svg").getAttribute("viewBox"), "0 0 960 380");
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
