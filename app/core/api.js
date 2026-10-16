/*
 * HTTP client of the FinBrain server. The server is public for now (no
 * authentication) and allows any origin, so the pages call it straight from
 * disk or from any host. Every call returns a Promise that resolves with the
 * JSON body and rejects with an ApiError on network failure or on a non-2xx
 * answer, carrying the error code that the server sends.
 */
(function (root, factory) {
  var FB = (root.FB = root.FB || {});
  FB.api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = FB.api;
})(typeof self !== "undefined" ? self : globalThis, function (root) {
  "use strict";

  var BASE_URL = "https://finbrain-server.vercel.app/api/v1";
  // The agent does not send CORS headers, so the browser reaches it through
  // the rewrite in vercel.json (/agent/* -> finbrain-agent.vercel.app/*).
  var AGENT_BASE = "/agent";

  function ApiError(status, code, message) {
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.message = message;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  function query(params) {
    var search = new URLSearchParams();
    Object.keys(params).forEach(function (key) {
      if (params[key] !== undefined && params[key] !== null) search.append(key, params[key]);
    });
    return search.toString();
  }

  function request(method, path, body, base) {
    var fetcher = root.fetch;
    if (typeof fetcher !== "function") {
      return Promise.reject(new ApiError(0, "no_fetch", "Este navegador não permite falar com o servidor."));
    }
    var options = { method: method, headers: { Accept: "application/json" } };
    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    return fetcher((base || BASE_URL) + path, options).then(
      function (response) {
        return response.json().catch(function () { return {}; }).then(function (payload) {
          if (!response.ok) {
            throw new ApiError(response.status, payload.code || "http_error", payload.message || "O servidor respondeu com erro.");
          }
          return payload;
        });
      },
      function () {
        throw new ApiError(0, "network", "Não foi possível falar com o servidor.");
      }
    );
  }

  function dashboard(tickers, period) {
    return request("GET", "/dashboard?" + query({ tickers: [].concat(tickers).join(","), period: period }));
  }

  function macroSummary() {
    return request("GET", "/macro/brasil/summary");
  }

  function macroSeries(name, startDate, endDate) {
    return request("GET", "/macro/brasil/series/" + encodeURIComponent(name) + "?" + query({ start_date: startDate, end_date: endDate }));
  }

  function quote(ticker) {
    return request("GET", "/assets/" + encodeURIComponent(ticker) + "/quote");
  }

  function history(ticker, period, interval) {
    return request("GET", "/assets/" + encodeURIComponent(ticker) + "/history?" + query({ period: period, interval: interval }));
  }

  function agentChat(message, sessionId) {
    return request("POST", "/chat", { message: message, session_id: sessionId || null }, AGENT_BASE);
  }

  function garchAsset(body) {
    return request("POST", "/simulations/garch/asset", body);
  }

  return {
    BASE_URL: BASE_URL,
    ApiError: ApiError,
    query: query,
    request: request,
    dashboard: dashboard,
    macroSummary: macroSummary,
    macroSeries: macroSeries,
    quote: quote,
    history: history,
    garchAsset: garchAsset,
    agentChat: agentChat,
  };
});
