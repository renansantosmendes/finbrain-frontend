/*
 * Login page of the V0: draws the illustrative candles of the brand panel
 * and lets any e-mail and password in (there is no real authentication
 * yet). "Acessar o sistema" and "Continuar sem conta" open the app on the
 * welcome tab, or on the tab named in the hash (login/index.html#brain).
 */
(function (root) {
  "use strict";
  var FB = (root.FB = root.FB || {});
  var APP = "../app/index.html";
  var TABS = ["inicio", "dashboards", "brain", "simulacoes", "transparencia"];
  var DELAY_MS = 900;

  function destination(hash) {
    var tab = String(hash || "").replace(/^#/, "");
    return APP + "#" + (TABS.indexOf(tab) === -1 ? TABS[0] : tab);
  }

  function drawCandles(group, average) {
    var seed = 11, count = 26, price = 100, points = [];
    function random() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (var i = 0; i < count; i++) {
      var open = price, close = open + (random() - 0.44) * 14;
      points.push([open, Math.max(open, close) + random() * 6, Math.min(open, close) - random() * 6, close]);
      price = close;
    }
    var low = Math.min.apply(null, points.map(function (p) { return p[2]; }));
    var high = Math.max.apply(null, points.map(function (p) { return p[1]; }));
    function y(value) { return 175 - (value - low) / (high - low) * 160; }
    var svg = "", path = [];
    points.forEach(function (p, index) {
      var x = 14 + index * 19.6, top = y(Math.max(p[0], p[3])), bottom = y(Math.min(p[0], p[3]));
      svg += '<g class="' + (p[3] >= p[0] ? "up" : "dn") + '"><path class="wk" d="M' + x + " " + y(p[1]) + "V" + y(p[2]) + '"/>' +
        '<rect class="bd" x="' + (x - 5.5) + '" y="' + top + '" width="11" height="' + Math.max(bottom - top, 2) + '"/></g>';
      if (index >= 4) {
        var sum = 0;
        for (var k = 0; k < 5; k++) sum += points[index - k][3];
        path.push((path.length ? "L" : "M") + x + " " + y(sum / 5));
      }
    });
    group.innerHTML = svg;
    average.setAttribute("d", path.join(""));
  }

  function init(page) {
    drawCandles(page.querySelector("#lcs"), page.querySelector("#lma"));
    var password = page.querySelector("#pw"), eye = page.querySelector("#eye");
    var submit = page.querySelector("#go"), status = page.querySelector("#st"), busy = false;

    eye.addEventListener("click", function () {
      var show = password.type === "password";
      password.type = show ? "text" : "password";
      eye.textContent = show ? "Ocultar" : "Mostrar";
      eye.setAttribute("aria-pressed", String(show));
      eye.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
    });

    page.querySelector("#fg").addEventListener("click", function () {
      status.hidden = false;
      status.textContent = "Não há senha para recuperar nesta versão. Basta entrar.";
    });

    function enter(label) {
      if (busy) return;
      busy = true;
      submit.classList.add("loading");
      submit.disabled = true;
      status.hidden = false;
      status.textContent = label;
      setTimeout(function () {
        status.textContent = "Acesso liberado. Abrindo o sistema…";
        FB.login.navigate(destination(root.location.hash));
      }, DELAY_MS);
    }

    page.querySelector("#lf").addEventListener("submit", function (event) {
      event.preventDefault();
      enter("Entrando…");
    });
    page.querySelector("#guest").addEventListener("click", function () {
      enter("Entrando como visitante…");
    });
  }

  FB.login = {
    TABS: TABS,
    destination: destination,
    navigate: function (url) { root.location.href = url; },
  };

  var page = root.document && root.document.getElementById("lg");
  if (page) init(page);
})(typeof self !== "undefined" ? self : globalThis);
