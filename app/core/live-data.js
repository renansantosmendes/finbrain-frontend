/*
 * Loads the market data of the central screen from the FinBrain server. The
 * server's bars replace the mock candles of market.ASSETS in place, so the
 * screens keep the same shape ([open, high, low, close] per candle and one
 * date per candle). The Brazilian macro indicators come from the same
 * server. When the server cannot be reached the mock series stay on screen
 * and status() reports "mock", so the pages never show an empty state.
 */
(function (root, factory) {
  var FB = (root.FB = root.FB || {});
  FB.live = factory(FB.api, FB.market);
  if (typeof module === "object" && module.exports) module.exports = FB.live;
})(typeof self !== "undefined" ? self : globalThis, function (api, market) {
  "use strict";

  var PERIOD = "1y";
  var currentStatus = "loading";

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

  function statusFor(applied) {
    if (applied === market.ASSETS.length) return "live";
    return applied > 0 ? "partial" : "mock";
  }

  function load() {
    var dashboard = api.dashboard(market.ASSETS.map(function (asset) { return asset.tk; }), PERIOD)
      .then(applyDashboard)
      .catch(function () { return 0; });
    var macro = api.macroSummary()
      .then(applyMacro)
      .catch(function () { return false; });
    return Promise.all([dashboard, macro]).then(function (results) {
      currentStatus = statusFor(results[0]);
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
    statusFor: statusFor,
  };
});
