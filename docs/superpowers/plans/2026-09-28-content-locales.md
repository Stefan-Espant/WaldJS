# Content Collection Locales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let content collections hold per-locale subdirectories (`content/blog/nl/*.md`, `content/blog/en/*.md`) and expose them through `getCollection(name, { locale })`, `getEntry(collection, slug, { locale })` and `getTranslations(collection, slug)`.

**Architecture:** All locale logic lives in `@waldjs/content` (`readCollection`, `readEntry`, new `readTranslations`). The CLI only forwards arguments through the `wald:content` virtual module (`vite-plugin.ts`) and declares the new signatures in the type shim (`checker.ts`). Unlocalized collections behave exactly as before.

**Tech Stack:** TypeScript, Node `fs/promises`, gray-matter, marked, Vitest, pnpm workspaces.

**Spec:** [2026-09-28-content-locales-design.md](../specs/2026-09-28-content-locales-design.md)

---

## Before you start

- Work on branch `feat/content-locales-and-blog` (already exists, contains the specs):
  ```bash
  cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs
  git switch feat/content-locales-and-blog
  ```
- Node ≥ 22 is required by the repo's package manager.
- Scope builds/tests to the package you changed (`pnpm --filter …`), not a full `pnpm build`.
- The working copy sometimes returns `Operation timed out` / `Need authenticator` on file reads (disk sync). Retry the command; it is not a code problem.
- `.changeset/green-ferns-format.md` is unrelated pre-existing work — never stage it.
- End every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (omitted from the commands below for brevity).
- If subagents implement tasks: check `git status` after each task for files written outside `packages/content`, `packages/cli`, `README.md` and `.changeset/` (see the `containing-subagent-monorepo-changes` skill).

## File map

| File | Responsibility |
|---|---|
| `packages/content/src/index.ts` | Locale discovery, `readCollection`/`readEntry` options, readable errors, `readTranslations` |
| `packages/content/src/index.test.ts` | Unit tests with temp-dir fixtures |
| `packages/cli/src/vite-plugin.ts` | `wald:content` virtual module forwards options, exports `getTranslations` |
| `packages/cli/src/vite-plugin.test.ts` | Asserts the virtual module's exports |
| `packages/cli/src/checker.ts` | `CONTENT_SHIM` declares `locale`, options and `getTranslations` |
| `packages/cli/src/checker.test.ts` | `wald check` accepts the new API |
| `README.md` | Documents locales under "Content collections" |
| `.changeset/content-locales.md` | Minor bump for `@waldjs/content` and `@waldjs/cli` |

---

### Task 1: Locale discovery in `readCollection`

**Files:**
- Modify: `packages/content/src/index.ts`
- Test: `packages/content/src/index.test.ts`

- [ ] **Step 1: Add a fixture helper and failing tests**

In `packages/content/src/index.test.ts`, change the imports at the top to:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { readCollection, readEntry } from './index.js'
```

Below the existing `beforeEach`, add:

```ts
function write(rel: string, content: string) {
  const full = join(contentDir, rel)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}
```

Append at the end of the file:

```ts
describe('readCollection with locales', () => {
  it('returns unlocalized entries first, then each locale directory sorted by name', async () => {
    write('blog/top.md', '---\ntitle: Top\n---\n')
    write('blog/nl/hallo.md', '---\ntitle: Hallo\n---\n')
    write('blog/en/hello.md', '---\ntitle: Hello\n---\n')
    const entries = await readCollection('blog', contentDir)
    expect(entries.map(e => [e.locale, e.slug])).toEqual([
      [undefined, 'top'],
      ['en', 'hello'],
      ['nl', 'hallo'],
    ])
  })

  it('filters by locale', async () => {
    write('blog/nl/hallo.md', '---\ntitle: Hallo\n---\n')
    write('blog/en/hello.md', '---\ntitle: Hello\n---\n')
    const entries = await readCollection('blog', contentDir, { locale: 'nl' })
    expect(entries).toHaveLength(1)
    expect(entries[0].slug).toBe('hallo')
    expect(entries[0].locale).toBe('nl')
    expect(entries[0].data.title).toBe('Hallo')
  })

  it('returns an empty array for a locale without a directory', async () => {
    write('blog/nl/hallo.md', '---\ntitle: Hallo\n---\n')
    expect(await readCollection('blog', contentDir, { locale: 'en' })).toEqual([])
  })

  it('treats region codes as locales and ignores other subdirectories', async () => {
    write('blog/en-GB/colour.md', '---\ntitle: Colour\n---\n')
    write('blog/drafts/secret.md', '---\ntitle: Secret\n---\n')
    const entries = await readCollection('blog', contentDir)
    expect(entries.map(e => [e.locale, e.slug])).toEqual([['en-GB', 'colour']])
  })

  it('does not add a locale key to unlocalized entries', async () => {
    write('blog/post.md', '---\ntitle: Post\n---\n')
    const [entry] = await readCollection('blog', contentDir)
    expect('locale' in entry).toBe(false)
  })

  it('rejects a locale option that is not a locale code', async () => {
    await expect(readCollection('blog', contentDir, { locale: '../secret' })).rejects.toThrow(
      'Invalid locale "../secret"',
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @waldjs/content exec vitest run src/index.test.ts`
Expected: the 6 new tests FAIL (locale entries missing / `locale` undefined / no rejection); the 5 existing tests PASS.

- [ ] **Step 3: Implement locale discovery**

Replace the whole of `packages/content/src/index.ts` with:

```ts
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import matter from 'gray-matter'
import { marked } from 'marked'

export type Entry = {
  slug: string
  locale?: string
  data: Record<string, unknown>
  body: string
}

export type LocaleOptions = {
  locale?: string
}

// A collection subdirectory with a name like `nl`, `en` or `en-GB` holds that
// locale's entries. Anything else stays ignored, as before locales existed.
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/

function assertLocale(locale: string): void {
  if (!LOCALE_PATTERN.test(locale)) {
    throw new Error(`Invalid locale "${locale}" — expected a code like "nl", "en" or "en-GB"`)
  }
}

async function listLocales(collection: string, contentDir: string): Promise<string[]> {
  const dir = join(contentDir, collection)
  if (!existsSync(dir)) return []
  const dirents = await readdir(dir, { withFileTypes: true })
  return dirents
    .filter(d => d.isDirectory() && LOCALE_PATTERN.test(d.name))
    .map(d => d.name)
    .sort()
}

async function listMarkdown(dir: string): Promise<string[]> {
  return (await readdir(dir)).filter(f => f.endsWith('.md')).sort()
}

export async function readCollection(
  name: string,
  contentDir: string,
  options: LocaleOptions = {},
): Promise<Entry[]> {
  const dir = join(contentDir, name)

  if (options.locale !== undefined) {
    const { locale } = options
    assertLocale(locale)
    const localeDir = join(dir, locale)
    if (!existsSync(localeDir)) return []
    const files = await listMarkdown(localeDir)
    return Promise.all(files.map(file => parseEntry(join(localeDir, file), locale)))
  }

  const files = await listMarkdown(dir)
  const entries = await Promise.all(files.map(file => parseEntry(join(dir, file))))
  for (const locale of await listLocales(name, contentDir)) {
    entries.push(...(await readCollection(name, contentDir, { locale })))
  }
  return entries
}

export async function readEntry(collection: string, slug: string, contentDir: string): Promise<Entry> {
  const file = join(contentDir, collection, `${slug}.md`)
  return parseEntry(file)
}

async function parseEntry(filePath: string, locale?: string): Promise<Entry> {
  const raw = await readFile(filePath, 'utf8')
  const { data, content } = matter(raw)
  const body = await marked(content)
  const slug = basename(filePath, '.md')
  const entryData = data as Record<string, unknown>
  return locale === undefined
    ? { slug, data: entryData, body }
    : { slug, locale, data: entryData, body }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @waldjs/content exec vitest run src/index.test.ts`
Expected: all 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/content/src/index.ts packages/content/src/index.test.ts
git commit -m "feat(content): read per-locale subdirectories in collections"
```

---

### Task 2: `readEntry` with locale and readable errors

**Files:**
- Modify: `packages/content/src/index.ts` (the `readEntry` function)
- Test: `packages/content/src/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/content/src/index.test.ts`:

```ts
describe('readEntry with locales', () => {
  it('reads an entry from a locale directory', async () => {
    write('blog/en/hello.md', '---\ntitle: Hello\n---\nBody')
    const entry = await readEntry('blog', 'hello', contentDir, { locale: 'en' })
    expect(entry.slug).toBe('hello')
    expect(entry.locale).toBe('en')
    expect(entry.data.title).toBe('Hello')
  })

  it('still reads a top-level entry without a locale in a localized collection', async () => {
    write('blog/about.md', '---\ntitle: About\n---\n')
    write('blog/nl/hallo.md', '---\ntitle: Hallo\n---\n')
    const entry = await readEntry('blog', 'about', contentDir)
    expect(entry.data.title).toBe('About')
    expect('locale' in entry).toBe(false)
  })

  it('requires a locale when the collection has locales', async () => {
    write('blog/nl/hello.md', '---\ntitle: Hallo\n---\n')
    write('blog/en/hello.md', '---\ntitle: Hello\n---\n')
    await expect(readEntry('blog', 'hello', contentDir)).rejects.toThrow(
      'Collection "blog" has locales (en, nl) — pass { locale } to getEntry("blog", "hello")',
    )
  })

  it('names the collection, slug, locale and available locales when an entry is missing', async () => {
    write('blog/nl/hallo.md', '---\ntitle: Hallo\n---\n')
    write('blog/en/hello.md', '---\ntitle: Hello\n---\n')
    await expect(readEntry('blog', 'nope', contentDir, { locale: 'en' })).rejects.toThrow(
      'Entry "nope" not found in collection "blog" for locale "en" (available locales: en, nl)',
    )
  })

  it('gives a readable error for a missing unlocalized entry', async () => {
    await expect(readEntry('blog', 'nonexistent', contentDir)).rejects.toThrow(
      'Entry "nonexistent" not found in collection "blog"',
    )
  })

  it('rejects a locale option that is not a locale code', async () => {
    await expect(readEntry('blog', 'x', contentDir, { locale: 'EN' })).rejects.toThrow('Invalid locale "EN"')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @waldjs/content exec vitest run src/index.test.ts`
Expected: the new `readEntry with locales` tests FAIL (options ignored, raw `ENOENT` messages); everything else PASS.

- [ ] **Step 3: Implement**

In `packages/content/src/index.ts`, replace the existing `readEntry` function with:

```ts
export async function readEntry(
  collection: string,
  slug: string,
  contentDir: string,
  options: LocaleOptions = {},
): Promise<Entry> {
  const dir = join(contentDir, collection)
  const locales = await listLocales(collection, contentDir)

  if (options.locale !== undefined) {
    const { locale } = options
    assertLocale(locale)
    const file = join(dir, locale, `${slug}.md`)
    if (!existsSync(file)) {
      const available = locales.length > 0 ? locales.join(', ') : 'none'
      throw new Error(
        `Entry "${slug}" not found in collection "${collection}" for locale "${locale}" (available locales: ${available})`,
      )
    }
    return parseEntry(file, locale)
  }

  const file = join(dir, `${slug}.md`)
  if (existsSync(file)) return parseEntry(file)
  if (locales.length > 0) {
    throw new Error(
      `Collection "${collection}" has locales (${locales.join(', ')}) — pass { locale } to getEntry("${collection}", "${slug}")`,
    )
  }
  throw new Error(`Entry "${slug}" not found in collection "${collection}"`)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @waldjs/content exec vitest run src/index.test.ts`
Expected: all tests PASS (including the original `throws when entry does not exist`).

- [ ] **Step 5: Commit**

```bash
git add packages/content/src/index.ts packages/content/src/index.test.ts
git commit -m "feat(content): locale option and readable errors for readEntry"
```

---

### Task 3: `readTranslations`

**Files:**
- Modify: `packages/content/src/index.ts`
- Test: `packages/content/src/index.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/content/src/index.test.ts`, change the import line to:

```ts
import { readCollection, readEntry, readTranslations } from './index.js'
```

Append:

```ts
describe('readTranslations', () => {
  it('returns every locale that has the slug, keyed by locale', async () => {
    write('blog/nl/hello.md', '---\ntitle: Hallo\n---\n')
    write('blog/en/hello.md', '---\ntitle: Hello\n---\n')
    const translations = await readTranslations('blog', 'hello', contentDir)
    expect(Object.keys(translations).sort()).toEqual(['en', 'nl'])
    expect(translations.nl.data.title).toBe('Hallo')
    expect(translations.en.locale).toBe('en')
  })

  it('only includes locales where the slug exists', async () => {
    write('blog/nl/hello.md', '---\ntitle: Hallo\n---\n')
    write('blog/en/other.md', '---\ntitle: Other\n---\n')
    const translations = await readTranslations('blog', 'hello', contentDir)
    expect(Object.keys(translations)).toEqual(['nl'])
  })

  it('returns an empty object when no locale has the slug, ignoring top-level entries', async () => {
    write('blog/hello.md', '---\ntitle: Top\n---\n')
    write('blog/nl/other.md', '---\ntitle: Other\n---\n')
    expect(await readTranslations('blog', 'hello', contentDir)).toEqual({})
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @waldjs/content exec vitest run src/index.test.ts`
Expected: FAIL — `readTranslations` is not exported.

- [ ] **Step 3: Implement**

In `packages/content/src/index.ts`, add after `readEntry`:

```ts
export async function readTranslations(
  collection: string,
  slug: string,
  contentDir: string,
): Promise<Record<string, Entry>> {
  const translations: Record<string, Entry> = {}
  for (const locale of await listLocales(collection, contentDir)) {
    const file = join(contentDir, collection, locale, `${slug}.md`)
    if (existsSync(file)) translations[locale] = await parseEntry(file, locale)
  }
  return translations
}
```

- [ ] **Step 4: Run the tests and build the package**

Run: `pnpm --filter @waldjs/content exec vitest run src/index.test.ts`
Expected: all tests PASS.

Run: `pnpm --filter @waldjs/content build`
Expected: exits 0; `packages/content/dist/index.d.ts` contains `readTranslations` and `locale?: string`.

- [ ] **Step 5: Commit**

```bash
git add packages/content/src/index.ts packages/content/src/index.test.ts
git commit -m "feat(content): add readTranslations"
```

---

### Task 4: Forward options through the `wald:content` virtual module

**Files:**
- Modify: `packages/cli/src/vite-plugin.ts` (the `load` hook of `vite-plugin-wald-content`, around lines 94–103)
- Test: `packages/cli/src/vite-plugin.test.ts` (around line 120)

- [ ] **Step 1: Write the failing test**

In `packages/cli/src/vite-plugin.test.ts`, directly after the test `loads wald:content with getCollection and getEntry exports`, add:

```ts
  it('forwards locale options and exports getTranslations from wald:content', async () => {
    const code = await callHook('vite-plugin-wald-content', 'load', '\0wald:content')
    expect(code).toContain('export const getCollection = (name, options) => _rc(name, contentDir, options)')
    expect(code).toContain('export const getEntry = (collection, slug, options) => _re(collection, slug, contentDir, options)')
    expect(code).toContain('export const getTranslations = (collection, slug) => _rt(collection, slug, contentDir)')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @waldjs/cli exec vitest run src/vite-plugin.test.ts`
Expected: the new test FAILS; the others PASS.

- [ ] **Step 3: Implement**

In `packages/cli/src/vite-plugin.ts`, replace the returned array in the `vite-plugin-wald-content` `load` hook with:

```ts
        return [
          `import { readCollection as _rc, readEntry as _re, readTranslations as _rt } from '@waldjs/content'`,
          `const contentDir = ${contentDir}`,
          `export const getCollection = (name, options) => _rc(name, contentDir, options)`,
          `export const getEntry = (collection, slug, options) => _re(collection, slug, contentDir, options)`,
          `export const getTranslations = (collection, slug) => _rt(collection, slug, contentDir)`,
        ].join('\n')
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @waldjs/cli exec vitest run src/vite-plugin.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/vite-plugin.ts packages/cli/src/vite-plugin.test.ts
git commit -m "feat(cli): expose locale options and getTranslations in wald:content"
```

---

### Task 5: Type shim for `wald check`

**Files:**
- Modify: `packages/cli/src/checker.ts:17-26` (`CONTENT_SHIM`)
- Test: `packages/cli/src/checker.test.ts` (after `accepts wald:content imports via the shim`, around line 89)

- [ ] **Step 1: Write the failing tests**

In `packages/cli/src/checker.test.ts`, after the test `accepts wald:content imports via the shim`, add:

```ts
  it('accepts the locale-aware wald:content API via the shim', () => {
    const root = makeProject({
      'src/pages/en/blog.wald': `---
import { getCollection, getEntry, getTranslations } from 'wald:content'
const posts = await getCollection('blog', { locale: 'en' })
const first = await getEntry('blog', 'hello', { locale: 'en' })
const translations = await getTranslations('blog', 'hello')
const locale: string | undefined = first.locale
---
<p>{posts.length} {Object.keys(translations).length} {locale}</p>`,
    })
    roots.push(root)
    expect(checkProject(root)).toEqual([])
  })

  it('rejects a non-string locale in the wald:content shim', () => {
    const root = makeProject({
      'src/pages/en/blog.wald': `---
import { getCollection } from 'wald:content'
const posts = await getCollection('blog', { locale: 42 })
---
<p>{posts.length}</p>`,
    })
    roots.push(root)
    expect(checkProject(root)).toHaveLength(1)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @waldjs/cli exec vitest run src/checker.test.ts`
Expected: `accepts the locale-aware wald:content API via the shim` FAILS with diagnostics (unknown export `getTranslations`, too many arguments, no `locale` property). The `rejects a non-string locale` test may already pass because of the extra argument — that is fine; it guards the new signature.

- [ ] **Step 3: Implement**

In `packages/cli/src/checker.ts`, replace `CONTENT_SHIM` with:

```ts
const CONTENT_SHIM = `declare module 'wald:content' {
  export type Entry = {
    slug: string
    locale?: string
    data: Record<string, unknown>
    body: string
  }
  export type LocaleOptions = { locale?: string }
  export function getCollection(name: string, options?: LocaleOptions): Promise<Entry[]>
  export function getEntry(collection: string, slug: string, options?: LocaleOptions): Promise<Entry>
  export function getTranslations(collection: string, slug: string): Promise<Record<string, Entry>>
}
`
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @waldjs/cli exec vitest run src/checker.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/checker.ts packages/cli/src/checker.test.ts
git commit -m "feat(cli): type the locale-aware wald:content API in wald check"
```

---

### Task 6: README and changeset

**Files:**
- Modify: `README.md` — end of the "Content collections" section, directly before the heading `## Dynamic routes with \`getStaticPaths()\``
- Create: `.changeset/content-locales.md`

- [ ] **Step 1: Document locales in the README**

Insert directly above the `---` that precedes `## Dynamic routes with \`getStaticPaths()\``:

````markdown
### Locales

A collection can hold one subdirectory per language. Any subdirectory named like a locale code (`nl`, `en`, `en-GB`) is a locale; entries with the same file name in different locale directories are translations of each other:

```
content/
└── blog/
    ├── nl/
    │   └── hello.md
    └── en/
        └── hello.md
```

```wald
---
import { getCollection, getEntry, getTranslations } from 'wald:content'
const posts = await getCollection('blog', { locale: 'en' })   // only content/blog/en/
const post = await getEntry('blog', 'hello', { locale: 'en' })
const translations = await getTranslations('blog', 'hello')    // { nl: Entry, en: Entry }
---
```

Each entry carries its `locale`. `getCollection('blog')` without options returns every entry in every locale. `getEntry` on a collection with locales needs `{ locale }` and throws a clear error without it. Collections without locale directories work exactly as before. Locale-prefixed routes are not generated for you (yet) — create them as pages, e.g. `src/pages/en/blog/[slug].wald`.
````

- [ ] **Step 2: Add the changeset**

Create `.changeset/content-locales.md`:

```markdown
---
'@waldjs/content': minor
'@waldjs/cli': minor
---

Content collections can now hold per-locale subdirectories (`content/blog/nl/`, `content/blog/en/`). `getCollection` and `getEntry` accept `{ locale }`, entries expose `locale`, and the new `getTranslations(collection, slug)` returns an entry's translations keyed by locale. Collections without locale directories are unchanged.
```

- [ ] **Step 3: Commit**

```bash
git add README.md .changeset/content-locales.md
git commit -m "docs: document content collection locales and add changeset"
```

---

### Task 7: End-to-end verification

Unit tests check strings and fixtures; this task proves a real `wald build` uses the new API through the virtual module and the vendored `@waldjs/content` copy.

- [ ] **Step 1: Build the changed packages and run their full test suites**

```bash
pnpm --filter @waldjs/content build && pnpm --filter @waldjs/content test
pnpm --filter @waldjs/cli build && pnpm --filter @waldjs/cli test
```
Expected: both builds exit 0; all tests PASS.

- [ ] **Step 2: Build a throwaway project that uses locales**

Use a temp dir in the scratchpad (not inside the repo):

```bash
T=$(mktemp -d)
mkdir -p $T/src/pages/en/blog $T/content/blog/nl $T/content/blog/en
printf -- '---\ntitle: Hallo\n---\nNL body\n' > $T/content/blog/nl/hello.md
printf -- '---\ntitle: Hello\n---\nEN body\n' > $T/content/blog/en/hello.md
cat > "$T/src/pages/en/blog/[slug].wald" <<'EOF'
---
import { getCollection, getEntry, getTranslations } from 'wald:content'
export async function getStaticPaths() {
  const posts = await getCollection('blog', { locale: 'en' })
  return posts.map(p => ({ params: { slug: p.slug } }))
}
const post = await getEntry('blog', $$props.slug, { locale: 'en' })
const translations = await getTranslations('blog', $$props.slug)
---
<h1>{post.data.title}</h1><p>locale={post.locale} translations={Object.keys(translations).sort().join(',')}</p>
EOF
cd $T && node /Users/stefan/Desktop/semantique-agency/repositories/waldjs/packages/cli/bin/wald.js build
cat $T/dist/en/blog/hello/index.html | grep -o '<h1>.*</p>'
node /Users/stefan/Desktop/semantique-agency/repositories/waldjs/packages/cli/bin/wald.js check
```
Expected: build succeeds; output contains `<h1>Hello</h1><p>locale=en translations=en,nl</p>`; `wald check` reports no errors. If the build complains about a missing `package.json`, add `{"name":"t","private":true,"type":"module"}` to `$T/package.json` and retry.

- [ ] **Step 3: Confirm the marketing site is unaffected**

```bash
cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs
pnpm --filter @waldjs/marketing test
```
Expected: PASS (the changelog collection has no locale directories and must render exactly as before).

- [ ] **Step 4: Check nothing leaked outside the intended files**

```bash
git status --short
```
Expected: clean apart from the pre-existing untracked `.changeset/green-ferns-format.md`.
