/*
 * Simulações tab: GARCH(1,1) simulation of an asset's price, run by the
 * FinBrain server. The asset follows the one in focus on Dashboards; the
 * user picks the horizon in years and the history the model is fitted on,
 * then runs it. The fan shows the 10% to 90% band and the median, sampled
 * monthly from the server's daily percentiles.
 */
(function (root) {
  "use strict";
  var FB = root.FB;
  var fmt = FB.format.fmt, esc = FB.format.esc;
  var market = FB.market, state = FB.state, api = FB.api;
  var panel;

  var TRADING_DAYS = 252, DAYS_PER_MONTH = 21, PATHS = 500;
  var HORIZONS = [1, 2, 3];
  var HISTORIES = [["1y", "1 ano"], ["2y", "2 anos"], ["5y", "5 anos"]];
  var MESSAGES = {
    asset_not_found: "O servidor não conhece este ativo.",
    upstream_unavailable: "A fonte de dados está indisponível agora. Tente novamente em instantes.",
    simulation_failed: "A simulação não pôde ser concluída com estes dados.",
    validation_error: "Os parâmetros da simulação não são aceitos pelo servidor.",
    network: "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
    no_fetch: "Este navegador não permite falar com o servidor.",
  };

  var form = { sym: state.data.sym, years: 1, history: "2y" };
  var view = idle();
  var requestId = 0;

  function idle() {
    return { status: "idle", asset: null, result: null, error: "" };
  }

  function messageFor(error) {
    return (error && MESSAGES[error.code]) || "Não foi possível concluir a simulação. Tente novamente.";
  }

  function monthly(values) {
    var out = [];
    for (var day = DAYS_PER_MONTH - 1; day < values.length; day += DAYS_PER_MONTH) out.push(values[day]);
    return out;
  }

  function toFanResult(result) {
    var p = result.percentiles;
    return { months: monthly(p.p50).length, p10: monthly(p.p10), p50: monthly(p.p50), p90: monthly(p.p90) };
  }

  function priceText(asset) {
    return function (value) {
      var text = fmt(value, asset.d);
      return asset.u === "pts" ? text + " pts" : asset.u + " " + text;
    };
  }

  function selectOption(value, text, selected) {
    return '<option value="' + esc(value) + '"' + (selected ? " selected" : "") + ">" + esc(text) + "</option>";
  }

  function controls() {
    var assets = market.ASSETS.map(function (asset) {
      return selectOption(asset.s, asset.n, asset.s === form.sym);
    }).join("");
    var horizons = HORIZONS.map(function (years) {
      return selectOption(String(years), years + (years === 1 ? " ano" : " anos"), years === form.years);
    }).join("");
    var histories = HISTORIES.map(function (item) {
      return selectOption(item[0], item[1], item[0] === form.history);
    }).join("");
    var loading = view.status === "loading";
    return '<div class="ah"><div><h2 class="ph" style="margin:0 0 4px">Simulação · GARCH(1,1)</h2>' +
      '<div class="pn-lead">Trajetórias do preço calculadas pelo servidor FinBrain a partir do histórico do ativo. Não considera aportes.</div></div>' +
      '<div class="ctl"><button class="btn btn-o btn-sm" type="button" data-act="explain">Explicar com o Brain</button></div></div>' +
      '<div class="ig">' +
      '<label class="fl" for="sim-ativo">Ativo<select id="sim-ativo" data-field="sym">' + assets + "</select></label>" +
      '<label class="fl" for="sim-horizonte">Horizonte<select id="sim-horizonte" data-field="years">' + horizons + "</select></label>" +
      '<label class="fl" for="sim-historico">Histórico do ajuste<select id="sim-historico" data-field="history">' + histories + "</select></label>" +
      '<div class="fl"><span>&nbsp;</span><button class="btn btn-t btn-sm' + (loading ? " loading" : "") + '" type="button" data-act="run"' + (loading ? " disabled" : "") + ">Simular</button></div>" +
      "</div>";
  }

  function body() {
    if (view.status === "loading") {
      return '<p class="gs-status" role="status">Consultando o servidor e simulando ' + PATHS + " trajetórias…</p>";
    }
    if (view.status === "error") {
      return '<p class="gs-status gs-error" role="alert">' + esc(view.error) + "</p>";
    }
    if (view.status !== "ready") {
      return '<p class="gs-status">Escolha o ativo e o horizonte e clique em Simular.</p>';
    }
    return chart() + summary();
  }

  function chart() {
    var asset = view.asset, result = view.result;
    var label = "Simulação GARCH de " + asset.s + ": faixa provável de 10% a 90% e mediana do preço, por mês";
    return '<div class="legend"><span><i class="lg-band"></i>Faixa provável (10% a 90%)</span><span><i class="lg-ma" style="--ma:var(--teal-l)"></i>Mediana</span></div>' +
      '<div class="chart dark">' + FB.charts.fan(toFanResult(result), {
        compact: FB.layout.compact(),
        label: label,
        format: priceText(asset),
        axis: function (value) { return fmt(value, asset.d); },
      }) + "</div>";
  }

  function summary() {
    var asset = view.asset, result = view.result, final = result.final, params = result.parameters;
    var last = result.last_close;
    return '<div class="sk"><div><span>Preço atual</span><b>' + priceText(asset)(last) + "</b></div>" +
      '<div><span>Mediana no fim do horizonte</span><b>' + priceText(asset)(final.p50) + "</b></div>" +
      '<div><span>Faixa provável no fim</span><b>' + priceText(asset)(final.p10) + " a " + priceText(asset)(final.p90) + "</b></div>" +
      '<div><span>Chance de fechar acima do preço atual</span><b>' + fmt(final.prob_above_last * 100, 0) + "%</b></div></div>" +
      '<p class="fine">Volatilidade anualizada estimada: ' + fmt(params.annualized_volatility_percent, 1) + "% · dados de " + result.observations_used + " pregões · " + result.n_paths + " trajetórias. " +
      "Simulação estatística a partir do histórico, não é previsão nem recomendação de investimento.</p>";
  }

  function render() {
    panel.querySelector("#sim").innerHTML = controls() + body();
  }

  function run() {
    var asset = market.findAsset(form.sym), id = ++requestId;
    view = { status: "loading", asset: asset, result: null, error: "" };
    render();
    api.garchAsset({
      ticker: asset.tk,
      horizon_days: form.years * TRADING_DAYS,
      n_paths: PATHS,
      history_period: form.history,
    }).then(function (result) {
      if (id !== requestId) return;
      view = { status: "ready", asset: asset, result: result, error: "" };
      render();
    }, function (error) {
      if (id !== requestId) return;
      view = { status: "error", asset: asset, result: null, error: messageFor(error) };
      render();
    });
  }

  function discardResult() {
    requestId += 1;
    view = idle();
  }

  function onFocusChange() {
    if (state.data.sym === form.sym) return;
    form.sym = state.data.sym;
    discardResult();
    render();
  }

  function init(element) {
    panel = element;
    render();
    FB.layout.onChange(render);
    state.on("asset", onFocusChange);

    panel.addEventListener("change", function (event) {
      var field = event.target.getAttribute && event.target.getAttribute("data-field");
      if (!field) return;
      form[field] = field === "years" ? Number(event.target.value) : event.target.value;
      discardResult();
      render();
      var again = panel.querySelector('[data-field="' + field + '"]');
      if (again) again.focus();
    });
    panel.addEventListener("click", function (event) {
      var target = event.target.closest("[data-act]");
      if (!target || target.disabled) return;
      var action = target.getAttribute("data-act");
      if (action === "run") run();
      else if (action === "explain") {
        var asset = market.findAsset(form.sym);
        FB.screens.brain.ask("Explique a simulação GARCH de " + asset.s + " no horizonte de " + form.years + (form.years === 1 ? " ano" : " anos"), { openTab: true });
      }
    });
  }

  FB.screens = FB.screens || {};
  FB.screens.simulacoes = { init: init };
})(typeof self !== "undefined" ? self : globalThis);
