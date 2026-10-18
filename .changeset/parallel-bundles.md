---
"@waldjs/cli": patch
---

`wald build` bundles the canopy (browser) client and the SSR pages at the same time instead of one after the other, and no longer computes gzip sizes it only printed.
