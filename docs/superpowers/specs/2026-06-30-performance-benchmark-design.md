# Performance Benchmark Suite — Design

**Date:** 2026-06-30
**Scope:** Vergelijkende benchmark suite voor WaldJS vs Astro vs Eleventy — build-tijd en Lighthouse-scores op identieke content.

---

## Context

WaldJS claimt sneller en eenvoudiger te zijn dan bestaande frameworks. Om dit objectief te meten en te communiceren, is een reproduceerbare benchmark suite nodig die:
1. Build-tijd meet op een realistische testsite
2. Lighthouse-scores meet op de gebouwde output
3. Dezelfde content gebruikt voor alle drie frameworks

---

## Vastgestelde keuzes

| Keuze | Beslissing |
|---|---|
| Locatie | `benchmarks/` in de WaldJS-monorepo |
| Frameworks | WaldJS, Astro, Eleventy |
| Gedeelde content | 50 Markdown blogposts in `benchmarks/content/blog/` |
| Build-meting | 3 runs per framework, mediaan build-tijd |
| Lighthouse-meting | 5 pagina's per framework, gemiddelde over 4 categorieën |
| Output | `results/latest.json` + terminal-tabel |
| CI | Niet in scope — lokaal draaien via `pnpm bench` |
| Unit tests voor orchestrator | Niet in scope — glue code |

---

## Structuur

```
benchmarks/
  content/
    blog/
      post-001.md … post-050.md
  wald/               ← WaldJS-variant
    src/
      pages/
        index.wald
        blog/
          index.wald
          [slug].wald
      components/
        Counter.wald  ← canopy island
    wald.config.ts
    package.json
  astro/              ← Astro-variant
    src/
      pages/
        index.astro
        blog/
          index.astro
          [slug].astro
      components/
        Counter.astro ← Astro island
    astro.config.mjs
    package.json
  eleventy/           ← Eleventy-variant
    src/
      index.njk
      blog/
        index.njk
        post.njk
      _includes/
        counter.js    ← vanilla JS
    .eleventy.js
    package.json
  scripts/
    bench.ts          ← orchestrator
    report.ts         ← terminal-tabel formatter
  results/            ← .gitignored
    latest.json
  package.json        ← pnpm bench entry point
```

---

## Gedeelde content (`content/blog/`)

50 Markdown-bestanden met YAML frontmatter:

```md
---
title: Post 001
date: 2026-01-01
author: Benchmark
---

Lorem ipsum... (300 woorden gegenereerde tekst)
```

Alle drie frameworks lezen deze bestanden. De WaldJS- en Astro-varianten gebruiken hun respectievelijke content collection API's; Eleventy gebruikt een `_data` directory die de bestanden inleest.

---

## Testsite per variant

Elke variant bevat dezelfde vijf soorten pagina's:

| Pagina | Route |
|---|---|
| Homepage | `/` |
| Bloglijst | `/blog` |
| Blogdetail (50x) | `/blog/post-001` … `/blog/post-050` |

Plus één interactief component: een klikbare teller die het aantal kliks bijhoudt. In WaldJS via `canopy:load`, in Astro via `client:load`, in Eleventy via een inline `<script>`.

---

## Orchestrator (`scripts/bench.ts`)

```typescript
// Pseudocode — exacte implementatie in plan
for (const fw of ['wald', 'astro', 'eleventy']) {
  const times: number[] = []
  for (let i = 0; i < 3; i++) {
    rimraf(`${fw}/dist`)
    const start = performance.now()
    execSync('pnpm build', { cwd: fw })
    times.push(performance.now() - start)
  }
  results[fw].buildMs = median(times)

  const server = startServer(`${fw}/dist`, port)
  results[fw].lighthouse = await runLighthouse(port, PAGES)
  server.close()
}

writeFileSync('results/latest.json', JSON.stringify(results, null, 2))
```

**`PAGES`**: `['/','  /blog', '/blog/post-001', '/blog/post-025', '/blog/post-050']`

**Lighthouse-categorieën**: Performance, Accessibility, Best Practices, SEO (score 0–100).

Als een framework-build faalt: overslaan, `BUILD_FAILED` rapporteren, doorgaan.
Als een Lighthouse-pagina niet bereikbaar is: die pagina overslaan, gemiddelde over beschikbare pagina's.

---

## Output

### `results/latest.json`

```json
{
  "timestamp": "2026-06-30T12:00:00Z",
  "results": {
    "wald": {
      "buildMs": 1200,
      "lighthouse": { "performance": 98, "accessibility": 100, "bestPractices": 100, "seo": 100 }
    },
    "astro": { ... },
    "eleventy": { ... }
  }
}
```

### Terminal-tabel (via `report.ts`)

```
Framework   Build (med.)   Perf   A11y   Best   SEO
────────────────────────────────────────────────────
WaldJS      1.2s           98     100    100    100
Astro       4.1s           96     98     95     100
Eleventy    2.8s           94     97     92     100
```

---

## `pnpm bench`

In `benchmarks/package.json`:

```json
{
  "scripts": {
    "bench": "tsx scripts/bench.ts"
  }
}
```

In de root `turbo.json`: `bench` task toegevoegd zodat `pnpm bench` vanuit de root werkt.

---

## `.gitignore`

`benchmarks/results/` wordt toegevoegd aan de root `.gitignore`.

---

## Error handling

| Situatie | Gedrag |
|---|---|
| Framework-build crasht | Log error, markeer `BUILD_FAILED`, ga door |
| Lighthouse-pagina niet bereikbaar | Sla pagina over, gemiddelde over rest |
| Geen enkel Lighthouse-resultaat | Markeer `LIGHTHOUSE_FAILED` |
| `results/` bestaat niet | Automatisch aanmaken door orchestrator |

---

## Buiten scope

- CI-integratie (GitHub Actions scheduled run)
- Historische trend-tracking (baseline vergelijking over tijd)
- Meerdere benchmark-runs aggregeren over dagen
- Bundle-size meting (aparte metric, ander tooling)
- Mobile vs desktop Lighthouse-profielen (alleen desktop in scope)
- Automatisch publiceren van resultaten
