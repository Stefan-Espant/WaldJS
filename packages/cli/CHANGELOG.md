# @waldjs/cli

## 0.7.0

### Minor Changes

- 6869670: Add `githubPagesAdapter()` (writes `.nojekyll` and a `404.html` fallback) and `denoDeployAdapter()` (Deno Deploy needs no special static-output shape, so this is a named alias documenting the deploy target) alongside the existing `staticAdapter`/`netlifyAdapter`/`cloudflarePagesAdapter`/`vercelAdapter`.

### Patch Changes

- d225d82: Fix the scoped-component-CSS stylesheet link (`/assets/wald-components.css`) to respect `config.base` in both `wald build` output and `wald grow`'s dev-server route — previously hardcoded to the root path, it 404'd under a non-default `base` (e.g. a GitHub Pages project page). Also adds a regression test confirming a component using both `<style>` and `canopy:*` keeps its scope attribute.

## 0.6.0

### Minor Changes

- a90e3e9: Add a `<style>` block to any `.wald` file to write CSS scoped to that component's own markup — every element it renders gets a `data-wald-<hash>` attribute, and its selectors are rewritten to match only elements carrying that attribute. `wald grow` and `wald build` both bundle every component's scoped CSS into a single `/assets/wald-components.css`, linked automatically into any page that actually renders a styled component.

### Patch Changes

- Updated dependencies [a90e3e9]
  - @waldjs/compiler@0.2.0

## 0.5.0

### Minor Changes

- cf624f2: `wald grow` now shows compile and render errors as a readable HTML page (message, file/line, code frame, stack) instead of a bare plain-text 500. The page goes through `transformIndexHtml()` like a normal page response, so the Vite HMR client is still connected and the browser can pick up a live-reload once the underlying file is fixed.

## 0.4.0

### Minor Changes

- 47d0ed8: `wald grow` now live-reloads the browser automatically when a `.wald` page/component or `content/` entry changes, instead of requiring a manual refresh. The dev server's HTTP server is now wired into Vite's HMR websocket, and pages are run through `transformIndexHtml` to inject the Vite client. Since every page is server-rendered fresh per request, reloads are full-page rather than partial/state-preserving hot updates — see [#20](https://github.com/Stefan-Espant/WaldJS/issues/20) for state-preserving component HMR as follow-up work.
- 7883e62: Add `wald:image`'s `<Image src="..." alt="..." widths={[400, 800]} />` for responsive, optimized images. `wald build` resizes the source to each requested width, converts it to WebP, and writes the variants to `dist/assets/optimized/`, producing a matching `srcset`/`sizes` and the source's natural `width`/`height`. Formats WebP can't usefully re-encode (SVG, GIF) pass through unprocessed. `wald grow` skips processing and serves the original file directly. Adds `sharp` as a new dependency of `@waldjs/cli`.
- ac374e0: Add `wald new component <Name>` and `wald new page <route>` to scaffold a `.wald` file in `src/components/` or `src/pages/` without hand-copying an existing one. `wald new page` recognizes dynamic segments (`wald new page blog/[slug]`) and scaffolds a typed `Props` plus a `getStaticPaths()` stub. Both refuse to overwrite an existing file.
- ece732d: Add `wald:prefetch="hover"` / `wald:prefetch="visible"` for prefetching a linked page's HTML before the user clicks — no compiler support needed, since it's a plain HTML attribute on any element with an `href`. `wald grow` and `wald build` both inline a small runtime automatically, but only into pages that actually use the directive; pages without it stay at 0 KB JS. `@waldjs/canopy` gains a new `@waldjs/canopy/prefetch` export.

### Patch Changes

- Updated dependencies [ece732d]
  - @waldjs/canopy@0.2.0

## 0.3.2

### Patch Changes

- 1ee3bed: Fix `wald check` failing on every freshly scaffolded project with `Argument of type 'unknown' is not assignable to parameter of type 'string'` on `blog/[slug].wald`. The generated file used `$$props.slug` without declaring `type Props`, so the compiler fell back to `createTree`'s default `Record<string, unknown>` prop type instead of a typed one. Now declares `type Props = { slug: string }`, matching the pattern used everywhere else typed props are needed.

## 0.3.1

### Patch Changes

- 752e105: Fix the growing-tree loading animation (shown during `wald grow`/`wald build`) leaving stacked, duplicate frames on screen instead of redrawing in place. The animation is 70 columns wide but never checked the terminal's actual width — in a narrower terminal, lines wrap and the cursor-up redraw math no longer lines up with what's on screen. Now falls back to a plain text label when the terminal is too narrow, same as it already did for non-TTY output.

## 0.3.0

### Minor Changes

- a64abf7: `wald plant` (and `create-wald`) now scaffold a fully styled starter instead of unstyled HTML: a dark green gradient background, glossy red 3D buttons and cards, Baloo 2 typography, a navbar/footer, and a styled blog list — matching WaldJS's own brand. `Card` gained an optional `icon` prop; `Counter`'s behavior is unchanged, only restyled.

## 0.2.0

### Minor Changes

- 68defc0: `wald plant` now automatically installs dependencies (detecting npm/pnpm/yarn/bun via the invoking package manager) and prints the matching `dev` command, instead of always suggesting `pnpm install` regardless of how it was invoked.

  Also adds the `create-wald` package, so `npm create wald@latest my-forest` works as a shorter alias for `npx @waldjs/cli plant my-forest`.

## 0.1.1

### Patch Changes

- 2cab7f4: Fix two bugs found via a real `npm install @waldjs/cli` smoke test:

  - The CLI crashed on every command outside the monorepo because `bin/wald.js` unconditionally scanned a `src/` directory that only exists in the workspace, not in a published install.
  - Dynamic `[param].wald` routes failed to build whenever the project had more than one page, because Rollup renames the SSR chunk (e.g. `[slug].js` → `_slug_.js`) and the build step guessed the old filename instead of reading it from the actual bundle output.
