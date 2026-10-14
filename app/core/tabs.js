/*
 * Tab navigation of the central screen.
 *
 * One tab is visible at a time; the active tab is kept in the URL hash
 * (#inicio, #dashboards, #brain, #simulacoes, #transparencia) so links
 * from the landing and login pages and the browser's back button open the
 * right feature. Without a valid hash the welcome tab (Início) opens.
 * Keyboard: arrows, Home and End move between tabs (WAI-ARIA tabs pattern).
 */
(function (root) {
  "use strict";
  var FB = (root.FB = root.FB || {});
  var ORDER = ["inicio", "dashboards", "brain", "simulacoes", "transparencia"];
  var current = null;

  function tabButton(name) {
    return document.getElementById("tabbtn-" + name);
  }

  function open(name, options) {
    if (ORDER.indexOf(name) === -1) name = ORDER[0];
    var settings = options || {};
    ORDER.forEach(function (tab) {
      var selected = tab === name;
      var button = tabButton(tab);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      document.getElementById("tab-" + tab).hidden = !selected;
    });
    var changed = current !== name;
    current = name;
    if (location.hash.slice(1) !== name) {
      history.replaceState(null, "", "#" + name);
    }
    if (settings.focusTab) tabButton(name).focus();
    if (changed) {
      window.scrollTo(0, 0);
      FB.state.emit("tab", name);
    }
  }

  function setCount(name, count) {
    var badge = tabButton(name).querySelector(".cnt");
    if (!badge) return;
    badge.textContent = String(count);
    if (count) badge.removeAttribute("data-zero");
    else badge.setAttribute("data-zero", "");
  }

  function init() {
    ORDER.forEach(function (name, index) {
      var button = tabButton(name);
      button.addEventListener("click", function () { open(name); });
      button.addEventListener("keydown", function (event) {
        var next = null;
        if (event.key === "ArrowRight") next = ORDER[(index + 1) % ORDER.length];
        if (event.key === "ArrowLeft") next = ORDER[(index - 1 + ORDER.length) % ORDER.length];
        if (event.key === "Home") next = ORDER[0];
        if (event.key === "End") next = ORDER[ORDER.length - 1];
        if (next) {
          event.preventDefault();
          open(next, { focusTab: true });
        }
      });
    });
    window.addEventListener("hashchange", function () { open(location.hash.slice(1)); });
    open(location.hash.slice(1));
  }

  FB.tabs = { ORDER: ORDER, open: open, setCount: setCount, init: init, current: function () { return current; } };
})(typeof self !== "undefined" ? self : globalThis);
