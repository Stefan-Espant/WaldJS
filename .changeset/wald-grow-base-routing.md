---
"@waldjs/cli": patch
---

Fix `wald grow` to respect `config.base` when routing incoming requests — previously, a non-default `base` (e.g. `/my-forest/`) made every page 404 in dev, since the dev server's routing never accounted for the prefix Vite itself was already correctly adding everywhere else.
