/*
 * Fills the landing page with data from the FinBrain server: the PETR4 and
 * USD/BRL candles, the indicator ticker, the watchlist, the Brain example,
 * the GARCH simulation and the table of calls this page made to the server.
 * Nothing in these blocks is typed by hand. When the server cannot supply
 * the whole picture, each block says so instead of showing example values.
 */
(function () {
  "use strict";

  var FB = window.FB;
  var format = FB.format, market = FB.market, charts = FB.charts, api = FB.api;
  var fmt = format.fmt, pc = format.pc, esc = format.esc, arrow = format.arrow;
  var UNAVAILABLE = "Não foi possível carregar os dados do servidor agora. Tente de novo em instantes.";
  var WINDOW = 60;
  var TRADING_DAYS = 252, DAYS_PER_MONTH = 21, SIM_YEARS = 2, SIM_PATHS = 500;
  var calls = [];

  function $(id) {
    return document.getElementById(id);
  }

  function html(id, markup) {
    var element = $(id);
    if (element) element.innerHTML = markup;
  }

  function text(id, value) {
    var element = $(id);
    if (element) element.textContent = value;
  }

  function direction(value) {
    return value >= 0 ? "u" : "d";
  }

  function pad(value) {
    return ("0" + value).slice(-2);
  }

  function dayAndClock(date) {
    return pad(date.getDate()) + "/" + pad(date.getMonth() + 1) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function withCaption(table, caption) {
    return table.replace('<table class="dtab">', '<table class="dtab"><caption>' + esc(caption) + "</caption>");
  }

  function stat(label, value) {
    return "<div><span>" + label + '</span><b class="num">' + value + "</b></div>";
  }

  function kpi(label, value) {
    return '<div class="kpi"><div class="k">' + label + '</div><div class="v">' + value + "</div></div>";
  }

  function digest(value) {
    if (!(window.crypto && window.crypto.subtle && window.TextEncoder)) return Promise.resolve("—");
    return window.crypto.subtle.digest("SHA-256", new window.TextEncoder().encode(value)).then(function (buffer) {
      var hex = Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
        return ("0" + byte.toString(16)).slice(-2);
      }).join("");
      return hex.slice(0, 4) + "…" + hex.slice(-4);
    });
  }

  function trace(tool, source, describe, original) {
    return function () {
      var args = Array.prototype.slice.call(arguments), at = new Date();
      return original.apply(api, args).then(function (result) {
        calls.push({ tool: tool, source: source, params: describe.apply(null, args), at: at });
        return result;
      });
    };
  }

  api.dashboard = trace("get_history", "Yahoo Finance", function (tickers, period) {
    return tickers.length + " ativos · " + period + " · diário";
  }, api.dashboard);
  api.macroSummary = trace("get_macro_series", "Banco Central · SGS", function () {
    return "Selic, CDI, IPCA 12m";
  }, api.macroSummary);
  api.macroSeries = trace("get_macro_series", "Banco Central · SGS 432", function () {
    return "Selic · 12 meses";
  }, api.macroSeries);
  api.garchAsset = trace("simulate_garch", "Servidor · GARCH(1,1)", function (body) {
    return body.ticker + " · " + body.horizon_days / TRADING_DAYS + " anos · " + body.n_paths + " trajetórias";
  }, api.garchAsset);

  function renderTrail() {
    var snapshot = calls.slice();
    return Promise.all(snapshot.map(function (call) {
      return digest(call.tool + call.source + call.params + call.at.getTime()).then(function (hash) {
        return '<tr><td class="ep">' + call.tool + "</td><td>" + esc(call.source) + '</td><td class="ep">' + esc(call.params) +
          '</td><td class="ep">' + dayAndClock(call.at) + '</td><td class="ep">' + hash + "</td></tr>";
      });
    })).then(function (rows) {
      var table = $("trailTable");
      if (table) table.querySelector("tbody").innerHTML = rows.join("") || '<tr><td colspan="5">Nenhuma chamada registrada ainda.</td></tr>';
      text("trailNote", "Chamadas reais que esta página fez ao servidor FinBrain, com horário e impressão digital.");
    });
  }

  function renderHero() {
    var asset = market.findAsset("PETR4"), slice = market.slice(asset, WINDOW), closes = market.closes(slice.d);
    var last = closes[closes.length - 1], change = (last / closes[0] - 1) * 100, candle = slice.d[slice.d.length - 1];
    var all = market.closes(asset.data);
    text("heroLabel", "PETR4 · Diário · dados do servidor FinBrain");
    html("heroPrice",
      '<span class="num" style="font-size:30px;font-weight:700;color:var(--white)">' + asset.u + " " + fmt(last, asset.d) + "</span>" +
      '<span class="num ' + direction(change) + '" style="font-size:14px;font-weight:700">' + arrow(change) + " " + fmt(Math.abs(change), 1) + "% em " + WINDOW + " pregões</span>");
    html("heroChart", charts.candles(slice.d, slice.t, asset.u, asset.d, "Candles diários de PETR4 nos últimos " + WINDOW + " pregões"));
    html("heroTable", withCaption(charts.candleTable(slice.d, slice.t, asset.d), "PETR4 (R$) · dados do servidor FinBrain"));
    html("heroStats",
      stat("Abertura", fmt(candle[0], asset.d)) + stat("Máxima", fmt(candle[1], asset.d)) +
      stat("Mínima", fmt(candle[2], asset.d)) + stat("Volatilidade 30d", fmt(market.volAnn(all, 30), 1) + "%"));
    text("heroFine", "Dados do servidor FinBrain. Informativo, não é recomendação de investimento.");
  }

  function tile(label, value, change) {
    return '<div class="tk" aria-hidden="true"><span class="k">' + label + '</span><span class="v">' + value +
      '</span><span class="dl ' + direction(change) + '">' + arrow(change) + " " + fmt(Math.abs(change), 2) + "%</span></div>";
  }

  function plain(label, value, note) {
    return '<div class="tk" aria-hidden="true"><span class="k">' + label + '</span><span class="v">' + value +
      '</span><span class="dl">' + note + "</span></div>";
  }

  function renderTicker() {
    var macro = market.MACRO, ibov = market.findAsset("IBOV"), usd = market.findAsset("USD/BRL");
    var petr = market.findAsset("PETR4"), apple = market.findAsset("AAPL");
    var items = [
      tile("IBOV", fmt(market.lastClose(ibov), ibov.d), market.dayChange(ibov)),
      tile("USD/BRL", fmt(market.lastClose(usd), usd.d), market.dayChange(usd)),
      plain("Selic", fmt(macro.selic, 2) + "% a.a.", "meta do Copom"),
      plain("IPCA 12m", fmt(macro.ipca, 1) + "%", "acumulado em 12 meses"),
      tile("PETR4", petr.u + " " + fmt(market.lastClose(petr), petr.d), market.dayChange(petr)),
      plain("CDI", fmt(macro.cdi, 2) + "% a.a.", "referência de renda fixa"),
      tile("AAPL", apple.u + " " + fmt(market.lastClose(apple), apple.d), market.dayChange(apple)),
    ].join("");
    html("tickerTrack", '<div style="display:contents">' + items + '</div><div style="display:contents">' + items + "</div>");
  }

  function renderDash() {
    var usd = market.findAsset("USD/BRL"), slice = market.slice(usd, WINDOW);
    text("dashSub", "Dados do servidor FinBrain · R$ por dólar");
    html("dashChart", charts.candles(slice.d, slice.t, usd.u, usd.d, "Candles diários de USD/BRL nos últimos " + WINDOW + " pregões"));
    html("dashTable", withCaption(charts.candleTable(slice.d, slice.t, usd.d), "USD/BRL · dados do servidor FinBrain"));
  }

  function renderWatchlist() {
    var rows = market.ASSETS.map(function (asset) {
      var day = market.dayChange(asset);
      return '<tr><td class="sym">' + asset.s + "<small>" + esc(asset.n) + '</small></td><td class="r">' + fmt(market.lastClose(asset), asset.d) +
        '</td><td class="r ' + direction(day) + '">' + arrow(day) + " " + fmt(Math.abs(day), 2) + "%</td><td>" + charts.sparkline(asset, 96, 28) + "</td></tr>";
    }).join("");
    var table = $("watchTable");
    if (table) table.querySelector("tbody").innerHTML = rows;
  }

  function renderBrain() {
    var usd = market.findAsset("USD/BRL"), closes = market.closes(usd.data);
    var change = (closes[closes.length - 1] / closes[0] - 1) * 100;
    var high = Math.max.apply(null, usd.data.map(function (bar) { return bar[1]; }));
    var low = Math.min.apply(null, usd.data.map(function (bar) { return bar[2]; }));
    html("brainAnswer", "O dólar variou <b class=\"num\" style=\"color:var(--white)\">" + pc(change, 1) +
      "</b> no período, entre máxima de R$ " + fmt(high, 2) + " e mínima de R$ " + fmt(low, 2) + ". " + esc(market.selicText()));
  }

  function monthly(values) {
    var out = [];
    for (var day = DAYS_PER_MONTH - 1; day < values.length; day += DAYS_PER_MONTH) out.push(values[day]);
    return out;
  }

  function renderFan() {
    var asset = market.findAsset("PETR4");
    return api.garchAsset({ ticker: asset.tk, horizon_days: SIM_YEARS * TRADING_DAYS, n_paths: SIM_PATHS, history_period: "2y" })
      .then(function (result) {
        var p = result.percentiles, final = result.final, last = result.last_close;
        var fan = { months: monthly(p.p50).length, p10: monthly(p.p10), p50: monthly(p.p50), p90: monthly(p.p90) };
        var money = function (value) { return "R$ " + fmt(value, 2); };
        text("fanTitle", "Simulação GARCH de PETR4 · " + SIM_YEARS + " anos");
        text("fanSub", "Preço em R$ · faixa provável de 10% a 90% · modelo GARCH(1,1) do servidor");
        html("fanChart", charts.fan(fan, {
          label: "Simulação GARCH de PETR4: faixa provável de 10% a 90% e mediana do preço, por mês",
          format: money,
          axis: function (value) { return fmt(value, 0); },
        }));
        var legend = $("fanChart").previousElementSibling;
        if (legend) {
          legend.innerHTML = '<span><i style="width:18px;height:10px;background:color-mix(in srgb,var(--teal-d) 22%,transparent)"></i>Faixa provável (10% a 90%)</span>' +
            '<span><i class="lg-ma" style="--ma:var(--teal-d)"></i>Mediana</span>';
        }
        html("fanKpis",
          kpi("Preço atual", money(last)) + kpi("Mediana em " + SIM_YEARS + " anos", money(final.p50)) +
          kpi("Faixa provável no fim", money(final.p10) + " a " + money(final.p90)) +
          kpi("Chance de fechar acima do atual", fmt(final.prob_above_last * 100, 0) + "%"));
        var rows = [1, 2].map(function (year) {
          var index = year * 12 - 1;
          return "<tr><td>" + year + "</td><td>" + fmt(fan.p10[index], 2) + "</td><td>" + fmt(fan.p50[index], 2) + "</td><td>" + fmt(fan.p90[index], 2) + "</td></tr>";
        }).join("");
        html("fanTable", withCaption(
          '<table class="dtab"><thead><tr><th>Ano</th><th>P10</th><th>Mediana</th><th>P90</th></tr></thead><tbody>' + rows + "</tbody></table>",
          "PETR4 · simulação GARCH em R$"));
        text("fanFine", "Simulação estatística com " + result.observations_used + " pregões de histórico e " + result.n_paths +
          " trajetórias; volatilidade anualizada estimada de " + fmt(result.parameters.annualized_volatility_percent, 1) +
          "%. Não é previsão nem recomendação de investimento.");
      })
      .catch(function () {
        text("fanSub", UNAVAILABLE);
        html("fanKpis", "");
        text("fanFine", "");
      });
  }

  function showUnavailable() {
    text("heroLabel", "Dados indisponíveis");
    ["heroPrice", "heroChart", "heroTable", "heroStats", "tickerTrack", "dashChart", "dashTable", "fanKpis"].forEach(function (id) {
      html(id, "");
    });
    text("heroFine", UNAVAILABLE);
    text("dashSub", UNAVAILABLE);
    text("brainAnswer", UNAVAILABLE);
    text("fanSub", UNAVAILABLE);
    text("fanFine", "");
    var table = $("watchTable");
    if (table) table.querySelector("tbody").innerHTML = "";
  }

  FB.live.load().then(function (status) {
    if (status !== "live") {
      showUnavailable();
      return renderTrail();
    }
    renderHero();
    renderTicker();
    renderDash();
    renderWatchlist();
    renderBrain();
    return renderFan().then(renderTrail);
  });
})();
