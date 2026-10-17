---
"@waldjs/compiler": minor
"@waldjs/cli": patch
---

`wald check` now types dynamic route params as strings: in `src/pages/blog/[slug].wald`, `$$props.slug` is a `string` instead of `unknown`, so the documented `getEntry(collection, $$props.slug)` pattern type-checks without casts. The compiler gains a `routeParams` transform option for this; files with their own `type Props` are unchanged.
