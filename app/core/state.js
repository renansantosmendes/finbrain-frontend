/*
 * Shared state of the app and a tiny event bus between the tabs.
 *
 * Events: "asset" (symbol, range, averages or table view changed), "sim"
 * (simulation parameters changed), "trail" (a tool call was recorded) and
 * "tab" (another tab was opened). Screens listen to what they display and
 * change state only through the functions below.
 */
(function (root, factory) {
  var FB = (root.FB = root.FB || {});
  FB.state = factory(FB.format, FB.simulation);
  if (typeof module === "object" && module.exports) module.exports = FB.state;
})(typeof self !== "undefined" ? self : globalThis, function (format, simulation) {
  "use strict";

  var root = typeof self !== "undefined" ? self : globalThis;
  var listeners = {};
  var data = {
    sym: "PETR4",
    rng: "3M",
    ma5: true,
    ma20: true,
    showTable: false,
    sim: Object.assign({}, simulation.DEFAULTS),
    trail: [],
  };

  function on(event, handler) {
    (listeners[event] = listeners[event] || []).push(handler);
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach(function (handler) { handler(payload); });
  }

  function setAsset(changes) {
    var changed = false;
    Object.keys(changes).forEach(function (key) {
      if (data[key] !== changes[key]) {
        data[key] = changes[key];
        changed = true;
      }
    });
    if (changed) emit("asset", data);
  }

  function setSim(changes) {
    Object.keys(changes).forEach(function (key) {
      data.sim[key] = simulation.clamp(key, changes[key]);
    });
    emit("sim", data.sim);
  }

  function digest(text) {
    try {
      if (root.crypto && root.crypto.subtle && root.TextEncoder) {
        return root.crypto.subtle.digest("SHA-256", new root.TextEncoder().encode(text)).then(function (buffer) {
          return Array.prototype.map.call(new Uint8Array(buffer), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
        });
      }
    } catch (error) {
      /* fall through to the non-cryptographic fingerprint below */
    }
    var h = 2166136261, out = "";
    for (var k = 0; k < 4; k++) {
      for (var i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i) + k;
        h = Math.imul(h, 16777619) >>> 0;
      }
      out += ("00000000" + h.toString(16)).slice(-8);
    }
    return Promise.resolve(out);
  }


  function logCall(tool, source, params, now) {
    var d = now || new Date();
    var entry = {
      tool: tool,
      src: source,
      params: params,
      at: format.pad2(d.getDate()) + "/" + format.pad2(d.getMonth() + 1) + " " + format.pad2(d.getHours()) + ":" + format.pad2(d.getMinutes()) + ":" + format.pad2(d.getSeconds()),
      hash: "…",
    };
    data.trail.push(entry);
    emit("trail", data.trail);
    return digest(tool + source + params + entry.at).then(function (h) {
      entry.hash = h.slice(0, 4) + "…" + h.slice(-4);
      emit("trail", data.trail);
      return entry;
    });
  }

  return { data: data, on: on, emit: emit, setAsset: setAsset, setSim: setSim, logCall: logCall };
});
