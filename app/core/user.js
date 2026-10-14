/*
 * Signed-in user shown by the app (greeting on Início and the user chip in
 * the top bar).
 *
 * The V0 has no real authentication, so everyone is the same generic
 * user. When the login is connected to auth_service, replace GENERIC_USER
 * with the profile returned by GET /api/v1/me; the screens only read
 * FB.user.current() and need no change.
 */
(function (root, factory) {
  var FB = (root.FB = root.FB || {});
  FB.user = factory();
  if (typeof module === "object" && module.exports) module.exports = FB.user;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  var GENERIC_USER = { name: "Investidor", generic: true };

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    var first = parts[0].charAt(0), last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  }

  function firstName(name) {
    return String(name || "").trim().split(/\s+/)[0] || GENERIC_USER.name;
  }

  function greeting(date) {
    var hour = (date || new Date()).getHours();
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
  }

  function current() {
    var user = GENERIC_USER;
    return { name: user.name, firstName: firstName(user.name), initials: initials(user.name), generic: user.generic };
  }

  return { current: current, initials: initials, firstName: firstName, greeting: greeting };
});
