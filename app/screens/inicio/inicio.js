/*
 * Início tab: the welcome screen shown after the login. It greets the
 * user (FB.user), summarizes the market, presents the other four tabs and
 * offers quick starts; "Sua sessão" follows the shared state, so it shows
 * where the user left off in the other tabs.
 */
(function (root) {
  "use strict";
  var FB = root.FB;
  var esc = FB.format.esc, fmt = FB.format.fmt, arrow = FB.format.arrow, trend = FB.format.trend;
  var state = FB.state, market = FB.market;
  var panel;

  var FEATURES = [
    { tab: "dashboards", title: "Dashboards", text: "Watchlist, indicadores do Brasil e o gráfico de candles de cada ativo.", icon: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>' },
    { tab: "brain", title: "Brain", text: "Pergunte sobre um ativo, a economia ou uma simulação. Ele informa, não recomenda.", icon: '<path d="M4 5h16v11H9l-5 4z"/>' },
    { tab: "simulacoes", title: "Simulações", text: "Veja a faixa provável do preço de um ativo, calculada por um modelo GARCH.", icon: '<path d="M4 18c4-10 8 4 16-12"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="6" r="1.5"/>' },
    { tab: "transparencia", title: "Transparência", text: "A fonte, os parâmetros e o horário de cada consulta do Brain.", icon: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>' },
  ];

  var QUICK_STARTS = [
    { attrs: 'data-asset="PETR4"', title: "Ver o gráfico da PETR4", text: "Abre os Dashboards com a Petrobras em foco." },
    { attrs: 'data-ask="Como estão a Selic e o IPCA?"', title: "Como estão a Selic e o IPCA?", text: "Pergunta ao Brain sobre os juros e a inflação." },
    { attrs: 'data-sim-asset="PETR4"', title: "Simular a PETR4", text: "Abre Simulações com a Petrobras selecionada." },
  ];

  function longDate(date) {
    return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  function renderHello(now) {
    var user = FB.user.current();
    panel.querySelector("#hiTitle").textContent = FB.user.greeting(now) + ", " + user.firstName;
    var live = FB.live.status() === "live";
    var lastDate = market.lastDate(market.findAsset("IBOV"));
    panel.querySelector("#hiDate").textContent = longDate(now) + (live ? " · dados até " : " · dados ilustrativos até ") + FB.format.dmy(lastDate, true);
    panel.querySelector("#hiNote").textContent = live
      ? "Cotações e indicadores do servidor FinBrain. Não são recomendação de investimento."
      : "Séries ilustrativas da V0, não são cotações reais.";
  }

  function tile(symbol, label) {
    var asset = market.findAsset(symbol), day = market.dayChange(asset);
    return '<div class="hi-mk"><span class="k">' + label + '</span><b class="num">' + fmt(market.lastClose(asset), asset.d) + "</b>" +
      '<span class="c ' + trend(day) + '">' + arrow(day) + " " + fmt(Math.abs(day), 2) + "%</span>" + FB.charts.sparkline(asset, 88, 26) + "</div>";
  }

  function renderMarket() {
    var macro = market.MACRO;
    panel.querySelector("#hiMarket").innerHTML =
      tile("IBOV", "Ibovespa") + tile("USD/BRL", "Dólar") +
      '<div class="hi-mk"><span class="k">Selic</span><b class="num">' + fmt(macro.selic, 2) + '%</b><span class="c">ao ano</span></div>' +
      '<div class="hi-mk"><span class="k">IPCA 12m</span><b class="num">' + fmt(macro.ipca, 1) + '%</b><span class="c">inflação</span></div>';
  }

  function renderFeatures() {
    panel.querySelector("#hiFeatures").innerHTML = FEATURES.map(function (feature) {
      return '<button class="hi-ft" type="button" data-goto="' + feature.tab + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + feature.icon + "</svg>" +
        "<b>" + feature.title + "</b><span>" + feature.text + '</span><span class="hi-go">Abrir ' + feature.title + ' <span aria-hidden="true">→</span></span></button>';
    }).join("");
  }

  function renderQuickStarts() {
    panel.querySelector("#hiQuick").innerHTML = QUICK_STARTS.map(function (item) {
      return '<button class="hi-qs" type="button" ' + item.attrs + "><b>" + esc(item.title) + "</b><span>" + esc(item.text) + "</span></button>";
    }).join("");
  }

  function renderSession() {
    var data = state.data, asset = market.findAsset(data.sym), day = market.dayChange(asset), calls = data.trail.length;
    panel.querySelector("#hiSession").innerHTML =
      '<div class="kv"><span>Ativo em foco<small>' + esc(asset.n) + "</small></span><b>" + esc(asset.s) + ' <span class="' + trend(day) + '">' + arrow(day) + "</span></b></div>" +
      '<div class="kv"><span>Consultas do Brain<small>registradas na Transparência</small></span><b>' + calls + "</b></div>";
  }

  function onClick(event) {
    var target = event.target.closest("[data-goto],[data-ask],[data-asset],[data-sim-asset]");
    if (!target) return;
    if (target.hasAttribute("data-goto")) {
      FB.tabs.open(target.getAttribute("data-goto"));
    } else if (target.hasAttribute("data-ask")) {
      FB.screens.brain.ask(target.getAttribute("data-ask"), { openTab: true });
    } else if (target.hasAttribute("data-asset")) {
      state.setAsset({ sym: target.getAttribute("data-asset") });
      FB.tabs.open("dashboards");
    } else {
      state.setAsset({ sym: target.getAttribute("data-sim-asset") });
      FB.tabs.open("simulacoes");
    }
  }

  function init(element) {
    panel = element;
    renderHello(new Date());
    renderMarket();
    renderFeatures();
    renderQuickStarts();
    renderSession();
    state.on("asset", renderSession);
    state.on("trail", renderSession);
    state.on("data", function () {
      renderHello(new Date());
      renderMarket();
      renderSession();
    });
    state.on("tab", function (name) {
      if (name === "inicio") renderHello(new Date());
    });
    panel.addEventListener("click", onClick);
  }

  FB.screens = FB.screens || {};
  FB.screens.inicio = { init: init };
})(typeof self !== "undefined" ? self : globalThis);
