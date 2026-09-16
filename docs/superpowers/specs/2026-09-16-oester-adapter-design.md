# Oester adapter

## Problem

Oester is a hosting platform that builds a site from its repository and serves whatever the site's build writes to `.oester/output/`. WaldJS has adapters for six hosts, but none that writes that output, so a WaldJS site cannot be deployed there.

## Research

Oester reads one directory per build:

- `client/`: the static files, served by their path. A directory path is served from its `index.html`, and `client/404.html` is served for a path that matches nothing.
- `manifest.json`: version 2 of Oester's build output manifest, with the framework, the routes that need a server, redirects and header rules.
- `server/entry.js`: only for sites with server-rendered routes.

A WaldJS build is fully static (dynamic routes are pre-rendered through `getStaticPaths()`), so a WaldJS site needs `client/` and a manifest without routes. Oester then serves every built file by its path.

## `oesterAdapter()`

```ts
export function oesterAdapter(): WaldAdapter {
  return defineAdapter({
    name: 'oester',
    outDir: '.oester/output/client',
    async adapt({ rootDir, base }) {
      if (base !== '/') {
        throw new Error(
          `oesterAdapter() needs base: '/', because Oester serves a site from the root of its hostname (got base: '${base}')`,
        )
      }
      writeFile(join(rootDir, '.oester', 'output', 'manifest.json'), /* the manifest below */)
    },
  })
}
```

The manifest:

```json
{
  "version": 2,
  "framework": { "name": "wald" },
  "routes": [],
  "redirects": [],
  "headers": [
    { "path": "/assets/*", "headers": { "cache-control": "public, max-age=31536000, immutable" } }
  ]
}
```

- `outDir` points the build straight at `client/`, the same way `vercelAdapter()` points it at `.vercel/output/static`.
- The `/assets/*` rule is the cache rule the Netlify, Cloudflare Pages and Vercel adapters already set. Oester's own defaults cover everything else.
- `base`: Oester serves a site from the root of its hostname, and a non-root `base` would make every page reference assets under a prefix that `client/` does not have. Since `adapt()` runs after every page is built, the adapter cannot correct that, so it fails the build with a message instead of producing a site whose assets 404.

## Other changes

- `packages/cli/src/index.ts`: export `oesterAdapter`.
- `README.md`'s adapter table: one row for `oesterAdapter()`.

## Out of scope

- Serving a site under a sub-path of its hostname.
- A `framework.version` in the manifest; Oester treats it as optional.

## Testing

- `adapters.test.ts`: `oesterAdapter()` is named `oester` and builds into `.oester/output/client`; `adapt()` writes the manifest above; with `base: '/docs/'` the build fails and no manifest is written.
- A build of `examples/basic` with `oesterAdapter()`, and its manifest checked with Oester's own `validateManifest`.
