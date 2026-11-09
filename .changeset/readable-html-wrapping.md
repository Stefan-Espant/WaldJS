---
"@waldjs/compiler": patch
"@waldjs/cli": patch
---

Wrap long Wald HTML tags and inline groups instead of collapsing them onto oversized lines. Use one attribute per line when a tag exceeds the preferred width, preserve quoted/expression values and inline adjacency, and support a `printWidth` option (default 80).
