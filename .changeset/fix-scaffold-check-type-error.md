---
"@waldjs/cli": patch
---

Fix `wald check` failing on every freshly scaffolded project with `Argument of type 'unknown' is not assignable to parameter of type 'string'` on `blog/[slug].wald`. The generated file used `$$props.slug` without declaring `type Props`, so the compiler fell back to `createTree`'s default `Record<string, unknown>` prop type instead of a typed one. Now declares `type Props = { slug: string }`, matching the pattern used everywhere else typed props are needed.
