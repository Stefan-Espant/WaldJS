# wald grow src/assets/* base-aware serving

Implements issue [#47](https://github.com/Stefan-Espant/WaldJS/issues/47), a follow-up from #45.

## Problem

`wald grow`'s raw HTTP handler serves `src/assets/*` files via a literal-prefix check: `if (url.startsWith('/assets/')) { serveSrc(req, res, ...) }`. Under a non-default `config.base` (e.g. `/my-forest/`), `vite.transformIndexHtml` correctly rewrites a page's asset references (`<link href="/assets/css/global.css">` → `/my-forest/assets/css/global.css`) — but that base-prefixed URL doesn't literally start with `/assets/`, so it skips this branch entirely. It does not fall through to a working path either: `vite.middlewares` (the final fallback) has no knowledge of WaldJS's own `srcDir` → `/assets/` `sirv` mapping — that mapping only exists in this one branch. Result: a freshly-scaffolded project with a non-default `base` loads completely unstyled in dev, since its global stylesheet link 404s.

## Fix

Reuse `stripBase(url, base)` (from #45) for this branch too, computed once per request and shared with the existing page-routing check (removing that check's own separate `stripBase` call, which becomes redundant):

```ts
const server = createHttpServer((req, res) => {
  const url = req.url ?? '/'
  const routePath = stripBase(url, config.base)

  if (url === componentStylesPath) { /* unchanged */ }

  if (routePath !== null && routePath.startsWith('/assets/')) {
    req.url = routePath
    serveSrc(req, res, () => {
      if (!res.headersSent && !res.writableEnded) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Asset not found')
      }
    })
    return
  }

  servePublic(req, res, async () => {
    // routePath is already computed above — the page-routing branch's own
    // separate `stripBase(url, config.base)` call is removed, it reuses
    // this same value now.
    const match = routePath !== null ? matchRoute(routes, routePath) : null
    ...
  })
})
```

**Overwriting `req.url` before delegating to `serveSrc` is the correct, sanctioned way to do this — verified against the actual dependency source, not assumed.** `sirv` (`node_modules/sirv/build.js`) derives the path to serve via `@polka/url`'s `parse(req)`, which reads `req.url` directly — there's no separate "path" parameter sirv accepts. That `parse()` function does cache its result on `req._parsedUrl`, but the cache check (`prev.raw === raw`, where `raw = req.url` at call time) compares against the *current* `req.url` value at the moment of the call — so reassigning `req.url` immediately before calling `serveSrc(req, res, next)` is guaranteed to bust the cache and reparse correctly, not risk stale data. This is also the same pattern Express's own `Router` uses internally when mounting a sub-router at a path prefix.

**Root base (`/`, the default) is completely unaffected.** `stripBase(url, '/')` returns `url` unchanged (the existing no-op fast path from #45), so `routePath === url` always in that case, and `req.url = routePath` is a no-op reassignment to its own current value.

**False-prefix protection carries over for free.** A request like `/my-forest-extra/assets/...` under `base: '/my-forest/'` already correctly returns `null` from `stripBase` (per #45's existing suffix-boundary check), so it correctly falls through past this branch rather than being mistaken for an asset request.

## Out of scope

- `public/`-dir asset serving — already unaffected, confirmed in #47's own issue body (falls through to `vite.middlewares`, which already handles `base` correctly there).
- Any change to `stripBase` itself, `componentStylesPath`, or page routing beyond removing the now-redundant duplicate `stripBase` call — this issue is scoped to the `/assets/*` branch specifically.

## Testing

- Extend `stripBase`'s existing test suite (`grow.test.ts`) with `/assets/*`-shaped inputs: a base-prefixed asset path strips to the correct unprefixed `/assets/...` path; an unprefixed asset request under a non-default base still correctly returns `null` (doesn't silently serve).
- Given #41 and #45's history — a live-server test caught bugs unit tests alone didn't, twice — this work gets a mandatory real `wald grow` + real HTTP request verification before being considered done: a freshly-scaffolded project with a non-default `base` and a real `src/assets/*` file (e.g. its global stylesheet), confirming the base-prefixed request returns the actual file content, not a 404, and that a `wald plant`-scaffolded project visually loads styled.
