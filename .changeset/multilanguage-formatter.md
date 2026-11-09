---
"@waldjs/compiler": minor
"@waldjs/cli": minor
---

Extend `wald format` to format HTML, CSS, JavaScript and TypeScript files as well as `.wald` components. Format JS/TS frontmatter, executable scripts, JSON data scripts and CSS blocks inside components using Prettier, preserving whitespace-sensitive HTML and multiline string values. Add the asynchronous `formatFile(source, filename, options)` API while preserving the synchronous template-only `format()` API. Keep `--check` non-writing and skip generated output directories.
