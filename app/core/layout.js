/*
 * Viewport helpers. `compact()` tells whether the screen is phone-sized
 * (up to 720px wide); `onChange` runs a callback when the device crosses
 * that breakpoint (rotation, window resize), so charts can be redrawn with
 * the geometry that fits.
 */
(function (root) {
  "use strict";
  var FB = (root.FB = root.FB || {});
  var QUERY = "(max-width: 720px)";
  var media = root.matchMedia ? root.matchMedia(QUERY) : null;

  function compact() {
    return Boolean(media && media.matches);
  }

  function onChange(callback) {
    if (!media) return;
    if (media.addEventListener) media.addEventListener("change", callback);
    else if (media.addListener) media.addListener(callback);
  }

  FB.layout = { QUERY: QUERY, compact: compact, onChange: onChange };
})(typeof self !== "undefined" ? self : globalThis);
