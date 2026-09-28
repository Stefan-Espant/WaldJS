---
'@waldjs/content': minor
'@waldjs/cli': minor
---

Content collections can now hold per-locale subdirectories (`content/blog/nl/`, `content/blog/en/`). `getCollection` and `getEntry` accept `{ locale }`, entries expose `locale`, and the new `getTranslations(collection, slug)` returns an entry's translations keyed by locale. Collections without locale directories are unchanged.
