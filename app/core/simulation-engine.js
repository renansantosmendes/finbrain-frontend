/*
 * Monte Carlo engine of the monthly contribution simulation (400 paths,
 * real returns, fixed seed so the same inputs always give the same fan).
 */
(function (root, factory) {
  var FB = (root.FB = root.FB || {});
  FB.simulation = factory(FB.market);
  if (typeof module === "object" && module.exports) module.exports = FB.simulation;
})(typeof self !== "undefined" ? self : globalThis, function (market) {
  "use strict";

  var DEFAULTS = { aporte: 500, anos: 10, ret: 5.7, vol: 14.5, ini: 0 };
  var LIMITS = {
    aporte: { min: 100, max: 5000, step: 100 },
    ini: { min: 0, max: 100000, step: 1000 },
    anos: { min: 1, max: 30, step: 1 },
    ret: { min: -2, max: 12, step: 0.1 },
    vol: { min: 5, max: 30, step: 0.5 },
  };
  var PATHS = 400;

  function clamp(name, value) {
    var limit = LIMITS[name];
    return Math.min(limit.max, Math.max(limit.min, value));
  }

  function run(params) {
    var months = params.anos * 12;
    var mu = Math.pow(1 + params.ret / 100, 1 / 12) - 1;
    var sigma = params.vol / 100 / Math.sqrt(12);
    var g = new market.Rng(99), sims = [];

    function normal() {
      var u1 = Math.max(g.next(), 1e-9), u2 = g.next();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    for (var k = 0; k < PATHS; k++) {
      var value = params.ini, row = [];
      for (var m = 0; m < months; m++) {
        value = (value + params.aporte) * Math.exp(mu - sigma * sigma / 2 + sigma * normal());
        row.push(value);
      }
      sims.push(row);
    }

    function quantile(m, p) {
      var column = sims.map(function (r) { return r[m]; }).sort(function (a, b) { return a - b; });
      return column[Math.floor(p * (PATHS - 1))];
    }

    var result = { months: months, p10: [], p50: [], p90: [], inv: [] };
    for (var mm = 0; mm < months; mm++) {
      result.p10.push(quantile(mm, 0.1));
      result.p50.push(quantile(mm, 0.5));
      result.p90.push(quantile(mm, 0.9));
      result.inv.push(params.ini + params.aporte * (mm + 1));
    }
    return result;
  }

  function finalValues(result) {
    var m = result.months - 1;
    return { invested: result.inv[m], median: result.p50[m], low: result.p10[m], high: result.p90[m] };
  }

  return { DEFAULTS: DEFAULTS, LIMITS: LIMITS, PATHS: PATHS, clamp: clamp, run: run, finalValues: finalValues };
});
