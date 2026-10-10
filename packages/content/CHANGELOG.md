# @waldjs/content

## 0.2.1

### Patch Changes

- efcee5d: Improve npm package metadata: clearer descriptions, keywords, and `homepage` / `bugs` links, so the packages are easier to find on npm.

## 0.2.0

### Minor Changes

- 605374c: Content collections can now hold per-locale subdirectories (`content/blog/nl/`, `content/blog/en/`). `getCollection` and `getEntry` accept `{ locale }`, entries expose `locale`, and the new `getTranslations(collection, slug)` returns an entry's translations keyed by locale. Collections without locale directories are unchanged.
