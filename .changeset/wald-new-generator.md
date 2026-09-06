---
"@waldjs/cli": minor
---

Add `wald new component <Name>` and `wald new page <route>` to scaffold a `.wald` file in `src/components/` or `src/pages/` without hand-copying an existing one. `wald new page` recognizes dynamic segments (`wald new page blog/[slug]`) and scaffolds a typed `Props` plus a `getStaticPaths()` stub. Both refuse to overwrite an existing file.
