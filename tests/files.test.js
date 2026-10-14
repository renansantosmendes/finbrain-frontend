"use strict";

/*
 * Repository-wide checks run by CI on every file: all JavaScript parses,
 * every page loads only files that exist, every page is set up for mobile
 * and the theme color meta tag matches the --ink token.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const SKIPPED_DIRS = new Set(["node_modules", ".git"]);

function files(dir, pattern) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : files(path.join(dir, entry.name), pattern);
    return pattern.test(entry.name) ? [path.join(dir, entry.name)] : [];
  });
}

const PAGES = files(ROOT, /\.html$/);

test("every JavaScript file parses", () => {
  const scripts = files(ROOT, /\.js$/);
  assert.ok(scripts.length >= 15);
  for (const file of scripts) {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(file, "utf8"), { filename: file }), path.relative(ROOT, file));
  }
});

test("every page references only files that exist", () => {
  assert.ok(PAGES.length >= 2);
  for (const page of PAGES) {
    const html = fs.readFileSync(page, "utf8");
    const refs = [...html.matchAll(/(?:src|href)="([^"#?]+)/g)].map((m) => m[1]).filter((ref) => !/^(https?:|mailto:)/.test(ref));
    for (const ref of refs) {
      const target = path.resolve(path.dirname(page), ref);
      const exists = fs.existsSync(target) && (fs.statSync(target).isFile() || fs.existsSync(path.join(target, "index.html")));
      assert.ok(exists, path.relative(ROOT, page) + " -> " + ref);
    }
  }
});

test("every page is ready for mobile and declared in pt-BR", () => {
  for (const page of PAGES) {
    const html = fs.readFileSync(page, "utf8");
    const name = path.relative(ROOT, page);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1/, name);
    assert.match(html, /<html lang="pt-BR">/, name);
    assert.match(html, /<title>[^<]+<\/title>/, name);
  }
});

test("theme-color meta tag matches the --ink token", () => {
  const ink = fs.readFileSync(path.join(ROOT, "assets/css/base.css"), "utf8").match(/--ink:(#[0-9A-Fa-f]{6});/)[1];
  for (const page of PAGES) {
    const meta = fs.readFileSync(page, "utf8").match(/<meta name="theme-color" content="([^"]+)">/);
    if (meta) assert.equal(meta[1], ink, path.relative(ROOT, page));
  }
});
