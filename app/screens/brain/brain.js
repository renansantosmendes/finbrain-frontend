/*
 * Brain tab: the conversation with the simulated agent and a side panel
 * with the context it is using (asset in focus, current simulation and the
 * number of recorded calls). Other tabs ask questions through
 * FB.screens.brain.ask(question, { openTab: true }).
 */
(function (root) {
  "use strict";
  var FB = root.FB;
  var esc = FB.format.esc, fmt = FB.format.fmt, arrow = FB.format.arrow, trend = FB.format.trend, money = FB.format.money;
  var state = FB.state, market = FB.market, simulation = FB.simulation;
  var panel, messages = [], busy = false;
  var THINK_DELAY_MS = 750;

  function tools(list) {
    return '<div class="tools">' + list.map(function (x) { return '<span class="tool">⚙ ' + esc(x) + "</span>"; }).join("") + "</div>";
  }

  function refs(list) {
    return '<div class="refs">' + list.map(function (x) { return '<span class="ref">' + esc(x) + "</span>"; }).join("") + "</div>";
  }

  function renderMessages() {
    var box = panel.querySelector("#bm");
    box.innerHTML = messages.map(function (m) {
      if (m.role === "user") return '<div class="msg-u">' + esc(m.text) + "</div>";
      var r = m.reply;
      return '<div class="msg-a' + (r.cls ? " " + r.cls : "") + '">' +
        (r.tools && r.tools.length ? tools(r.tools) : "") + r.html +
        (r.refs && r.refs.length ? refs(r.refs) : "") +
        (r.goto ? '<div class="goto"><button class="lnk" type="button" data-goto="' + r.goto.tab + '">' + esc(r.goto.label) + " →</button></div>" : "") +
        '<div class="note">' + esc(r.note || "Informativo, não é recomendação de investimento. Dados ilustrativos.") + "</div></div>";
    }).join("") + (busy ? '<div class="typing"><span class="spin"></span>Consultando as fontes…</div>' : "");
    box.scrollTop = box.scrollHeight;
  }

  function renderChips() {
    panel.querySelector("#bc").innerHTML = FB.brainEngine.suggestions(state.data.sym).map(function (q) {
      return '<button class="chp" type="button" data-ask="' + esc(q) + '">' + esc(q) + "</button>";
    }).join("");
  }

  function renderContext() {
    var a = market.findAsset(state.data.sym), day = market.dayChange(a);
    panel.querySelector("#ctxAsset").innerHTML =
      '<div class="ctx-asset"><div><b>' + a.s + "</b><small>" + esc(a.n) + "</small></div>" + FB.charts.sparkline(a, 72, 26) +
      '<div class="num">' + fmt(market.lastClose(a), a.d) + '<br><span class="' + trend(day) + '">' + arrow(day) + " " + fmt(Math.abs(day), 2) + "%</span></div></div>" +
      '<div class="ctx-actions"><button class="lnk" type="button" data-goto="dashboards">Ver no painel →</button></div>';

    var sim = state.data.sim, final = simulation.finalValues(simulation.run(sim));
    panel.querySelector("#ctxSim").innerHTML =
      '<div class="kv"><span>Aporte mensal</span><b>R$ ' + fmt(sim.aporte, 0) + "</b></div>" +
      '<div class="kv"><span>Prazo</span><b>' + sim.anos + " anos</b></div>" +
      '<div class="kv"><span>Cenário mediano</span><b>' + money(final.median) + "</b></div>" +
      '<div class="ctx-actions"><button class="lnk" type="button" data-goto="simulacoes">Abrir Simulações →</button></div>';

    var count = state.data.trail.length;
    panel.querySelector("#ctxTrail").innerHTML =
      '<div class="kv"><span>Chamadas registradas</span><b>' + count + "</b></div>" +
      '<div class="ctx-actions"><button class="lnk" type="button" data-goto="transparencia">Ver a trilha completa →</button></div>';
  }

  function ask(question, options) {
    var text = String(question || "").trim();
    if (options && options.openTab) FB.tabs.open("brain");
    if (busy || !text) return;
    busy = true;
    messages.push({ role: "user", text: text });
    renderMessages();
    setTimeout(function () {
      var data = state.data;
      var result = FB.brainEngine.think(text, { sym: data.sym, rng: data.rng, sim: data.sim });
      if (result.changes.asset) state.setAsset(result.changes.asset);
      if (result.changes.sim) state.setSim(result.changes.sim);
      result.calls.forEach(function (call) { state.logCall(call[0], call[1], call[2]); });
      messages.push({ role: "agent", reply: result.reply });
      busy = false;
      renderMessages();
    }, THINK_DELAY_MS);
  }

  function init(element) {
    panel = element;
    messages.push({ role: "agent", reply: FB.brainEngine.GREETING });
    renderMessages();
    renderChips();
    renderContext();
    state.on("asset", function () { renderChips(); renderContext(); });
    state.on("sim", renderContext);
    state.on("trail", renderContext);

    var input = panel.querySelector("#bq"), form = panel.querySelector("#bf");
    function fitInput() {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 132) + "px";
      input.style.overflowY = input.scrollHeight > 132 ? "auto" : "hidden";
    }
    function fitPlaceholder() {
      input.placeholder = FB.layout.compact() ? "Pergunte ao Brain…" : "Pergunte sobre o ativo, a economia ou uma simulação…";
    }
    fitPlaceholder();
    FB.layout.onChange(fitPlaceholder);
    input.addEventListener("input", fitInput);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      input.value = "";
      fitInput();
      ask(text);
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (form.requestSubmit) form.requestSubmit();
        else panel.querySelector("#bsend").click();
      }
    });
    panel.addEventListener("click", function (event) {
      var target = event.target.closest("[data-ask],[data-goto]");
      if (!target) return;
      if (target.hasAttribute("data-ask")) ask(target.getAttribute("data-ask"));
      else FB.tabs.open(target.getAttribute("data-goto"));
    });
    state.on("tab", function (name) {
      if (name === "brain") input.focus();
    });
  }

  FB.screens = FB.screens || {};
  FB.screens.brain = { init: init, ask: ask };
})(typeof self !== "undefined" ? self : globalThis);
