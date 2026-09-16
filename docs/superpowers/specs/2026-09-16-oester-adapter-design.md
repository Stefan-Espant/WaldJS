# Oester adapter

## Problem

Oester is a hosting platform that builds a site from its repository and serves whatever the site's build writes to `.oester/output/`. WaldJS has adapters for six hosts, but none that writes that output, so a WaldJS site cannot be deployed there.

## Research

Oester reads one directory per build:

- `client/`: the static files, served by their path. A directory path is served from its `index.html`, and `client/404.html` is served for a path that matches nothing.
- `manifest.json`: version 2 of Oester's build output manifest, with the framework, an optional `base`, the routes that need a server, redirects and header rules.
- `server/entry.js`: only for sites with server-rendered routes.

A WaldJS build is fully static (dynamic routes are pre-rendered through `getStaticPaths()`), so a WaldJS site needs `client/` and a manifest without routes. Oester then serves every built file by its path.

`base` means the site lives under that path: `wald grow` serves it there, and every URL the build generates carries it, while the files stay at the root of the output. Oester's manifest has a `base` for exactly that: Oester serves the build under it, reads every other path in the manifest relative to it, and redirects the root of the hostname there. The adapter only has to pass it on.

## `oesterAdapter()`

```ts
export function oesterAdapter(): WaldAdapter {
  return defineAdapter({
    name: 'oester',
    outDir: '.oester/output/client',
    adapt({ rootDir, base }) {
      writeFile(join(rootDir, '.oester', 'output', 'manifest.json'), /* the manifest below */)
    },
  })
}
```

The manifest, here for `base: '/docs/'`:

```json
{
  "version": 2,
  "framework": { "name": "wald" },
  "base": "/docs/",
  "routes": [],
  "redirects": [],
  "headers": [
    { "path": "/assets/*", "headers": { "cache-control": "public, max-age=31536000, immutable" } }
  ]
}
```

- `outDir` points the build straight at `client/`, the same way `vercelAdapter()` points it at `.vercel/output/static`.
- The `/assets/*` rule is the cache rule the Netlify, Cloudflare Pages and Vercel adapters already set. Oester reads it relative to the base, and its own defaults cover everything else.
- `base` is left out for the default `/` and for an empty base, which the build treats as the root too. Any other base is passed as written: Oester adds a missing trailing slash, and refuses a base that is not a path (`./`, a full URL) when the site is deployed, with a message saying so.

## Other changes

- `packages/cli/src/index.ts`: export `oesterAdapter`.
- `README.md`'s adapter table: one row for `oesterAdapter()`.

## Out of scope

- URLs a site writes itself without the base (for example a hard-coded `/assets/…` link). They break under a base on every host.
- A `framework.version` in the manifest; Oester treats it as optional.

## Testing

- `adapters.test.ts`: `oesterAdapter()` is named `oester` and builds into `.oester/output/client`; `adapt()` writes the manifest without a base at the root, with `base: '/docs/'` under that base while the built files stay where they are, and without a base for an empty one.
- The marketing site built with `oesterAdapter()` at the root and under `base: '/docs/'`, each manifest checked with Oester's own `validateManifest`, and the `/docs/` build served through Oester's serving code.
