---
title: "Meertalige content in WaldJS"
description: "Content-collecties kunnen nu een map per taal hebben. Zo werkt het, en waarom deze blog de eerste gebruiker is."
date: 2026-09-28
author: "Stefan van der Kort"
tags: [release, content, i18n]
cover: "/assets/blog/content-locales.jpg"
coverAlt: "Het WaldJS-logo, een witte boom, op een donkergroene achtergrond"
---
Deze blog is de eerste plek op waldjs.eu met een aparte Nederlandse en Engelse pagina per artikel. Daarvoor hadden we iets nodig wat WaldJS nog niet kon: content in meerdere talen.

## Een map per taal

Sinds de nieuwste versie van `@waldjs/content` mag een collectie submappen hebben met een taalcode als naam:

```
content/blog/nl/content-locales.md
content/blog/en/content-locales.md
```

Een bestand met dezelfde naam in twee taalmappen is een vertaling. Collecties zonder taalmappen werken precies zoals altijd.

## Drie functies

- `getCollection('blog', { locale: 'nl' })` geeft alleen de Nederlandse posts.
- `getEntry('blog', slug, { locale: 'nl' })` haalt één post op, en geeft een duidelijke fout als je vergeet welke taal je bedoelt.
- `getTranslations('blog', slug)` geeft alle vertalingen van een post, zodat een pagina naar zijn tegenhanger kan linken.

## Waarom losse pagina's per taal

De rest van de site wisselt van taal in de browser. Voor lange artikelen is een eigen URL per taal beter: zoekmachines zien één taal per pagina, `lang` en `hreflang` kloppen zonder JavaScript, en je downloadt alleen de tekst die je leest.

Lees ook de [documentatie over locales](https://github.com/Stefan-Espant/WaldJS#locales).
