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

  function parseSse(buffer) {
    var blocks = buffer.split("\n\n");
    var rest = blocks.pop();
    var events = [];
    blocks.forEach(function (block) {
      var name = "message", lines = [];
      block.split("\n").forEach(function (line) {
        if (line.indexOf("event:") === 0) name = line.slice(6).trim();
        else if (line.indexOf("data:") === 0) lines.push(line.slice(5).replace(/^ /, ""));
      });
      if (lines.length) events.push({ event: name, data: JSON.parse(lines.join("\n")) });
    });
    return { events: events, rest: rest };
  }

  function agentStream(message, sessionId, onEvent, signal) {
    var fetcher = root.fetch;
    if (typeof fetcher !== "function") {
      return Promise.reject(new ApiError(0, "no_fetch", "Este navegador não permite falar com o agente."));
    }
    var options = {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ message: message, session_id: sessionId || null }),
    };
    if (signal) options.signal = signal;
    return fetcher(AGENT_BASE + "/chat/stream", options).then(function (response) {
      if (!response.ok) throw new ApiError(response.status, "http_error", "O agente respondeu com erro.");
      if (!response.body || typeof response.body.getReader !== "function") {
        throw new ApiError(0, "no_stream", "Este navegador não lê respostas em partes.");
      }
      var reader = response.body.getReader();
      var decoder = new root.TextDecoder();
      var buffer = "", finalAnswer = null, failure = null;

      function pump() {
        return reader.read().then(function (chunk) {
          if (chunk.done) return;
          buffer += decoder.decode(chunk.value, { stream: true });
          var parsed = parseSse(buffer);
          buffer = parsed.rest;
          parsed.events.forEach(function (item) {
            if (item.event === "done") finalAnswer = item.data;
            if (item.event === "error") failure = item.data;
            onEvent(item.event, item.data);
          });
          return pump();
        });
      }

      return pump().then(function () {
        if (finalAnswer) return finalAnswer;
        var reason = failure || {};
        throw new ApiError(0, reason.code || "stream_incomplete", reason.message || "A resposta do agente foi interrompida.");
      });
    }, function () {
      throw new ApiError(0, "network", "Não foi possível falar com o agente.");
    });
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
    agentStream: agentStream,
    parseSse: parseSse,
  };
});
