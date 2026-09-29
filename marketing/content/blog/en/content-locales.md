---
title: "Multilingual content in WaldJS"
description: "Content collections can now hold one directory per language. Here's how it works, and why this blog is its first user."
date: 2026-09-28
author: "Stefan van der Kort"
tags: [release, content, i18n]
cover: "/assets/blog/content-locales.jpg"
coverAlt: "The WaldJS logo, a white tree, on a dark green background"
---
This blog is the first place on waldjs.eu with a separate Dutch and English page per article. That needed something WaldJS couldn't do yet: content in more than one language.

## One directory per language

Since the latest `@waldjs/content`, a collection can have subdirectories named after a locale code:

```
content/blog/nl/content-locales.md
content/blog/en/content-locales.md
```

A file with the same name in two locale directories is a translation. Collections without locale directories work exactly as before.

## Three functions

- `getCollection('blog', { locale: 'en' })` returns only the English posts.
- `getEntry('blog', slug, { locale: 'en' })` fetches one post, with a clear error if you forget which language you meant.
- `getTranslations('blog', slug)` returns every translation of a post, so a page can link to its counterpart.

## Why separate pages per language

The rest of the site switches language in the browser. For long articles a URL per language is better: search engines see one language per page, `lang` and `hreflang` are right without JavaScript, and you only download the text you read.

See also the [locales documentation](https://github.com/Stefan-Espant/WaldJS#locales).
