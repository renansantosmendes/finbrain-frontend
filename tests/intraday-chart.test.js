"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const format = require("../app/core/format.js");
require("../app/core/market-data.js");
const charts = require("../app/core/charts.js");

const START = Date.parse("2026-10-15T10:01:00-03:00");
const MINUTE = 60000;

test("the horizontal axis shows the Brasília time of the session", () => {
  const closes = [10, 11, 12];
  const times = [START, START + 60 * MINUTE, START + 180 * MINUTE];
  const svg = charts.intraday(closes, { size: { width: 500, height: 200 }, times, decimals: 2, unit: "R$" });
  const labels = [...svg.matchAll(/text-anchor="middle">(\d\d:\d\d)</g)].map((match) => match[1]);
  assert.deepEqual(labels, ["10:30", "11:00", "11:30", "12:00", "12:30", "13:00"]);
  assert.ok(svg.includes("&lt;b&gt;R$ 10,00&lt;/b&gt;10:01"));
});

test("bars are placed by time, so a gap in trading shows as a gap", () => {
  const closes = [10, 11, 12];
  const times = [START, START + MINUTE, START + 120 * MINUTE];
  const svg = charts.intraday(closes, { size: { width: 500, height: 200 }, times, decimals: 2 });
  const xs = [...svg.matchAll(/class="intra-hit" x="([\d.]+)"/g)].map((match) => Number(match[1]));
  assert.ok(xs[2] - xs[1] > 10 * (xs[1] - xs[0]));
});

test("without times the chart falls back to the bar count", () => {
  const svg = charts.intraday([1, 2, 3], { size: { width: 500, height: 200 }, decimals: 2 });
  assert.ok(svg.includes("Barra 2 de 3 do pregão"));
  assert.ok(!svg.includes("text-anchor=\"middle\""));
  assert.equal(format.pad2(7), "07");
});
