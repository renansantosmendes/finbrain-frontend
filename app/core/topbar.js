/*
 * Top bar of the central screen: indicators strip, the asset search and
 * the signed-in user (FB.user) with the link to sign out. Picking an asset
 * in the search selects it and opens the Dashboards tab.
 */
(function (root) {
  "use strict";
  var FB = root.FB;
  var fmt = FB.format.fmt, arrow = FB.format.arrow, trend = FB.format.trend;

  function indicator(asset, label) {
    var day = FB.market.dayChange(asset);
    return '<span><span class="k">' + label + '</span><span class="v">' + fmt(FB.market.lastClose(asset), asset.d) + '</span><span class="c ' + trend(day) + '">' + arrow(day) + " " + fmt(Math.abs(day), 2) + "%</span></span>";
  }

  function renderIndicators(header) {
    var macro = FB.market.MACRO;
    header.querySelector("#mini").innerHTML =
      indicator(FB.market.findAsset("IBOV"), "IBOV") +
      indicator(FB.market.findAsset("USD/BRL"), "USD/BRL") +
      '<span><span class="k">Selic</span><span class="v">' + fmt(macro.selic, 2) + "%</span></span>" +
      '<span><span class="k">IPCA 12m</span><span class="v">' + fmt(macro.ipca, 1) + "%</span></span>";
  }

  function renderSymbols(header) {
    header.querySelector("#syms").innerHTML = FB.market.ASSETS.map(function (asset) {
      return '<option value="' + asset.s + '">' + FB.format.esc(asset.n) + "</option>";
    }).join("");
  }

  function renderBadge(header) {
    var badge = header.querySelector("#srcBadge");
    var status = FB.live.status();
    if (status === "live") {
      badge.textContent = "Dados do servidor FinBrain";
      badge.title = "Cotações e indicadores vindos do servidor FinBrain";
    } else if (status === "partial") {
      badge.textContent = "Dados parciais do servidor";
      badge.title = "Parte dos dados vem de séries ilustrativas, porque o servidor não os retornou";
    } else {
      badge.textContent = "Mock · dados ilustrativos";
      badge.title = "Protótipo: as séries são geradas e não são cotações reais";
    }
  }

  function init(header) {
    renderIndicators(header);
    renderBadge(header);
    FB.state.on("data", function () {
      renderIndicators(header);
      renderBadge(header);
      renderSymbols(header);
    });

    renderSymbols(header);

    var user = FB.user.current();
    header.querySelector("#usrAv").textContent = user.initials;
    header.querySelector("#usrNm").textContent = user.name;
    header.querySelector("#usr").title = user.generic ? "Usuário genérico da V0" : user.name;

    var search = header.querySelector("#sq");
    search.addEventListener("change", function () {
      var asset = FB.market.searchAsset(search.value);
      if (!asset) return;
      FB.state.setAsset({ sym: asset.s });
      FB.tabs.open("dashboards");
      search.value = "";
    });

    var tabs = document.querySelector(".tabs");
    function syncHeight() {
      document.documentElement.style.setProperty("--stb-h", header.offsetHeight + "px");
      if (tabs) document.documentElement.style.setProperty("--tabs-h", tabs.offsetHeight + "px");
    }
    syncHeight();
    window.addEventListener("resize", syncHeight);
  }

  FB.topbar = { init: init };
})(typeof self !== "undefined" ? self : globalThis);
