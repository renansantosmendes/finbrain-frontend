/*
 * Loads the market data of the screens from the FinBrain server. The
 * server's bars replace the mock candles of market.ASSETS in place, so the
 * screens keep the same shape ([open, high, low, close] per candle and one
 * date per candle). The Brazilian macro indicators and the Selic history of
 * the last year come from the same server. When the server cannot be
 * reached the mock series stay on screen and status() reports "mock"; when
 * only part of the data arrives it reports "partial", and "live" only when
 * prices and macro indicators both came from the server.
 */
(function (root, factory) {
  var FB = (root.FB = root.FB || {});
  FB.live = factory(FB.api, FB.market);
  if (typeof module === "object" && module.exports) module.exports = FB.live;
})(typeof self !== "undefined" ? self : globalThis, function (api, market) {
  "use strict";

  var PERIOD = "1y";
  var SELIC_SERIES = "selic";
  var SELIC_DAYS = 366;
  var currentStatus = "loading";

  function isoDaysAgo(days) {
    return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  }

  function toCandles(bars) {
    return bars.map(function (bar) { return [bar.open, bar.high, bar.low, bar.close]; });
  }

  function toDates(bars) {
    return bars.map(function (bar) { return new Date(bar.date + "T00:00:00Z"); });
  }

  function applyDashboard(payload) {
    var byTicker = {};
    payload.assets.forEach(function (remote) { byTicker[remote.ticker] = remote; });
    var applied = 0;
    market.ASSETS.forEach(function (asset) {
      var remote = byTicker[asset.tk];
      if (!remote || !remote.bars || remote.bars.length < 2) return;
      asset.data = toCandles(remote.bars);
      asset.dates = toDates(remote.bars);
      asset.source = "live";
      applied += 1;
    });
    return applied;
  }

  function applyMacro(summary) {
    market.MACRO.selic = summary.selic.value;
    market.MACRO.cdi = summary.cdi.value;
    market.MACRO.ipca = summary.ipca_12m.value;
    return true;
  }

  function applySelicSeries(series) {
    var observations = series.observations || [];
    if (!observations.length) throw new Error("empty selic series");
    market.MACRO.selicHistory = observations.map(function (item) {
      return { date: item.date, value: item.value };
    });
    return true;
  }

  function statusFor(applied, macroOk) {
    if (applied === market.ASSETS.length && macroOk) return "live";
    return applied > 0 || macroOk ? "partial" : "mock";
  }

  function load() {
    var dashboard = api.dashboard(market.ASSETS.map(function (asset) { return asset.tk; }), PERIOD)
      .then(applyDashboard)
      .catch(function () { return 0; });
    var macro = Promise.all([
      api.macroSummary(),
      api.macroSeries(SELIC_SERIES, isoDaysAgo(SELIC_DAYS), isoDaysAgo(0)),
    ])
      .then(function (results) {
        applyMacro(results[0]);
        applySelicSeries(results[1]);
        return true;
      })
      .catch(function () { return false; });
    return Promise.all([dashboard, macro]).then(function (results) {
      currentStatus = statusFor(results[0], results[1]);
      return currentStatus;
    });
  }

  function status() {
    return currentStatus;
  }

  return {
    PERIOD: PERIOD,
    load: load,
    status: status,
    applyDashboard: applyDashboard,
    applyMacro: applyMacro,
    applySelicSeries: applySelicSeries,
    statusFor: statusFor,
  };
});
