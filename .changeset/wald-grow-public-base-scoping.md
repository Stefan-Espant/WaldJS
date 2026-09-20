---
"@waldjs/cli": patch
---

Fix `wald grow` to serve `public/` directory files (e.g. `robots.txt`, `favicon.ico`) only at their `config.base`-prefixed URL — previously, a non-default `base` still made these files reachable unprefixed as well, because Vite's own dev-server middleware serves `publicDir` files regardless of `base`.
