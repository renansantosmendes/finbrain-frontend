"use strict";

/*
 * Loads the landing page in jsdom: it must run without errors, find every
 * asset it references and link each feature card to its tab in the app.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");

function loadLanding() {
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_tag, src) =>
    "<script>" + fs.readFileSync(path.join(ROOT, src), "utf8") + "</script>"
  );
  const errors = [];
  const dom = new JSDOM(html, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true });
  dom.window.addEventListener("error", (event) => errors.push(event.message));
  return { document: dom.window.document, errors };
}

test("landing runs without errors", () => {
  const { document, errors } = loadLanding();
  assert.deepEqual(errors, []);
  assert.match(document.querySelector("h1").textContent, /Entenda o mercado/);
});

test("every local asset referenced by the landing exists", () => {
  const { document } = loadLanding();
  const refs = [
    ...[...document.querySelectorAll("img")].map((img) => img.getAttribute("src")),
    ...[...document.querySelectorAll('link[rel="stylesheet"], link[rel="icon"]')].map((link) => link.getAttribute("href")),
  ].filter((ref) => !/^https?:/.test(ref));
  assert.ok(refs.length >= 5);
  for (const ref of refs) assert.ok(fs.existsSync(path.join(ROOT, ref)), ref + " is missing");
  const css = fs.readFileSync(path.join(ROOT, "assets/css/landing.css"), "utf8");
  for (const match of css.matchAll(/url\('([^']+)'\)/g)) {
    assert.ok(fs.existsSync(path.join(ROOT, "assets/css", match[1])), match[1] + " is missing");
  }
});

test("calls to action open the app and each feature card opens its tab", () => {
  const { document } = loadLanding();
  const appLinks = [...document.querySelectorAll('a[href="app/index.html"]')];
  assert.ok(appLinks.length >= 3);
  const cardLinks = [...document.querySelectorAll(".cards4 a.cl")].map((a) => a.getAttribute("href"));
  assert.deepEqual(cardLinks, ["app/index.html#dashboards", "app/index.html#brain", "app/index.html#simulacoes", "app/index.html#transparencia"]);
  assert.equal(document.querySelector('a[href*="finbrain-sistema"]'), null);
});
