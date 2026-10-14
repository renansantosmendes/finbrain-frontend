"use strict";

/*
 * Loads login/index.html in jsdom: it must run without errors, draw the
 * illustrative candles with classes only and send the user to the app,
 * on the welcome tab or on the tab named in the hash.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");

const LOGIN_DIR = path.join(__dirname, "..", "login");

function loadLogin(hash) {
  let html = fs.readFileSync(path.join(LOGIN_DIR, "index.html"), "utf8");
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_tag, src) =>
    "<script>" + fs.readFileSync(path.join(LOGIN_DIR, src), "utf8") + "</script>"
  );
  const errors = [];
  const dom = new JSDOM(html, { url: "http://localhost/login/index.html" + (hash || ""), runScripts: "dangerously", pretendToBeVisual: true });
  dom.window.addEventListener("error", (event) => errors.push(event.message));
  const visited = [];
  dom.window.FB.login.navigate = (url) => visited.push(url);
  return { window: dom.window, document: dom.window.document, errors, visited };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("login runs without errors and draws the candles with classes", () => {
  const { document, errors } = loadLogin();
  assert.deepEqual(errors, []);
  assert.match(document.querySelector("h2").textContent, /Entrar no FinBrain/);
  assert.equal(document.querySelectorAll("#lcs g.up, #lcs g.dn").length, 26);
  assert.ok(document.getElementById("lma").getAttribute("d").startsWith("M"));
  assert.equal(document.querySelector("#lcs [fill], #lcs [stroke]"), null);
  assert.equal(document.querySelector(".logo").getAttribute("href"), "../index.html");
});

test("the password can be shown and hidden", () => {
  const { document } = loadLogin();
  const eye = document.getElementById("eye");
  eye.click();
  assert.equal(document.getElementById("pw").type, "text");
  assert.equal(eye.getAttribute("aria-pressed"), "true");
  eye.click();
  assert.equal(document.getElementById("pw").type, "password");
  assert.equal(eye.textContent, "Mostrar");
});

test("Acessar o sistema opens the app on the welcome tab", async () => {
  const { document, visited } = loadLogin();
  const submit = document.getElementById("go");
  assert.match(submit.textContent, /Acessar o sistema/);
  submit.click();
  assert.match(document.getElementById("st").textContent, /Entrando/);
  assert.ok(submit.disabled);
  await wait(1000);
  assert.deepEqual(visited, ["../app/index.html#inicio"]);
  assert.match(document.getElementById("st").textContent, /Abrindo o sistema/);
});

test("the guest button and a tab in the hash open that tab", async () => {
  const { document, visited } = loadLogin("#brain");
  document.getElementById("guest").click();
  document.getElementById("guest").click();
  await wait(1000);
  assert.deepEqual(visited, ["../app/index.html#brain"]);
});

test("destinations follow the app tabs and reject unknown ones", () => {
  const { window } = loadLogin();
  const login = window.FB.login;
  assert.equal(login.destination("#nada"), "../app/index.html#inicio");
  assert.equal(login.destination(""), "../app/index.html#inicio");
  assert.equal(login.destination("#simulacoes"), "../app/index.html#simulacoes");
  const tabsSource = fs.readFileSync(path.join(__dirname, "..", "app", "core", "tabs.js"), "utf8");
  const order = JSON.parse(tabsSource.match(/var ORDER = (\[[^\]]+\]);/)[1]);
  assert.deepEqual([...login.TABS], order);
});

test("forgot password explains there is nothing to recover", () => {
  const { document } = loadLogin();
  document.getElementById("fg").click();
  assert.ok(!document.getElementById("st").hidden);
  assert.match(document.getElementById("st").textContent, /Não há senha para recuperar/);
});
