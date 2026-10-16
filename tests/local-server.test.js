"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

test("the local server maps URLs to files inside the project", async () => {
  const { resolveStaticPath } = await import("../scripts/serve.mjs");
  assert.equal(resolveStaticPath("/app/"), path.join(ROOT, "app"));
  assert.equal(resolveStaticPath("/assets/css/base.css?v=1"), path.join(ROOT, "assets", "css", "base.css"));
});

test("the local server refuses paths outside the project", async () => {
  const { resolveStaticPath } = await import("../scripts/serve.mjs");
  assert.equal(resolveStaticPath("/../etc/passwd"), null);
  assert.equal(resolveStaticPath("/app/../../secret.txt"), null);
});
