/*
 * Homebroker tab: intraday monitor of one asset. The price comes from the
 * quote endpoint, which the server caches for 60 seconds, and refreshes
 * every minute while the tab is open. The intraday line comes from 5-minute
 * bars, which the server caches for 15 minutes, so it can lag behind the
 * quote. The bars carry no time of day, so the chart has no time axis. No
 * example data is shown: without the server the tab says so.
 */
(function (root) {
  "use strict";
  var FB = root.FB;
  var fmt = FB.format.fmt, esc = FB.format.esc, arrow = FB.format.arrow;
  var market = FB.market, state = FB.state, api = FB.api, charts = FB.charts;
  var panel = null, timer = null, requestId = 0, historyAt = 0;
  var QUOTE_REFRESH_MS = 60000, HISTORY_REFRESH_MS = 300000;
  var session = { sym: "PETR4", quote: null, bars: null, error: "", loading: false };

  function selectedAsset() {
    return market.ASSETS.filter(function (asset) { return asset.s === session.sym; })[0] || null;
  }

  function clockOf(isoTime) {
    var date = new Date(isoTime);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function dayRange(bars) {
    var high = -Infinity, low = Infinity;
    bars.forEach(function (bar) {
      high = Math.max(high, bar.high);
      low = Math.min(low, bar.low);
    });
    return { open: bars[0].open, high: high, low: low, last: bars[bars.length - 1].close };
  }

  function stat(label, value) {
    return "<div><span>" + label + '</span><b class="num">' + value + "</b></div>";
  }

  function symbolOptions() {
    return market.ASSETS.filter(function (asset) { return asset.tk; }).map(function (asset) {
      return '<option value="' + esc(asset.s) + '"' + (asset.s === session.sym ? " selected" : "") + ">" + esc(asset.s + " · " + asset.n) + "</option>";
    }).join("");
  }

  function header() {
    return '<div class="ah"><div><h2 class="ph" style="margin:0 0 4px">Homebroker · acompanhamento do dia</h2>' +
      '<div class="pn-lead">Cotação do servidor FinBrain, atualizada a cada minuto enquanto esta aba está aberta.</div></div>' +
      '<div class="hb-pick"><label class="fl" for="hb-ativo">Ativo<select id="hb-ativo" data-field="sym">' + symbolOptions() + "</select></label></div></div>";
  }

  function priceBlock(quote) {
    var change = quote.day_change_percent;
    var cls = change >= 0 ? "up" : "dn";
    return '<div class="hb-price"><b class="num">' + esc(quote.currency === "BRL" ? "R$" : quote.currency) + " " + fmt(quote.price, 2) + "</b>" +
      '<span class="hb-change ' + cls + '">' + arrow(change) + " " + fmt(Math.abs(change), 2) + "% no dia</span>" +
      '<span class="hb-time">Última cotação do servidor: ' + clockOf(quote.market_time) + " (Brasília)</span></div>";
  }

  function statsBlock(quote, range) {
    var value = function (number) { return number === null ? "—" : fmt(number, 2); };
    var volume = quote.volume ? Math.round(quote.volume).toLocaleString("pt-BR") : "—";
    var average = quote.average_volume ? Math.round(quote.average_volume).toLocaleString("pt-BR") : "—";
    return '<div class="sk">' + stat("Abertura", value(range && range.open)) + stat("Máxima do dia", value(range && range.high)) +
      stat("Mínima do dia", value(range && range.low)) + stat("Fechamento anterior", fmt(quote.previous_close, 2)) +
      stat("Volume no dia", volume) + stat("Volume médio", average) + "</div>";
  }

  function chartBlock() {
    return '<div class="chart dark hb-chart" id="hbChart"></div>';
  }

  function drawChart() {
    var asset = selectedAsset(), box = panel.querySelector("#hbChart");
    if (!box || !asset || !session.bars || !session.bars.length) return;
    var closes = session.bars.map(function (bar) { return bar.close; });
    var width = box.clientWidth, height = box.clientHeight;
    box.innerHTML = charts.intraday(closes, {
      size: width && height ? { width: width, height: height } : null,
      label: "Preço de " + asset.s + " em barras de 5 minutos, no pregão de hoje",
      decimals: asset.d,
      unit: asset.u,
    });
  }

  function messageBlock(status, text) {
    return '<p class="gs-status' + (status === "error" ? " gs-error" : "") + '" role="' + (status === "error" ? "alert" : "status") + '">' + esc(text) + "</p>";
  }

  function render() {
    var asset = selectedAsset();
    var body;
    if (!asset) {
      body = messageBlock("error", "Escolha um ativo do servidor.");
    } else if (session.error) {
      body = messageBlock("error", session.error);
    } else if (!session.quote) {
      body = messageBlock("status", "Consultando o servidor…");
    } else {
      var range = session.bars && session.bars.length ? dayRange(session.bars) : null;
      body = priceBlock(session.quote) + statsBlock(session.quote, range) +
        (session.bars && session.bars.length ? chartBlock() : messageBlock("status", "Gráfico intradiário indisponível agora.")) +
        '<p class="fine">Cotação com cache de 60 segundos no servidor. O gráfico usa barras de 5 minutos, que podem atrasar até 15 minutos e não trazem o horário de cada barra. Informativo, não é recomendação de investimento.</p>';
    }
    panel.querySelector("#hb").innerHTML = header() + body;
    drawChart();
  }

  function fetchHistory(asset) {
    return api.history(asset.tk, "1d", "5m").then(function (payload) {
      return payload.bars || [];
    });
  }

  function refresh(forceHistory) {
    var asset = selectedAsset();
    if (!asset) return;
    var id = ++requestId;
    var historyDue = forceHistory || !session.bars || Date.now() - historyAt >= HISTORY_REFRESH_MS;
    var quoteRequest = api.quote(asset.tk);
    var historyRequest = historyDue ? fetchHistory(asset) : Promise.resolve(null);
    session.loading = true;
    Promise.all([
      quoteRequest,
      historyRequest.then(function (bars) { return { bars: bars, failed: false }; }, function () { return { bars: null, failed: true }; }),
    ]).then(function (results) {
      if (id !== requestId) return;
      session.loading = false;
      session.quote = results[0];
      session.error = "";
      if (results[1].bars) {
        session.bars = results[1].bars;
        historyAt = Date.now();
      }
      render();
    }, function (error) {
      if (id !== requestId) return;
      session.loading = false;
      session.quote = null;
      session.error = error && error.code === "asset_not_found"
        ? "O servidor não encontrou dados deste ativo."
        : "Não foi possível falar com o servidor agora. A cotação será tentada de novo em um minuto.";
      render();
    });
  }

  function start() {
    stop();
    refresh(true);
    timer = setInterval(function () { refresh(false); }, QUOTE_REFRESH_MS);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function changeAsset(sym) {
    session.sym = sym;
    session.quote = null;
    session.bars = null;
    session.error = "";
    historyAt = 0;
    requestId += 1;
    render();
    refresh(true);
  }

  function init(element) {
    panel = element;
    render();
    if (root.ResizeObserver) {
      new root.ResizeObserver(function () { root.requestAnimationFrame(drawChart); }).observe(panel);
    }
    state.on("tab", function (name) {
      if (name === "homebroker") start();
      else stop();
    });
    panel.addEventListener("change", function (event) {
      if (event.target.getAttribute && event.target.getAttribute("data-field") === "sym") {
        changeAsset(event.target.value);
        var again = panel.querySelector("#hb-ativo");
        if (again) again.focus();
      }
    });
    state.on("data", function () {
      if (!session.quote && !session.loading && FB.tabs.current() === "homebroker") refresh(true);
    });
  }

  FB.screens = FB.screens || {};
  FB.screens.homebroker = { init: init, clockOf: clockOf, dayRange: dayRange, stop: stop };
})(typeof self !== "undefined" ? self : globalThis);
