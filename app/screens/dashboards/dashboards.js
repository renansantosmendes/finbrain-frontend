/*
 * Dashboards tab: watchlist, Brazil macro panel and the candle chart of the
 * selected asset (period, moving averages, chart/table toggle and stats).
 */
(function (root) {
  "use strict";
  var FB = root.FB;
  var fmt = FB.format.fmt, pc = FB.format.pc, arrow = FB.format.arrow, trend = FB.format.trend, esc = FB.format.esc;
  var market = FB.market, state = FB.state;
  var panel, chart = null, drawnKey = "";
  var FALLBACK_RATIO = 0.42, MIN_CHART_HEIGHT = 260, MAX_CHART_HEIGHT = 520;

  function chartSize(box) {
    if (FB.layout.compact()) return null;
    var width = box.clientWidth;
    if (!width) return null;
    var height = FB.layout.fitsScreen()
      ? box.clientHeight
      : Math.round(Math.min(MAX_CHART_HEIGHT, Math.max(MIN_CHART_HEIGHT, width * FALLBACK_RATIO)));
    return { width: width, height: height };
  }

  function drawChart(force) {
    var box = panel.querySelector("#asset .chart");
    if (!box || !chart) return;
    var size = chartSize(box), compact = FB.layout.compact();
    var key = chart.key + "|" + compact + "|" + (size ? size.width + "x" + size.height : "default");
    if (!force && key === drawnKey) return;
    drawnKey = key;
    box.innerHTML = FB.charts.candles(chart.data, chart.dates, chart.unit, chart.decimals, chart.label, { compact: compact, size: size });
  }

  function renderWatchlist() {
    var data = state.data;
    panel.querySelector("#wlb").innerHTML = market.ASSETS.map(function (asset) {
      var last = market.lastClose(asset), day = market.dayChange(asset);
      return '<tr tabindex="0" data-sym="' + asset.s + '" aria-selected="' + (asset.s === data.sym) + '">' +
        '<td class="sy">' + asset.s + "<small>" + esc(asset.n) + "</small></td>" +
        '<td class="r">' + fmt(last, asset.d) + "<br>" + FB.charts.sparkline(asset) + "</td>" +
        '<td class="r ' + trend(day) + '">' + arrow(day) + " " + fmt(Math.abs(day), 2) + "%</td></tr>";
    }).join("");
  }

  function renderMacro() {
    var macro = market.MACRO;
    var rows = [
      ["Selic meta", fmt(macro.selic, 2) + "% a.a.", "estável há 6 meses"],
      ["CDI", fmt(macro.cdi, 2) + "% a.a.", "estável há 6 meses"],
      ["IPCA 12 meses", fmt(macro.ipca, 1) + "%", "queda de 0,1 p.p. no mês"],
      ["Juro real (CDI − IPCA)", fmt(market.realRate(), 1) + "% a.a.", "calculado"],
    ];
    panel.querySelector("#macro").innerHTML = rows.map(function (r) {
      return '<div class="mc"><div>' + r[0] + "<small>" + r[2] + "</small></div><b>" + r[1] + "</b></div>";
    }).join("") + '<p class="fine">Valores ilustrativos.</p>';
  }

  function renderAsset() {
    var data = state.data, a = market.findAsset(data.sym), n = market.RANGES[data.rng], s = market.slice(a, n);
    var cl = market.closes(s.d), last = cl[cl.length - 1], change = (last / s.d[0][0] - 1) * 100, day = market.dayChange(a), lastCandle = s.d[s.d.length - 1];
    var hi = Math.max.apply(null, s.d.map(function (x) { return x[1]; })), lo = Math.min.apply(null, s.d.map(function (x) { return x[2]; }));
    var chartClass = (n > 100 ? "dense " : "") + (data.ma5 ? "" : "no5 ") + (data.ma20 ? "" : "no20");
    var ranges = Object.keys(market.RANGES).map(function (k) {
      return '<button type="button" data-rng="' + k + '" aria-pressed="' + (k === data.rng) + '">' + k + "</button>";
    }).join("");
    var suggestions = FB.brainEngine.suggestions(a.s).slice(0, 3).map(function (q) {
      return '<button class="chp" type="button" data-ask="' + esc(q) + '">' + esc(q) + "</button>";
    }).join("");

    panel.querySelector("#asset").innerHTML =
      '<div class="ah"><div><h1>' + a.s + "<small>" + esc(a.n) + " · " + a.u + " · diário</small></h1>" +
      '<div class="px"><b>' + fmt(last, a.d) + '</b><span class="' + trend(day) + '">' + arrow(day) + " " + fmt(Math.abs(day), 2) + '% no dia</span><span class="' + trend(change) + '">' + arrow(change) + " " + fmt(Math.abs(change), 2) + "% em " + data.rng + "</span></div></div>" +
      '<div class="ctl"><div class="seg" role="group" aria-label="Período">' + ranges + "</div>" +
      '<label class="ck"><input type="checkbox" data-ma="ma5"' + (data.ma5 ? " checked" : "") + "> Média 5d</label>" +
      '<label class="ck"><input type="checkbox" data-ma="ma20"' + (data.ma20 ? " checked" : "") + "> Média 20d</label>" +
      '<button class="tbtn" type="button" data-act="tbl" aria-expanded="' + data.showTable + '">' + (data.showTable ? "Ver como gráfico" : "Ver como tabela") + "</button></div></div>" +
      '<div class="legend" style="margin-top:10px"><span><i class="lg-up" style="--c:var(--up)"></i>▲ Alta no dia</span><span><i class="lg-dn" style="--c:var(--dn)"></i>▼ Queda no dia</span><span><i class="lg-ma" style="--ma:var(--tx-d)"></i>Média 5d</span><span><i style="width:18px;border-top:2px dashed var(--teal-l);height:0"></i>Média 20d</span></div>' +
      '<div class="chart dark ' + chartClass + (FB.layout.fitsScreen() ? " fit" : "") + '"' + (data.showTable ? " hidden" : "") + "></div>" +
      '<div class="dtab-wrap"' + (data.showTable ? "" : " hidden") + ">" + FB.charts.candleTable(s.d, s.t, a.d) + "</div>" +
      '<div class="stat"><div><span>Abertura (dia)</span><b>' + fmt(lastCandle[0], a.d) + "</b></div><div><span>Máx. do período</span><b>" + fmt(hi, a.d) + "</b></div><div><span>Mín. do período</span><b>" + fmt(lo, a.d) + "</b></div><div><span>Volatilidade 30d</span><b>" + fmt(market.volAnn(market.closes(a.data), 30), 1) + "%</b></div><div><span>Queda máx. (" + data.rng + ')</span><b class="d">' + fmt(market.maxDrawdown(cl), 1) + "%</b></div><div><span>Variação (" + data.rng + ')</span><b class="' + trend(change) + '">' + pc(change, 1) + "</b></div></div>" +
      '<div class="ask-row"><span class="ph">Perguntar ao Brain</span>' + suggestions + "</div>" +
      '<p class="fine">Série gerada para o protótipo. Não são cotações reais.</p>';
    chart = { key: a.s + data.rng, data: s.d, dates: s.t, unit: a.u, decimals: a.d, label: "Candles diários de " + a.s + " no período de " + data.rng };
    drawChart(true);
    renderWatchlist();
  }

  function selectFromRow(row) {
    state.setAsset({ sym: row.getAttribute("data-sym") });
    var asset = panel.querySelector("#asset");
    if (FB.layout.compact() && asset.scrollIntoView) asset.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function init(element) {
    panel = element;
    renderMacro();
    renderAsset();
    state.on("asset", renderAsset);
    FB.layout.onChange(renderAsset);
    FB.layout.onFitChange(renderAsset);
    if (root.ResizeObserver) {
      new root.ResizeObserver(function () { root.requestAnimationFrame(function () { drawChart(false); }); }).observe(panel.querySelector("#asset"));
    }
    FB.state.on("tab", function (name) {
      if (name === "dashboards") drawChart(false);
    });

    panel.addEventListener("click", function (event) {
      var target = event.target.closest("[data-rng],[data-act],tr[data-sym],[data-ask]");
      if (!target) return;
      if (target.hasAttribute("data-rng")) state.setAsset({ rng: target.getAttribute("data-rng") });
      else if (target.tagName === "TR") selectFromRow(target);
      else if (target.hasAttribute("data-ask")) FB.screens.brain.ask(target.getAttribute("data-ask"), { openTab: true });
      else if (target.getAttribute("data-act") === "tbl") {
        state.setAsset({ showTable: !state.data.showTable });
        panel.querySelector('[data-act="tbl"]').focus();
      }
    });
    panel.addEventListener("input", function (event) {
      var ma = event.target.getAttribute && event.target.getAttribute("data-ma");
      if (!ma) return;
      var changes = {};
      changes[ma] = event.target.checked;
      state.setAsset(changes);
      var toggle = panel.querySelector('[data-ma="' + ma + '"]');
      if (toggle) toggle.focus();
    });
    panel.addEventListener("keydown", function (event) {
      var row = event.target.closest ? event.target.closest("tr[data-sym]") : null;
      if (row && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        selectFromRow(row);
        var selected = panel.querySelector('tr[data-sym="' + state.data.sym + '"]');
        if (selected) selected.focus();
      }
    });
  }

  FB.screens = FB.screens || {};
  FB.screens.dashboards = { init: init };
})(typeof self !== "undefined" ? self : globalThis);
