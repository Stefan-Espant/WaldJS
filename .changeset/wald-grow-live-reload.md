---
"@waldjs/cli": minor
---

`wald grow` now live-reloads the browser automatically when a `.wald` page/component or `content/` entry changes, instead of requiring a manual refresh. The dev server's HTTP server is now wired into Vite's HMR websocket, and pages are run through `transformIndexHtml` to inject the Vite client. Since every page is server-rendered fresh per request, reloads are full-page rather than partial/state-preserving hot updates — see [#20](https://github.com/Stefan-Espant/WaldJS/issues/20) for state-preserving component HMR as follow-up work.
