---
"@waldjs/content": minor
"@waldjs/cli": minor
---

Support drafts and scheduled publishing for Markdown collections. Development previews include all entries; production builds exclude `draft: true` and future `publishDate` entries from collections, individual lookups, translations and generated routes. Low-level readers support `production: true` for RSS and other build scripts. Publication dates are evaluated at build time without caching visibility decisions.

Remove stale generated route pages on rebuild so previously published content does not remain accessible after becoming a draft or being scheduled for later.
