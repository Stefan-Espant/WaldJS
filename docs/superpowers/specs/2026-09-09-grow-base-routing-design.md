# wald grow base-aware page routing

Implements issue [#45](https://github.com/Stefan-Espant/WaldJS/issues/45), a follow-up from #41.

## Problem

`wald grow`'s raw HTTP handler passes `req.url` straight into `matchRoute(routes, url)` with no `config.base` stripping. `matchRoute`/`scanRoutes` only know unprefixed patterns (`/`, `/about`, `/blog/:slug`), so a browser request for the base-prefixed path a non-default `base` actually produces (e.g. `/my-forest/about`) never matches and falls through to a 404 — even though `http://localhost:PORT/about` (the wrong, unprefixed URL) serves the page fine. Vite's own dev-server middleware (the fallback when `matchRoute` finds nothing) already handles `base` correctly; this gap is specific to `grow.ts`'s own routing logic, which runs before that fallback.

## Fix — `stripBase(url, base)`

New exported function in `packages/cli/src/commands/grow.ts`:

```ts
export function stripBase(url: string, base: string): string | null {
  const queryIndex = url.indexOf('?')
  const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : url.slice(queryIndex)

  const normalizedBase = base.replace(/\/$/, '')
  if (normalizedBase === '') return url // root base ('/') — nothing to strip, ever
  if (pathname === normalizedBase) return '/' + query
  if (pathname.startsWith(normalizedBase + '/')) return pathname.slice(normalizedBase.length) + query
  return null // doesn't start with the configured base at all
}
```

- Root base (`'/'`, the default and overwhelmingly common case) is a no-op fast path — `url` passes through completely unchanged, so this is zero-risk for every project that doesn't set a custom `base`.
- Query strings are split off before matching and reattached after, so `?x=1` on a base-prefixed request doesn't interfere with the prefix check.
- The `+ '/'` suffix check when comparing against `normalizedBase` prevents a false match on a path that merely shares a text prefix (e.g. `/my-forest-extra/about` must not match `base: '/my-forest/'`).
- Handles `base` configured with or without a trailing slash identically (`'/my-forest'` and `'/my-forest/'` both normalize to `/my-forest`) — a small bonus fix for an inconsistency a previous code review (during #41) flagged as a separate latent gap.
- Returns `null` — not an empty/unchanged string — when the request doesn't start with the configured base at all. This is the signal the caller uses to treat the request as unmatched (404), which is the AC's "pick 404 or a redirect" choice: **404**, since that's already how every other "doesn't exist" case in this file is handled (no existing precedent for redirecting), and the acceptance criteria only requires *a* sensible behavior, not a redirect specifically.

## Wiring into `grow.ts`

The raw HTTP handler's routing decision changes from:

```ts
const routes = scanRoutes(pagesDir)
const match = matchRoute(routes, url)

if (!match) {
  vite.middlewares(req, res, () => { /* 404 */ })
  return
}

const { status, body } = await handleRequest(routes, url, vite as unknown as ViteLike)
```

to stripping first:

```ts
const routes = scanRoutes(pagesDir)
const routePath = stripBase(url, config.base)
const match = routePath !== null ? matchRoute(routes, routePath) : null

if (!match) {
  vite.middlewares(req, res, () => { /* 404 */ })
  return
}

const { status, body } = await handleRequest(routes, url, vite as unknown as ViteLike, routePath)
```

`handleRequest` gains a 4th, optional `routePath = url` parameter — used for its *internal* `matchRoute` call, while the *original* `url` (still, unchanged) is what gets passed to `vite.transformIndexHtml(url, body)`. These need to stay separate: `matchRoute` needs the base-stripped path to find the route; `transformIndexHtml` needs the real request URL, since that's the contract Vite's own API expects (and it's `config.base`, not the passed-in `url` string, that actually drives Vite's own prefixing — confirmed by tracing Vite's source during #41's fix). Defaulting `routePath` to `url` keeps every existing `handleRequest` call site and test (all root-base, all passing 3 args) working completely unchanged.

## Why not touch the `/assets/*` or component-styles routes

Both already either handle `base` correctly (`componentStylesPath`, fixed in #41) or fall through to Vite's own already-base-aware middleware when they don't match (confirmed: a base-prefixed asset request like `/my-forest/assets/hero.jpg` doesn't literally start with `/assets/`, so it skips the raw-HTTP shortcut branch entirely and reaches `vite.middlewares`, which handles it). This issue is scoped to page routing specifically, per its own acceptance criteria.

## Testing

- Direct unit tests for `stripBase`: root base passthrough, base-prefixed path stripped correctly (with and without a trailing slash on `base`, with and without a query string, at the base's own root), and the false-positive-prefix and doesn't-start-with-base cases returning `null`.
- A `handleRequest` test passing a `routePath` distinct from `url`, confirming the route is matched via `routePath` while rendering still succeeds — this exercises the exact function the real HTTP handler calls, not a reimplementation of it (same testing approach already used and accepted for #41's `componentStylesHref`).
- Given #41's lesson (a live-server test caught a bug none of the unit tests did), this work gets a real `wald grow` + real HTTP request verification under a non-default `base` before being considered done, not just unit tests.

## Out of scope

- Changing `/assets/*` or `public/` serving behavior — unaffected, as explained above.
- A redirect from the unprefixed path to the base-prefixed one. 404 was chosen as the simpler, already-precedented behavior; a redirect is a reasonable alternative but not what this fix implements.
