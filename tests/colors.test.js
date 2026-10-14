"use strict";

/*
 * Guarantees a single color structure: colors are declared only in the
 * :root block of assets/css/base.css. Every other CSS, JS and HTML file of
 * the landing page and of the app must use var(--token) instead of literal
 * hex or rgb()/rgba() values.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SCANNED = /\.(css|js|html)$/;
const SKIPPED_DIRS = new Set(["node_modules", ".git", "tests"]);
const LITERAL_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/g;

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : files(path.join(dir, entry.name));
    return SCANNED.test(entry.name) ? [path.join(dir, entry.name)] : [];
  });
}

function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

function withoutRootBlock(text) {
  return text.replace(/:root\s*\{[^}]*\}/, "");
}

test("palette tokens live only in base.css :root", () => {
  const base = fs.readFileSync(path.join(ROOT, "assets/css/base.css"), "utf8");
  const root = base.match(/:root\s*\{([^}]*)\}/);
  assert.ok(root, "base.css must declare the :root palette");
  for (const token of ["--ink", "--teal", "--teal-l", "--up", "--dn", "--paper", "--white"]) {
    assert.match(root[1], new RegExp(token + ":"), token + " must be a palette token");
  }
});

test("no literal colors outside the palette", () => {
  const offenders = [];
  for (const file of files(ROOT)) {
    let text = fs.readFileSync(file, "utf8");
    if (file.endsWith(path.join("assets", "css", "base.css"))) text = withoutRootBlock(text);
    text = text.replace(/&#\d+;|&#x[0-9a-f]+;/gi, "");
    // <meta name="theme-color"> cannot use CSS variables; it must match --ink.
    text = text.replace(/<meta name="theme-color" content="#06161F">/g, "");
    const found = text.match(LITERAL_COLOR);
    if (found) offenders.push(path.relative(ROOT, file) + ": " + [...new Set(found)].join(", "));
  }
  assert.deepEqual(offenders, []);
});

test("every var(--token) used is declared in the palette or locally", () => {
  const base = fs.readFileSync(path.join(ROOT, "assets/css/base.css"), "utf8");
  const declared = new Set();
  for (const file of files(ROOT)) {
    for (const match of fs.readFileSync(file, "utf8").matchAll(/(--[\w-]+)\s*:/g)) declared.add(match[1]);
  }
  for (const match of base.matchAll(/(--[\w-]+)\s*:/g)) declared.add(match[1]);
  const missing = new Set();
  for (const file of files(ROOT)) {
    for (const match of withoutComments(fs.readFileSync(file, "utf8")).matchAll(/var\((--[\w-]+)(,[^)]*)?\)/g)) {
      if (!declared.has(match[1]) && !match[2]) missing.add(match[1] + " in " + path.relative(ROOT, file));
    }
  }
  assert.deepEqual([...missing], []);
});
