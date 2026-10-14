/*
 * Simulações tab: monthly contribution simulator with sliders, the Monte
 * Carlo fan chart and the summary of final values.
 */
(function (root) {
  "use strict";
  var FB = root.FB;
  var fmt = FB.format.fmt, money = FB.format.money;
  var state = FB.state, simulation = FB.simulation;
  var panel, debounce = null;

  var FIELDS = [
    ["aporte", "Aporte mensal"],
    ["ini", "Valor inicial"],
    ["anos", "Prazo"],
    ["ret", "Retorno real a.a."],
    ["vol", "Volatilidade a.a."],
  ];

  function display(name, value) {
    if (name === "aporte" || name === "ini") return "R$ " + fmt(value, 0);
    if (name === "anos") return value + " anos";
    return fmt(value, 1) + "%";
  }

  function slider(name, label, value) {
    var limit = simulation.LIMITS[name];
    return '<label class="fl" for="sim-' + name + '">' + label + ' <output id="out-' + name + '">' + display(name, value) + "</output>" +
      '<input id="sim-' + name + '" type="range" min="' + limit.min + '" max="' + limit.max + '" step="' + limit.step + '" value="' + value + '" data-sim="' + name + '"></label>';
  }

  function render() {
    var sim = state.data.sim, result = simulation.run(sim), final = simulation.finalValues(result);
    panel.querySelector("#sim").innerHTML =
      '<div class="ah"><div><h2 class="ph" style="margin:0 0 4px">Simulação · aporte mensal</h2><div class="pn-lead">Monte Carlo com retorno real (já descontada a inflação). Ajuste as hipóteses.</div></div>' +
      '<div class="ctl"><button class="btn btn-o btn-sm" type="button" data-act="explain">Explicar com o Brain</button></div></div>' +
      '<div class="ig">' + FIELDS.map(function (f) { return slider(f[0], f[1], sim[f[0]]); }).join("") + "</div>" +
      '<div class="legend"><span><i class="lg-band"></i>Faixa provável (10% a 90%)</span><span><i class="lg-ma" style="--ma:var(--teal-l)"></i>Cenário mediano</span><span><i class="lg-inv"></i>Total aportado</span></div>' +
      '<div class="chart dark">' + FB.charts.fan(result, { compact: FB.layout.compact() }) + "</div>" +
      '<div class="sk"><div><span>Aportado</span><b>' + money(final.invested) + "</b></div><div><span>Cenário mediano</span><b>" + money(final.median) + "</b></div><div><span>Pior caso provável</span><b>" + money(final.low) + "</b></div><div><span>Melhor caso provável</span><b>" + money(final.high) + "</b></div></div>" +
      '<p class="fine">Hipóteses ilustrativas. Resultados passados não garantem resultados futuros. Não é recomendação de investimento.</p>';
  }

  function init(element) {
    panel = element;
    render();
    FB.layout.onChange(render);
    state.on("sim", function () {
      var active = document.activeElement && document.activeElement.id;
      render();
      var again = active && document.getElementById(active);
      if (again) again.focus();
    });

    panel.addEventListener("input", function (event) {
      var name = event.target.getAttribute && event.target.getAttribute("data-sim");
      if (!name) return;
      var value = parseFloat(event.target.value);
      panel.querySelector("#out-" + name).textContent = display(name, value);
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        var changes = {};
        changes[name] = value;
        state.setSim(changes);
      }, 120);
    });
    panel.addEventListener("click", function (event) {
      var target = event.target.closest("[data-act]");
      if (!target) return;
      if (target.getAttribute("data-act") === "explain") {
        var sim = state.data.sim;
        FB.screens.brain.ask("Explique a simulação atual: aporte de R$ " + fmt(sim.aporte, 0) + " por " + sim.anos + " anos", { openTab: true });
      }
    });
  }

  FB.screens = FB.screens || {};
  FB.screens.simulacoes = { init: init };
})(typeof self !== "undefined" ? self : globalThis);
