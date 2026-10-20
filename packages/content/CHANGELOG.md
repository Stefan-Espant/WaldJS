# @waldjs/content

## 0.3.0

### Minor Changes

- fb9cbe0: Faster content collections: parsed entries and directory listings are cached and reused until the file or folder changes (checked via modification time and size), so `getStaticPaths()` plus one `getEntry()` per page no longer re-reads and re-parses every file. On a 1,000-post site this cuts page rendering in `wald build` from ~1.2 s to ~0.16 s. `wald grow` still picks up every edit. Each call now also returns its own copy of an entry, so one page mutating `entry.data` can no longer affect another.

## 0.2.1

### Patch Changes

- efcee5d: Improve npm package metadata: clearer descriptions, keywords, and `homepage` / `bugs` links, so the packages are easier to find on npm.

## 0.2.0

### Minor Changes

- 605374c: Content collections can now hold per-locale subdirectories (`content/blog/nl/`, `content/blog/en/`). `getCollection` and `getEntry` accept `{ locale }`, entries expose `locale`, and the new `getTranslations(collection, slug)` returns an entry's translations keyed by locale. Collections without locale directories are unchanged.
