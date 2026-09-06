---
"@waldjs/cli": minor
---

`wald grow` now shows compile and render errors as a readable HTML page (message, file/line, code frame, stack) instead of a bare plain-text 500. The page goes through `transformIndexHtml()` like a normal page response, so the Vite HMR client is still connected and the browser can pick up a live-reload once the underlying file is fixed.
