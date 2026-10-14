/*
 * Viewport helpers. `compact()` tells whether the screen is phone-sized
 * (up to 720px wide); `onChange` runs a callback when the device crosses
 * that breakpoint (rotation, window resize), so charts can be redrawn with
 * the geometry that fits. `fitsScreen()` tells whether the screen is a
 * desktop monitor big enough for the Dashboards tab to fill exactly one
 * screen height, with the chart taking the remaining space.
 */
(function (root) {
  "use strict";
  var FB = (root.FB = root.FB || {});
  var QUERY = "(max-width: 720px)";
  var FIT_QUERY = "(min-width: 1181px) and (min-height: 620px)";
  var media = root.matchMedia ? root.matchMedia(QUERY) : null;
  var fitMedia = root.matchMedia ? root.matchMedia(FIT_QUERY) : null;

  function compact() {
    return Boolean(media && media.matches);
  }

  function fitsScreen() {
    return Boolean(fitMedia && fitMedia.matches);
  }

  function listen(list, callback) {
    if (!list) return;
    if (list.addEventListener) list.addEventListener("change", callback);
    else if (list.addListener) list.addListener(callback);
  }

  function onChange(callback) {
    listen(media, callback);
  }

  function onFitChange(callback) {
    if (fitMedia !== media) listen(fitMedia, callback);
  }

  FB.layout = { QUERY: QUERY, FIT_QUERY: FIT_QUERY, compact: compact, fitsScreen: fitsScreen, onChange: onChange, onFitChange: onFitChange };
})(typeof self !== "undefined" ? self : globalThis);
