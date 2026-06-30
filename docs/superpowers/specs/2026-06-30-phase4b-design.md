# Phase 4b — Forest: Config, Vite Build Pipeline

**Date:** 2026-06-30
**Scope:** `wald.config.ts` ondersteuning, `wald grow` import-fix, `wald build` vervangen door two-pass Vite SSR pipeline met CSS/asset bundeling.

---

## Context

Phase 4a leverde een geïsoleerde, geteste Vite plugin in `@waldjs/cli`. Phase 4b sluit die plugin aan op de bestaande CLI-commands en voegt een config-laag toe.

Twee problemen in de huidige code die 4b oplost:

1. `grow.ts` importeert `waldPlugin` uit `@waldjs/compiler` — dat export bestaat niet meer na Phase 4a. Actieve bug.
2. `build.ts` gebruikt een eigen `data:text/javascript,` compile-pipeline — geen CSS-ondersteuning, geen asset-hashing, moeilijk schaalbaar.

---

## Vastgestelde keuzes

| Keuze | Beslissing |
|---|---|
| Config-patroon | Eigen `defineConfig()` (Astro/SvelteKit-stijl) met `vite: {}` escape hatch |
| Config laden | Via Vite's `loadConfigFromFile()` — handelt TypeScript automatisch af |
| Config-opties | `outDir`, `base`, `vite` |
| Dev server (grow) | Bestaande Vite-server, alleen import-fix + config doorgeven |
| Build pipeline | Two-pass Vite SSR: eerst bundle, dan pre-render per route |
| SSR temp-map | `.wald-ssr/` — altijd opruimen in `finally`-blok |
| Port configuratie | Via `config.vite.server.port`, geen eigen top-level optie |
| CSS/assets | Vite handelt dit automatisch af in Pass 1 |

---

## Config (`wald.config.ts`)

### Developer-facing syntax

```ts
// wald.config.ts
import { defineConfig } from '@waldjs/cli'

export default defineConfig({
  outDir: 'dist',
  base: '/',
  vite: {
    plugins: [...],
  },
})
```

### Standaardwaarden

```ts
{
  outDir: 'dist',
  base: '/',
  vite: {},
}
```

Geen `wald.config.ts` aanwezig → stille fallback naar standaardwaarden, geen fout.

### Implementatie

Nieuw bestand `packages/cli/src/config.ts`:

```ts
export interface WaldConfig {
  outDir?: string
  base?: string
  vite?: UserConfig
}

export function defineConfig(config: WaldConfig): WaldConfig {
  return config  // identity — alleen voor TS-autocomplete
}

export async function loadWaldConfig(root = process.cwd()): Promise<Required<WaldConfig>> {
  const defaults = { outDir: 'dist', base: '/', vite: {} }
  const result = await loadConfigFromFile({ command: 'build', mode: 'production' }, 'wald.config.ts', root)
  if (!result) return defaults
  return { ...defaults, ...result.config }
}
```

---

## `wald grow` — wijzigingen

### Import-fix

```ts
// Voor (broken):
import { waldPlugin } from '@waldjs/compiler'

// Na:
import { waldPlugin } from '../vite-plugin.js'
```

### Config doorgeven

```ts
const config = await loadWaldConfig()

const vite = await createServer({
  base: config.base,
  server: { middlewareMode: true },
  appType: 'custom',
  plugins: [waldPlugin()],
  ...config.vite,
})
```

`outDir` is niet relevant voor de dev server. `port` werkt via `config.vite.server.port`.

---

## `wald build` — two-pass Vite SSR pipeline

De bestaande `compileWaldFile` + `data:` URL-aanpak wordt vervangen.

### Pass 1 — SSR bundle

```ts
const ssrDir = join(cwd, '.wald-ssr')

// config.vite wordt eerst gespreud zodat WaldJS-instellingen altijd voorrang hebben
await build({
  ...config.vite,
  root: cwd,
  base: config.base,
  plugins: [waldPlugin(), ...(config.vite.plugins ?? [])],
  build: {
    ...config.vite.build,
    ssr: true,
    outDir: ssrDir,
    rollupOptions: {
      input: Object.fromEntries(routes.map(r => [r.pattern, r.file])),
    },
  },
})
```

Vite bundelt alle `.wald` pagina's en hun afhankelijkheden. CSS en assets worden automatisch meegenomen naar `config.outDir`.

### Pass 2 — Pre-render

```ts
try {
  // Rollup schrijft elke input-entry naar ssrDir met de route.pattern als sleutel.
  // De exacte bestandsnaam volgt Rollup's entry-naming: pattern → bestandsnaam in ssrDir.
  for (const route of staticRoutes) {
    const mod = await import(join(ssrDir, route.pattern.slice(1) || 'index', 'index.js'))
    const html = hoistScripts(maybeWrap(await mod.default.render()))
    const outPath = resolveOutPath(config.outDir, route.pattern)
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, html)
  }

  for (const route of dynamicRoutes) {
    const mod = await import(join(ssrDir, route.pattern.slice(1) || 'index', 'index.js'))
    if (!mod.getStaticPaths) {
      console.warn(`⚠ Skipping ${route.pattern} — no getStaticPaths() export`)
      continue
    }
    const paths = await mod.getStaticPaths()
    for (const { params } of paths) {
      const html = hoistScripts(maybeWrap(await mod.default.render(params)))
      const outPath = resolveOutPath(config.outDir, route.pattern, params)
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, html)
    }
  }
} finally {
  rmSync(ssrDir, { recursive: true, force: true })
}
```

### Eindresultaat in `outDir`

```
dist/
├── index.html
├── about/index.html
├── blog/
│   ├── index.html
│   └── hello-world/index.html
└── assets/
    ├── main-abc123.css
    └── chunk-def456.js
```

---

## Error handling

| Situatie | Gedrag |
|---|---|
| Geen `wald.config.ts` | Stille fallback naar defaults |
| `vite.build()` gooit fout | `ora` faalt met Vite-foutbericht, proces stopt |
| Route zonder `getStaticPaths()` | `⚠` warning, route overgeslagen (bestaand gedrag) |
| `.wald-ssr/` opruimen | Altijd in `finally`-blok, ook bij falende build |

---

## Bestandsstructuur

| Bestand | Actie |
|---|---|
| `packages/cli/src/config.ts` | Nieuw — `WaldConfig`, `defineConfig`, `loadWaldConfig` |
| `packages/cli/src/config.test.ts` | Nieuw — tests voor config loading |
| `packages/cli/src/commands/grow.ts` | Wijzigen — import-fix + config doorgeven |
| `packages/cli/src/commands/grow.test.ts` | Wijzigen — bestaande tests groen houden |
| `packages/cli/src/commands/build.ts` | Wijzigen — vervang `data:` pipeline door two-pass Vite SSR |
| `packages/cli/src/commands/build.test.ts` | Wijzigen — mock `vite.build()`, test pre-render |
| `packages/cli/src/index.ts` | Wijzigen — `defineConfig` en `WaldConfig` exporteren |

---

## Testing

- `config.test.ts`: `loadWaldConfig()` zonder config-bestand (defaults), met config-bestand, met gedeeltelijke config (merge met defaults)
- `build.test.ts`: mock `vite.build()` die een tijdelijke SSR-bundle schrijft; verifieer HTML-output per route; verifieer dat `.wald-ssr/` wordt opgeruimd
- `grow.test.ts`: bestaande tests blijven groen; verifieer dat `base` uit config aan Vite wordt doorgegeven
- **Constraint:** alle bestaande 47 tests blijven slagen

---

## Buiten scope

- Hydration / client-side JS bundels
- Deployment adapters (Phase 4c)
- `<style>` hoisting
- TypeScript in `<script>` blokken
- Incremental builds / watch mode in build
