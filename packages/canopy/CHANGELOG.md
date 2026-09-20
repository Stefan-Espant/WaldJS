# @waldjs/canopy

## 0.2.0

### Minor Changes

- ece732d: Add `wald:prefetch="hover"` / `wald:prefetch="visible"` for prefetching a linked page's HTML before the user clicks — no compiler support needed, since it's a plain HTML attribute on any element with an `href`. `wald grow` and `wald build` both inline a small runtime automatically, but only into pages that actually use the directive; pages without it stay at 0 KB JS. `@waldjs/canopy` gains a new `@waldjs/canopy/prefetch` export.
