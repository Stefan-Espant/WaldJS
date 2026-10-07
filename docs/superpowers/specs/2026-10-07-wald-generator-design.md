# Wald.generator — Design

## Motivation

To see which public sites are built with WaldJS, those sites need a
recognisable `<meta name="generator">` tag that site-source search engines
(publicwww, Wappalyzer) can find. Astro solves this with `Astro.generator`;
WaldJS has no equivalent, so `content={Wald.generator}` in a `.wald` file is
currently a `ReferenceError`. Adding the tag to waldjs.eu alone is not enough:
the framework has to provide the value and the `wald plant` starter has to use
it, so new projects carry it by default.

## Design

- **Compiler (`@waldjs/compiler`)** — every compiled `.wald` module gets a
  module-scope constant right after the runtime import:
  `const Wald = Object.freeze({ generator: "<generator>" })`.
  `transformWithMap` / `compile` / `compileWithMap` take an optional
  `{ generator?: string }` options argument; the default is `"WaldJS"` (no
  version), because the compiler is versioned independently of what users
  think of as "the WaldJS version". The line is generated (`lineMap` `null`).
  Because `wald check` type-checks the compiled output, `Wald.generator` is
  typed as `string` with no extra declaration file.
- **CLI (`@waldjs/cli`)** — new `src/version.ts` reads the CLI's own
  `package.json` version (the version users install and the site's npm badge
  shows) and exports `WALD_GENERATOR = "WaldJS v<version>"`. The Vite plugin
  and the checker pass it to the compiler. `cli.ts` uses the same version for
  `wald --version`, which was hardcoded to a stale `0.1.0`.
- **Starter** — the `wald plant` layout template adds
  `<meta name="generator" content={Wald.generator} />`.
- **Marketing site + README** — waldjs.eu dogfoods the tag; the README layout
  example shows it and documents `Wald.generator`.

## Out of scope

Other `Wald.*` properties (e.g. `Wald.url`), opt-out config, and any usage
telemetry. The tag is plain static HTML that site owners can remove.

## Testing

Compiler unit tests (default + custom generator, `lineMap` null, exact output
test updated), CLI unit test for `WALD_GENERATOR` matching `package.json`,
plant test asserting the meta line, marketing smoke test asserting
`<meta name="generator" content="WaldJS v` in built HTML.
