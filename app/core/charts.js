/*
 * SVG builders: daily candles with moving averages, the candle table
 * alternative, sparklines and the Monte Carlo fan chart. Colors are set by
 * CSS classes, never inline, so they follow the palette tokens.
 *
 * `options.compact` draws a narrower geometry (fewer axis labels, larger
 * text) for phones, so the charts fit the screen without horizontal scroll.
 * `options.size` ({ width, height } in CSS pixels) draws the candles at the
 * real size of their box, one SVG unit per pixel, so the chart fills any
 * monitor while the text keeps the same size.
 */
(function (root, factory) {
  var FB = (root.FB = root.FB || {});
  FB.charts = factory(FB.format, FB.market);
  if (typeof module === "object" && module.exports) module.exports = FB.charts;
})(typeof self !== "undefined" ? self : globalThis, function (format, market) {
  "use strict";

  var fmt = format.fmt, dmy = format.dmy, esc = format.esc;

  var CANDLE_GEOMETRY = {
    wide: { W: 960, H: 380, x0: 6, x1: 868, y0: 20, y1: 330, tag: 86, tagH: 30, dy: 6, bottom: 18, xLabels: 7 },
    compact: { W: 560, H: 430, x0: 6, x1: 452, y0: 20, y1: 372, tag: 104, tagH: 30, dy: 6, bottom: 18, xLabels: 4 },
  };
  var MIN_FLUID_SIZE = { width: 320, height: 200 };

  function candleGeometry(options) {
    var size = options && options.size;
    if (size && size.width >= MIN_FLUID_SIZE.width && size.height >= MIN_FLUID_SIZE.height) {
      var W = Math.round(size.width), H = Math.round(size.height);
      return { W: W, H: H, x0: 4, x1: W - 70, y0: 12, y1: H - 30, tag: 64, tagH: 20, dy: 4, bottom: 10, xLabels: Math.max(3, Math.floor(W / 110)), fluid: true };
    }
    return CANDLE_GEOMETRY[options && options.compact ? "compact" : "wide"];
  }
  var FAN_GEOMETRY = {
    wide: { W: 960, H: 330, x1: 840, y1: 288, yearLabels: 6 },
    compact: { W: 560, H: 400, x1: 470, y1: 350, yearLabels: 3 },
  };

  function svgClass(options, geometry) {
    if (geometry && geometry.fluid) return ' class="fluid" width="' + geometry.W + '" height="' + geometry.H + '"';
    return options && options.compact ? ' class="compact"' : "";
  }

  function candles(data, dates, unit, decimals, label, options) {
    var g = candleGeometry(options);
    var W = g.W, H = g.H, x0 = g.x0, x1 = g.x1, y0 = g.y0, y1 = g.y1, n = data.length, hi = -1e12, lo = 1e12;
    data.forEach(function (v) { hi = Math.max(hi, v[1]); lo = Math.min(lo, v[2]); });
    var pad = (hi - lo) * 0.08;
    hi += pad;
    lo -= pad;
    function ys(v) { return y1 - (v - lo) / (hi - lo) * (y1 - y0); }
    var slot = (x1 - x0) / n, bw = Math.max(slot * 0.56, 1.4);
    var p = ["<svg" + svgClass(options, g) + ' viewBox="0 0 ' + W + " " + H + '" role="group" aria-label="' + esc(label) + '">'];
    for (var t = 0; t < 5; t++) {
      var v = lo + (hi - lo) * t / 4, y = ys(v);
      p.push('<line class="gl" x1="' + x0 + '" x2="' + x1 + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text x="' + (x1 + 8) + '" y="' + (y + g.dy).toFixed(1) + '">' + fmt(v, decimals) + "</text>");
    }
    var cl = market.closes(data);
    function line(k, cls) {
      return '<polyline class="ma ' + cls + '"' + (cls === "ma5" ? ' pathLength="1"' : "") + ' points="' + market.sma(cl, k).map(function (m, i) {
        return (x0 + (i + 0.5) * slot).toFixed(1) + "," + ys(m).toFixed(1);
      }).join(" ") + '"/>';
    }
    data.forEach(function (d, i) {
      var o = d[0], h = d[1], l = d[2], c = d[3], up = c >= o, cx = x0 + (i + 0.5) * slot;
      var top = ys(Math.max(o, c)), bot = ys(Math.min(o, c)), bh = Math.max(bot - top, 2), chg = c - o;
      var day = dmy(dates[i], true), withUnit = function (z) { return fmt(z, decimals) + " " + unit; };
      p.push(
        '<g class="cd ' + (up ? "up" : "dn") + '" tabindex="0" role="img" aria-label="' + day + ": fechamento " + withUnit(c) +
        '" data-d="' + day + '" data-o="' + withUnit(o) + '" data-h="' + withUnit(h) + '" data-l="' + withUnit(l) + '" data-c="' + withUnit(c) +
        '" data-chg="' + chg.toFixed(5) + '" data-chgt="' + (chg >= 0 ? "+" : format.MINUS) + fmt(Math.abs(chg), decimals) + " " + unit + " (" + fmt(Math.abs(chg / o * 100), 2) + '%)">' +
        '<line class="wick" x1="' + cx.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y1="' + ys(h).toFixed(1) + '" y2="' + ys(l).toFixed(1) + '"/>' +
        '<rect class="body" x="' + (cx - bw / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '"/>' +
        '<rect class="hit" x="' + (cx - slot / 2).toFixed(1) + '" y="' + y0 + '" width="' + slot.toFixed(1) + '" height="' + (y1 - y0) + '"/></g>'
      );
    });
    p.push(line(20, "ma20"));
    p.push(line(5, "ma5"));
    var last = cl[n - 1], ly = ys(last);
    p.push('<line class="last-l" x1="' + x0 + '" x2="' + x1 + '" y1="' + ly.toFixed(1) + '" y2="' + ly.toFixed(1) + '"/><rect class="tag-bg" x="' + (x1 + 3) + '" y="' + (ly - g.tagH / 2).toFixed(1) + '" width="' + g.tag + '" height="' + g.tagH + '"/><text class="tag-t" x="' + (x1 + 8) + '" y="' + (ly + g.dy).toFixed(1) + '">' + fmt(last, decimals) + "</text>");
    var step = Math.max(1, Math.floor(n / g.xLabels));
    for (var i = 0; i < n; i += step) {
      p.push('<text x="' + (x0 + (i + 0.5) * slot).toFixed(1) + '" y="' + (H - g.bottom) + '" text-anchor="' + (i === 0 && g.fluid ? "start" : "middle") + '">' + dmy(dates[i]) + "</text>");
    }
    p.push("</svg>");
    return p.join("");
  }

  function candleTable(data, dates, decimals) {
    var rows = "";
    for (var i = data.length - 1; i >= 0; i--) {
      rows += "<tr><td>" + dmy(dates[i], true) + "</td>" + data[i].map(function (v) { return "<td>" + fmt(v, decimals) + "</td>"; }).join("") + "</tr>";
    }
    return '<table class="dtab"><thead><tr><th>Data</th><th>Abertura</th><th>Máxima</th><th>Mínima</th><th>Fechamento</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }

  function sparkline(asset, width, height) {
    var w = width || 64, h = height || 22;
    var c = market.closes(asset.data).slice(-30), mn = Math.min.apply(null, c), mx = Math.max.apply(null, c), up = c[29] >= c[0];
    return '<svg class="spark ' + (up ? "up" : "dn") + '" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><polyline points="' + c.map(function (v, i) {
      return (i * w / 29).toFixed(1) + "," + (h - 2 - (v - mn) / (mx - mn + 1e-9) * (h - 4)).toFixed(1);
    }).join(" ") + '"/></svg>';
  }

  function fan(result, options) {
    var g = FAN_GEOMETRY[options && options.compact ? "compact" : "wide"];
    var W = g.W, H = g.H, x0 = 6, x1 = g.x1, y0 = 16, y1 = g.y1, months = result.months, hi = Math.max.apply(null, result.p90) * 1.05;
    function X(m) { return x0 + m * (x1 - x0) / (months - 1); }
    function Y(v) { return y1 - v / hi * (y1 - y0); }
    function points(series) { return series.map(function (v, m) { return X(m).toFixed(1) + "," + Y(v).toFixed(1); }).join(" "); }
    var f = ['<svg class="fan' + (options && options.compact ? " compact" : "") + '" viewBox="0 0 ' + W + " " + H + '" role="group" aria-label="Simulação de aporte mensal: faixa provável, cenário mediano e total aportado">'];
    for (var t = 0; t < 5; t++) {
      var v = hi * t / 4;
      f.push('<line class="gl" x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text x="' + (x0 + 4) + '" y="' + (Y(v) - 6).toFixed(1) + '">' + (v >= 1e6 ? fmt(v / 1e6, 1) + " mi" : fmt(v / 1e3, 0) + " mil") + "</text>");
    }
    f.push('<polygon class="band-p" points="' + points(result.p90) + " " + result.p10.map(function (v, m) { return [X(m), Y(v)]; }).reverse().map(function (z) { return z[0].toFixed(1) + "," + z[1].toFixed(1); }).join(" ") + '"/>');
    f.push('<polyline class="inv" points="' + points(result.inv) + '"/>');
    f.push('<polyline class="p50" points="' + points(result.p50) + '"/>');
    var step = Math.max(1, Math.ceil(months / 12 / g.yearLabels));
    for (var y = 0; y <= months / 12; y += step) {
      var mi = Math.max(0, y * 12 - 1);
      f.push('<text x="' + X(mi).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="' + (y ? "middle" : "start") + '">' + (y ? "ano " + y : "início") + "</text>");
    }
    [["P90", result.p90], ["P50", result.p50], ["P10", result.p10]].forEach(function (z) {
      f.push('<text class="lbl2" x="' + (x1 + 8) + '" y="' + (Y(z[1][months - 1]) + 5).toFixed(1) + '">' + z[0] + "</text>");
    });
    for (var year = 1; year <= months / 12; year++) {
      var m = year * 12 - 1;
      var tip = "<b>Ano " + year + "</b>Aportado " + format.money(result.inv[m]) + "<br>Mediano " + format.money(result.p50[m]) + "<br>Faixa provável " + format.money(result.p10[m]) + " a " + format.money(result.p90[m]);
      f.push('<rect class="hv" tabindex="0" data-tip="' + esc(tip) + '" aria-label="' + esc(tip.replace(/<[^>]+>/g, " ")) + '" x="' + (X(m) - Math.max(6, (x1 - x0) / months * 6)).toFixed(1) + '" y="' + y0 + '" width="' + Math.max(12, (x1 - x0) / months * 12).toFixed(1) + '" height="' + (y1 - y0) + '"/>');
    }
    f.push("</svg>");
    return f.join("");
  }

  return { candles: candles, candleTable: candleTable, sparkline: sparkline, fan: fan };
});
