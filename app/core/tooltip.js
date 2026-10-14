/*
 * Tooltip shared by every chart of the app: candle details (open, high,
 * low, close) and the yearly points of the simulation fan. Works with the
 * mouse and with keyboard focus.
 */
(function (root) {
  "use strict";
  var FB = (root.FB = root.FB || {});

  function init(container, tip) {
    function place(x, y) {
      var w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(8, Math.min(x + 16, window.innerWidth - w - 8)) + "px";
      tip.style.top = Math.max(8, y - h - 12) + "px";
    }

    function show(target, x, y) {
      if (target.classList.contains("cd")) {
        var d = target.dataset, up = parseFloat(d.chg) >= 0;
        tip.innerHTML = "<b>" + d.d + "</b>Abertura " + d.o + "<br>Máxima " + d.h + "<br>Mínima " + d.l + "<br>Fechamento " + d.c +
          '<br><span class="' + (up ? "u" : "d") + '">' + (up ? "▲ " : "▼ ") + d.chgt + "</span>";
      } else {
        tip.innerHTML = target.getAttribute("data-tip");
      }
      tip.hidden = false;
      place(x, y);
    }

    function targetOf(event) {
      return event.target.closest ? event.target.closest(".cd,[data-tip]") : null;
    }

    container.addEventListener("mousemove", function (event) {
      var target = targetOf(event);
      if (!target) {
        tip.hidden = true;
        return;
      }
      show(target, event.clientX, event.clientY);
    });
    container.addEventListener("mouseleave", function () { tip.hidden = true; });
    container.addEventListener("focusin", function (event) {
      var target = targetOf(event);
      if (!target) return;
      var r = target.getBoundingClientRect();
      show(target, r.left + r.width / 2, r.top);
    });
    container.addEventListener("focusout", function () { tip.hidden = true; });
  }

  FB.tooltip = { init: init };
})(typeof self !== "undefined" ? self : globalThis);
