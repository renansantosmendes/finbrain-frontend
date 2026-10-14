/*
 * Illustrative market data for the V0 (mock): deterministic daily candles
 * for six assets, Brazilian macro indicators and the statistics computed on
 * top of them. The series are generated, not real quotes.
 */
(function (root, factory) {
  var FB = (root.FB = root.FB || {});
  FB.market = factory(FB.format);
  if (typeof module === "object" && module.exports) module.exports = FB.market;
})(typeof self !== "undefined" ? self : globalThis, function (format) {
  "use strict";

  function Rng(seed) {
    this.s = seed;
  }
  Rng.prototype.next = function () {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 4294967296;
  };

  function interp(anchors, i) {
    for (var k = 0; k < anchors.length - 1; k++) {
      if (anchors[k][0] <= i && i <= anchors[k + 1][0]) {
        return anchors[k][1] + (anchors[k + 1][1] - anchors[k][1]) * (i - anchors[k][0]) / (anchors[k + 1][0] - anchors[k][0]);
      }
    }
    return anchors[anchors.length - 1][1];
  }

  function makeSeries(n, anchors, seed, vol, wick) {
    var g = new Rng(seed), out = [], prev = anchors[0][1];
    for (var i = 0; i < n; i++) {
      var close = prev + (interp(anchors, i) - prev) * 0.55 + (g.next() - 0.5) * vol, open = prev;
      out.push([open, Math.max(open, close) + g.next() * wick, Math.min(open, close) - g.next() * wick, close]);
      prev = close;
    }
    return out;
  }

  function businessDays(n) {
    var d = Date.UTC(2026, 9, 8), out = [];
    while (out.length < n) {
      var x = new Date(d);
      if (x.getUTCDay() % 6 !== 0) out.push(x);
      d -= 86400000;
    }
    return out.reverse();
  }

  var DATES = businessDays(252);
  var ASSETS = [
    { s: "PETR4", n: "Petrobras PN", u: "R$", d: 2, a: [[0, 33], [90, 36.5], [170, 40.2], [210, 36.8], [251, 38.4]], v: 0.55, w: 0.3, seed: 11, al: ["petrobras"] },
    { s: "VALE3", n: "Vale ON", u: "R$", d: 2, a: [[0, 66], [100, 63], [180, 58.5], [251, 61.2]], v: 0.8, w: 0.45, seed: 12, al: ["vale"] },
    { s: "ITUB4", n: "Itaú Unibanco PN", u: "R$", d: 2, a: [[0, 28.5], [120, 31], [200, 33.5], [251, 33.9]], v: 0.4, w: 0.22, seed: 13, al: ["itau"] },
    { s: "IBOV", n: "Ibovespa", u: "pts", d: 0, a: [[0, 117000], [120, 123500], [200, 126000], [251, 128430]], v: 900, w: 450, seed: 14, al: ["ibovespa", "bovespa"] },
    { s: "AAPL", n: "Apple (Nasdaq)", u: "US$", d: 2, a: [[0, 205], [120, 222], [190, 214], [251, 231.5]], v: 2.6, w: 1.2, seed: 15, al: ["apple"] },
    { s: "USD/BRL", n: "Dólar comercial", u: "R$", d: 2, a: [[0, 5.62], [90, 5.78], [170, 5.34], [251, 5.41]], v: 0.05, w: 0.025, seed: 16, al: ["dolar", "cambio"] },
  ];
  ASSETS.forEach(function (asset) {
    asset.data = makeSeries(252, asset.a, asset.seed, asset.v, asset.w);
  });
  var RANGES = { "1M": 21, "3M": 63, "6M": 126, "1A": 252 };
  var MACRO = { selic: 14.75, cdi: 14.65, ipca: 4.3 };

  function findAsset(symbol) {
    return ASSETS.filter(function (asset) { return asset.s === symbol; })[0] || null;
  }

  function searchAsset(text) {
    var query = String(text || "").trim();
    if (!query) return null;
    var upper = query.toUpperCase(), normalized = format.norm(query);
    return ASSETS.filter(function (asset) {
      return asset.s === upper || format.norm(asset.n).indexOf(normalized) >= 0;
    })[0] || null;
  }

  function slice(asset, n) {
    return { d: asset.data.slice(-n), t: DATES.slice(-n) };
  }

  function closes(data) {
    return data.map(function (x) { return x[3]; });
  }

  function volAnn(cl, n) {
    var r = [], s = cl.slice(-(n + 1));
    for (var i = 1; i < s.length; i++) r.push(Math.log(s[i] / s[i - 1]));
    var m = r.reduce(function (x, y) { return x + y; }, 0) / r.length;
    return Math.sqrt(r.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0) / (r.length - 1)) * Math.sqrt(252) * 100;
  }

  function maxDrawdown(cl) {
    var peak = cl[0], dd = 0;
    cl.forEach(function (c) { peak = Math.max(peak, c); dd = Math.min(dd, c / peak - 1); });
    return dd * 100;
  }

  function sma(cl, k) {
    return cl.map(function (c, i) {
      var a = cl.slice(Math.max(0, i - k + 1), i + 1);
      return a.reduce(function (x, y) { return x + y; }, 0) / a.length;
    });
  }

  function dayChange(asset) {
    var c = closes(asset.data);
    return (c[c.length - 1] / c[c.length - 2] - 1) * 100;
  }

  function lastClose(asset) {
    return asset.data[asset.data.length - 1][3];
  }

  function performance(asset, range) {
    var s = slice(asset, RANGES[range]), cl = closes(s.d);
    return {
      asset: asset,
      range: range,
      change: (cl[cl.length - 1] / s.d[0][0] - 1) * 100,
      high: Math.max.apply(null, s.d.map(function (x) { return x[1]; })),
      low: Math.min.apply(null, s.d.map(function (x) { return x[2]; })),
      vol30: volAnn(closes(asset.data), 30),
      drawdown: maxDrawdown(cl),
      last: cl[cl.length - 1],
      first: s.d[0][0],
    };
  }

  function realRate() {
    return ((1 + MACRO.cdi / 100) / (1 + MACRO.ipca / 100) - 1) * 100;
  }

  return {
    Rng: Rng,
    DATES: DATES,
    ASSETS: ASSETS,
    RANGES: RANGES,
    MACRO: MACRO,
    findAsset: findAsset,
    searchAsset: searchAsset,
    slice: slice,
    closes: closes,
    volAnn: volAnn,
    maxDrawdown: maxDrawdown,
    sma: sma,
    dayChange: dayChange,
    lastClose: lastClose,
    performance: performance,
    realRate: realRate,
  };
});
