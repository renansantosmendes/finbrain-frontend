/*
 * Bootstraps the central screen: top bar, the five tabs and the tooltip.
 * The screens render first with the mock data, then the server's data is
 * loaded and announced with the "data" event so every screen redraws.
 */
(function (root) {
  "use strict";
  var FB = root.FB;
  var app = document.getElementById("app");

  FB.topbar.init(app.querySelector(".stb"));
  FB.screens.dashboards.init(document.getElementById("tab-dashboards"));
  FB.screens.simulacoes.init(document.getElementById("tab-simulacoes"));
  FB.screens.brain.init(document.getElementById("tab-brain"));
  FB.screens.transparencia.init(document.getElementById("tab-transparencia"));
  FB.screens.inicio.init(document.getElementById("tab-inicio"));
  FB.tooltip.init(app, document.getElementById("tip"));
  FB.tabs.init();

  FB.live.load().then(function (status) {
    var ibov = FB.market.findAsset("IBOV");
    if (status === "live") {
      FB.state.setSim({
        ret: FB.market.realRate(),
        vol: FB.market.volAnn(FB.market.closes(ibov.data), 251),
      });
    }
    FB.state.emit("data", status);
  });
})(typeof self !== "undefined" ? self : globalThis);
