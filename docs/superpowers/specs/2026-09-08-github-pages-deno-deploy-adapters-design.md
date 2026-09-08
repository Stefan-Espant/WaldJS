# GitHub Pages and Deno Deploy adapters

Implements issue [#28](https://github.com/Stefan-Espant/WaldJS/issues/28).

## Problem

WaldJS ships four deployment adapters (`staticAdapter`, `netlifyAdapter`, `cloudflarePagesAdapter`, `vercelAdapter`) via the `defineAdapter({ name, adapt({ outDir }) {...} })` pattern. GitHub Pages and Deno Deploy — two other common static-friendly hosts — aren't covered by a named adapter yet.

## Research

Before designing either adapter, checked what each platform actually requires for a static build:

- **GitHub Pages**: Jekyll processing runs on every Pages deploy by default and ignores `_`-prefixed files/folders and does Markdown/Liquid processing — an empty `.nojekyll` file at the output root disables that. This is the one adapter-relevant, platform-specific requirement.
- **Deno Deploy**: researched via `deployctl`'s own docs and Deno's blog post on static-file deploys. A purely static site needs no special output shape at all — `deployctl deploy --static-dir=dist` (or the zero-config GitHub-integration path) serves a plain directory of files directly. A `deno.json` is optional and, per Deno's own docs, is normally *written by* `deployctl` after a deploy rather than authored beforehand — so pre-writing one from the build risked being stale/overwritten rather than helpful.

This means the two adapters end up asymmetric in how much they actually do, and that's the honest result of what each platform needs, not an inconsistency to paper over.

## `githubPagesAdapter()`

```ts
export function githubPagesAdapter(): WaldAdapter {
  return defineAdapter({
    name: 'github-pages',
    adapt({ outDir }) {
      writeFile(join(outDir, '.nojekyll'), '')
      const indexPath = join(outDir, 'index.html')
      if (existsSync(indexPath)) {
        cpSync(indexPath, join(outDir, '404.html'))
      }
    },
  })
}
```

- `.nojekyll`: always written, unconditionally — matches the issue's acceptance criterion directly.
- `404.html`: a copy of the built `dist/index.html`, when one exists, so a visitor to an unmatched path gets the site's own home page instead of GitHub's default 404. This isn't an SPA client-routing fallback (WaldJS renders a real static file per route, there's no client router to hand off to) — it's just a friendlier 404 than the platform default. Guarded with `existsSync` since a project might not have a root `index.html` route.
- **`base` handling**: no adapter-specific code needed. `config.base` is already a general, adapter-independent mechanism threaded through the whole build (Vite's own `base` config, canopy asset URLs, etc.) — every page's asset references are already correctly built *before* `adapt()` ever runs, since adapters are the last build phase. Confirmed with a test that builds under a non-root `base` and checks the adapter's output is unaffected/correct.

## `denoDeployAdapter()`

```ts
// Deno Deploy has no adapter-specific output shape to produce — a plain
// static directory (`deployctl deploy --static-dir=dist`, or the GitHub
// integration's zero-config detection) is exactly what staticAdapter()
// already produces. This exists as its own named export so a project's
// wald.config.ts can say what it's deploying to explicitly, rather than
// silently relying on staticAdapter()'s default for a platform that in
// fact needs nothing special.
export function denoDeployAdapter(): WaldAdapter {
  return defineAdapter({ name: 'deno-deploy' })
}
```

No `adapt` hook, matching how `staticAdapter()` itself has none (`WaldAdapter.adapt` is optional).

## Other changes

- `packages/cli/src/index.ts`: export `githubPagesAdapter`, `denoDeployAdapter` alongside the existing four.
- `README.md`'s adapter table: add both new rows, matching the existing four's format.
- New `packages/cli/src/adapters.test.ts` — this file doesn't exist yet; the existing four adapters are only tested indirectly today (one integration-style assertion in `build.test.ts` for `vercelAdapter`'s `config.json`). This task adds direct unit tests for the two new adapters only — not retroactively covering the other four, which is a larger, separate cleanup not in scope here.

## Out of scope

- Retroactive unit tests for `staticAdapter`/`netlifyAdapter`/`cloudflarePagesAdapter`/`vercelAdapter`.
- Auto-deriving `config.base` from CI environment variables (e.g. `GITHUB_REPOSITORY`) for GitHub Pages project-page deploys — even if implemented, it would run too late to matter: `adapt()` is the last build phase, after every page's asset URLs are already baked in using whatever `base` was set at build start, so an adapter can't retroactively fix them.
- A `deno.json` written by the adapter — per Deno's own docs this file is meant to be managed by `deployctl` itself after a deploy, not pre-authored by the build.

## Testing

- `adapters.test.ts` (new): `githubPagesAdapter()` writes `.nojekyll`; copies `index.html` to `404.html` when present; doesn't crash and writes no `404.html` when `index.html` is absent; output is correct under a non-default `base`. `denoDeployAdapter()` has `name: 'deno-deploy'` and no `adapt` function.
