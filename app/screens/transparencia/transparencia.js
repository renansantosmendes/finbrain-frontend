/*
 * Transparência tab: every tool call behind the Brain's answers, with
 * source, parameters, time of the query and a fingerprint (hash), plus
 * what the FinBrain does and does not do.
 */
(function (root) {
  "use strict";
  var FB = root.FB;
  var esc = FB.format.esc, state = FB.state;
  var panel;

  function render() {
    var trail = state.data.trail;
    var sources = {};
    trail.forEach(function (entry) { sources[entry.src.split(" · ")[0]] = true; });
    FB.tabs.setCount("transparencia", trail.length);

    panel.querySelector("#trailSum").innerHTML =
      "<div><span>Chamadas</span><b>" + trail.length + "</b></div>" +
      "<div><span>Fontes distintas</span><b>" + Object.keys(sources).length + "</b></div>" +
      "<div><span>Última consulta</span><b>" + (trail.length ? esc(trail[trail.length - 1].at) : "—") + "</b></div>";

    var body = panel.querySelector("#trailBody");
    if (!trail.length) {
      body.innerHTML = '<div class="empty"><p>Nenhuma chamada ainda. Quando o Brain consultar dados ou fizer um cálculo, a chamada aparece aqui com fonte, parâmetros e horário.</p><button class="btn btn-t btn-sm" type="button" data-goto="brain">Perguntar ao Brain</button></div>';
      return;
    }
    body.innerHTML = '<div class="tw"><table class="trail-t"><caption class="sr">Chamadas de ferramenta registradas, da mais recente para a mais antiga</caption>' +
      "<thead><tr><th>Ferramenta</th><th>Fonte</th><th>Parâmetros</th><th>Consultado</th><th>Hash</th></tr></thead><tbody>" +
      trail.slice().reverse().map(function (entry) {
        return '<tr><td class="tl" data-label="Ferramenta">' + esc(entry.tool) + '</td><td data-label="Fonte">' + esc(entry.src) + '</td><td class="ep" data-label="Parâmetros">' + esc(entry.params) + '</td><td class="ep" data-label="Consultado">' + esc(entry.at) + '</td><td class="ep" data-label="Hash">' + esc(entry.hash) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function init(element) {
    panel = element;
    render();
    state.on("trail", render);
    panel.addEventListener("click", function (event) {
      var target = event.target.closest("[data-goto]");
      if (target) FB.tabs.open(target.getAttribute("data-goto"));
    });
  }

  FB.screens = FB.screens || {};
  FB.screens.transparencia = { init: init };
})(typeof self !== "undefined" ? self : globalThis);
