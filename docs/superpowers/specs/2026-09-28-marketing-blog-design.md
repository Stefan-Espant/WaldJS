# Marketing Blog — Design

## Motivation

Sub-project 2 of 2: a bilingual blog on waldjs.eu. Depends on sub-project 1,
[content collection locales](2026-09-28-content-locales-design.md), which
must be merged (or at least built in the workspace) first.

The rest of the site is bilingual through client-side toggling: every page
contains both `<span class="nl">` and `<span class="en">` text, `site.js`
sets `data-lang` on `<html>` and CSS hides the other language. For long-form
blog posts that doubles every page's text, gives crawlers mixed-language
content and leaves `lang` wrong until JS runs. The blog therefore uses
**separate NL and EN pages** — one language per page, correct `lang` and
`hreflang` in the static HTML — decided during brainstorming as best for
SEO/accessibility at no performance cost.

Features in v1: overview, post pages, author, tags with per-tag pages, cover
image, RSS feed per language.

## Content

```
marketing/content/blog/nl/<slug>.md
marketing/content/blog/en/<slug>.md          ← same file name = translation
marketing/src/assets/blog/<slug>.jpg         ← cover, ideally 1200×630
marketing/src/assets/blog/authors/<name>.jpg ← optional avatar
```

Frontmatter:

```yaml
title: "What is WaldJS?"
description: "Short summary; used for meta description, og:description and RSS"
date: 2026-10-01
author: "Stefan"
authorAvatar: "/assets/blog/authors/stefan.jpg"   # optional
tags: [release, performance]                      # optional, kebab-case
cover: "/assets/blog/what-is-waldjs.jpg"          # optional
coverAlt: "…"                                     # required when cover is set
```

The displayed date is derived from `date` with
`Intl.DateTimeFormat(locale, { dateStyle: 'long' })` — no separate
`dateLabel` field. A post with `cover` but no `coverAlt` fails the build with
a message naming the file.

## Routes

| NL | EN |
|---|---|
| `src/pages/blog/index.wald` → `/blog` | `src/pages/en/blog/index.wald` → `/en/blog` |
| `src/pages/blog/[slug].wald` → `/blog/<slug>` | `src/pages/en/blog/[slug].wald` → `/en/blog/<slug>` |
| `src/pages/blog/tag/[tag].wald` → `/blog/tag/<tag>` | `src/pages/en/blog/tag/[tag].wald` → `/en/blog/tag/<tag>` |

Each page is a thin wrapper: it fetches with
`getCollection('blog', { locale })` / `getEntry(…, { locale })` /
`getTranslations(…)` and hands data to shared components. Tag pages exist
only for tags used in that locale.

## Components and helpers

- `src/components/BlogList.wald` — list of post cards (cover thumbnail,
  title, meta, description); optional heading for tag pages.
- `src/components/BlogPost.wald` — cover, title, meta, body, tag links,
  back link.
- `src/components/BlogMeta.wald` — author (+ avatar), formatted date, tags.
- `src/lib/blog.js` — pure helpers: `sortByDate(entries)`,
  `collectTags(entries)`, `formatDate(date, locale)`,
  `blogPath(locale, slug?)`, `tagPath(locale, tag)`, and a small UI string
  table (`t(locale, key)`) for the handful of fixed labels ("Back to all
  posts", "Tagged", …).

Covers render with `Image` from `wald:image` (WebP + `srcset`).

## Layout, language and navigation

`Layout.wald` gets optional props:

- `lang` — when set, `<html lang={lang} data-lang={lang}>` is rendered
  directly and the inline localStorage language script is omitted, so the
  page's language is fixed and correct without JS. Without `lang`, behaviour
  is unchanged for all existing pages.
- `alternates` — `{ nl?: path, en?: path }`; renders
  `<link rel="alternate" hreflang="…">` (plus `x-default` → NL).
- `ogImage` — overrides the default og/twitter image (blog posts pass the
  original cover JPG as an absolute URL; crawlers don't reliably read WebP).
- `ogType` / `jsonLd` — posts use `og:type=article` and a `BlogPosting`
  JSON-LD block instead of the `SoftwareApplication` one.
- `rss` — path of the locale's feed, rendered as
  `<link rel="alternate" type="application/rss+xml">`.

On pages with a fixed `lang`, the NL/EN switch buttons become plain links:
to the translation when it exists, otherwise to the other language's blog
index. `Nav.wald` gains a "Blog" link (desktop + mobile menu) that points to
`/en/blog` in EN context and `/blog` otherwise, with `aria-current` like the
existing Changelog link.

## RSS

`scripts/build-rss.mjs <root> <baseUrl>` imports `readCollection` from
`@waldjs/content` directly (dogfooding the locale API), sorts by date and
writes `dist/blog/rss.xml` and `dist/en/blog/rss.xml` (RSS 2.0: title, link,
description, pubDate, guid, per-item category per tag). It runs after
`wald build` in both `package.json`'s `build` script and `vercel-build.mjs`
(the Vercel path is easy to forget — commit `1881208` fixed exactly that for
the sitemap). This script is written so it can later move into the #75
integration unchanged.

The sitemap needs no change: `build-sitemap.mjs` scans `dist/`, so blog and
tag pages are picked up automatically.

## Styling

New partial `src/styles/partials/15-blog.css`, reusing existing card,
section and tag styles; then regenerate the bundle with `build:css` per the
marketing CSS pipeline (sources in `partials/`, bundle is gitignored). Honour
the existing reduced-motion / high-contrast rules.

## First content

One real post, NL + EN, with a cover, so every route type builds with real
data. Topic chosen by Stefan at implementation time; placeholder text is not
acceptable in the merged result.

## Testing

- `src/lib/blog.test.js` — sorting, tag collection, date formatting per
  locale, path helpers.
- `scripts/build-rss.test.ts` — feed per locale, escaping, ordering, valid
  XML shape (same style as `build-sitemap.test.ts`).
- `src/smoke.test.ts` additions, after a real build:
  - `/blog`, `/en/blog`, one post and one tag page exist for both locales;
  - EN pages have `<html lang="en"` and no localStorage language script;
  - `hreflang` alternates present and pointing at each other;
  - heading order valid on all blog page types (existing
    `checkHeadingOrder`);
  - both RSS files exist and parse as RSS 2.0.
- Manual check with `wald preview`: language links, Nav "Blog" link on both
  menus, cover renders, feeds reachable.

## Out of scope

- Pagination (revisit once the post count warrants it).
- Search, comments, reading time, related posts.
- Migrating the changelog to locale directories.
