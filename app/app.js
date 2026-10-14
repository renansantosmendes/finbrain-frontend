/* Bootstraps the central screen: top bar, the four tabs and the tooltip. */
(function (root) {
  "use strict";
  var FB = root.FB;
  var app = document.getElementById("app");

  FB.topbar.init(app.querySelector(".stb"));
  FB.screens.dashboards.init(document.getElementById("tab-dashboards"));
  FB.screens.simulacoes.init(document.getElementById("tab-simulacoes"));
  FB.screens.brain.init(document.getElementById("tab-brain"));
  FB.screens.transparencia.init(document.getElementById("tab-transparencia"));
  FB.tooltip.init(app, document.getElementById("tip"));
  FB.tabs.init();
})(typeof self !== "undefined" ? self : globalThis);
