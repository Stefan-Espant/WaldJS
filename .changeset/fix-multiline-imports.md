---
"@waldjs/compiler": patch
---

Fix multi-line imports in `.wald` frontmatter: an import spanning several lines (e.g. `import {\n  a,\n} from './x'`, or with `from` on its own line) is now hoisted as a whole statement instead of compiling to invalid JS.
