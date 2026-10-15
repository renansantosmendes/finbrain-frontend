# CLAUDE.md

## About this project

V0 of **FinBrain**: a landing page (`index.html`), the login
(`login/index.html`) and the system (`app/index.html`), a single central
screen with five tabs (Início, Dashboards, Brain, Simulações,
Transparência). Flow: landing -> login -> app (`#inicio`, or the tab in
the login hash); app logo -> landing, "Sair" -> login. Static HTML, CSS and JavaScript, no
build step and no framework. Market data comes from the FinBrain server
(`https://finbrain-server.vercel.app/api/v1`); illustrative mock series are
the fallback when it is unreachable. See README.md for the folder structure.

## About the structure

- Each tab lives in `app/screens/<tab>/` with its own JS and CSS. Code
  shared by tabs goes to `app/core/`; the shell (top bar, tab bar, panels)
  is `app/app.css`.
- The signed-in user comes only from `FB.user.current()`
  (`app/core/user.js`). The V0 uses a generic user; when auth_service is
  connected, replace it there, not in the screens.
- Server calls go only through `app/core/api.js`, and `app/core/live-data.js`
  fills `FB.market.ASSETS` and `FB.market.MACRO` in place and emits the
  `data` event, so screens never call `fetch` themselves and redraw on
  `FB.state.on("data")`.
- The landing page (`index.html`) is filled by `assets/js/landing-data.js`
  from the same modules (`api.js`, `live-data.js`, `charts.js`). Its blocks
  have ids and never keep example values: without live data they say so.
- The tab list lives in `FB.tabs.ORDER`; `login/login.js` keeps a copy
  (`TABS`) and a test checks they match.
- Tabs never call each other's rendering. They communicate through
  `FB.state` (`setAsset`, `setSim`, `logCall`) and its events (`asset`,
  `sim`, `trail`, `tab`), and open tabs with `FB.tabs.open(name)`.
- Keep logic pure and testable where possible (`brain-engine.js`,
  `market-data.js`, `simulation-engine.js`, `charts.js`, `api.js`, `live-data.js` use the UMD
  pattern so Node tests can `require` them).
- Scripts are classic `<script>` tags (no ES modules) so the pages also
  open straight from disk. Keep the load order in `app/index.html`.
- All user-facing text is in Brazilian Portuguese; code and comments in
  English. Do not use emojis.

## About colors

- Colors are declared only in the `:root` block of `assets/css/base.css`.
  Everywhere else use `var(--token)`; for transparency use
  `color-mix(in srgb,var(--token) N%,transparent)`. SVG colors come from
  CSS classes, never from inline attributes. `tests/colors.test.js`
  enforces this.

## About responsiveness

- Breakpoints: 1180px (tablet) and 720px (phone, `FB.layout.compact()`),
  plus `@media (pointer:coarse)` for touch targets.
- Charts take `{ compact: FB.layout.compact() }` and screens redraw them
  through `FB.layout.onChange`. Do not reintroduce fixed min-widths that
  force horizontal page scroll.
- Check every change at 360, 390, 768 and 1440px wide.

## About tests and CI

- `npm test` runs `node:test` suites in `tests/`, including jsdom tests
  that load the real pages. Add or update tests with every change.
- CI (`.github/workflows/ci.yml`) runs `npm ci` and `npm test` on Node 20
  and 22 for every pull request and push to `main`.
