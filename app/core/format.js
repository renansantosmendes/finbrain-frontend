/*
 * Formatting helpers (pt-BR numbers, dates, money and HTML escaping).
 * Loaded in the browser as FB.format and in Node tests via require().
 */
(function (root, factory) {
  var FB = (root.FB = root.FB || {});
  FB.format = factory();
  if (typeof module === "object" && module.exports) module.exports = FB.format;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  var MINUS = "−";

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmt(value, decimals) {
    return Number(value).toLocaleString("pt-BR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function pc(value, decimals) {
    return (value >= 0 ? "+" : MINUS) + fmt(Math.abs(value), decimals == null ? 2 : decimals) + "%";
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function norm(text) {
    return String(text).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function dmy(date, withYear) {
    return pad2(date.getUTCDate()) + "/" + pad2(date.getUTCMonth() + 1) + (withYear ? "/" + date.getUTCFullYear() : "");
  }

  function money(value) {
    return value >= 1e6 ? "R$ " + fmt(value / 1e6, 2) + " mi" : "R$ " + fmt(value / 1e3, 0) + " mil";
  }

  function arrow(value) {
    return value >= 0 ? "▲" : "▼";
  }

  function trend(value) {
    return value >= 0 ? "u" : "d";
  }

  return { MINUS: MINUS, esc: esc, fmt: fmt, pc: pc, pad2: pad2, norm: norm, dmy: dmy, money: money, arrow: arrow, trend: trend };
});
