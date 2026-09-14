---
"@waldjs/cli": patch
---

Fix `wald grow` to serve `src/assets/*` files (a project's own global stylesheet, images, etc.) at their `config.base`-prefixed URL — previously, a non-default `base` made a freshly-scaffolded project's global stylesheet link 404 in dev, loading the site completely unstyled.
