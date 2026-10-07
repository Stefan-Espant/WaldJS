# Automatic generator meta tag — Design

## Motivation

Follow-up to [Wald.generator](2026-10-07-wald-generator-design.md) (#93). That
change only reaches projects created with `wald plant` ≥ 0.11.0: existing
projects own their `Layout.wald` and never get the tag, so they stay invisible
to site-source search. To count every site that upgrades, `wald build` adds the
tag itself, the way WordPress does — with an explicit opt-out.

## Design

- **`injectGeneratorMeta(html, generator)`** (new `src/generator-meta.ts`, pure):
  - returns `html` unchanged if it already contains a
    `<meta name="generator" …>` (any attribute order, quoting, case) — a
    layout's own tag (e.g. from the 0.11 starter) always wins, so no duplicates;
  - returns `html` unchanged if there is no `<head>` opening tag;
  - otherwise inserts `<meta name="generator" content="…">` (content
    HTML-escaped) directly after the `<head …>` opening tag.
- **`wald build`** applies it to every rendered page (static and dynamic) with
  `WALD_GENERATOR`, unless `generator: false` is set in `wald.config.ts`.
- **Config**: `WaldConfig.generator?: boolean`, default `true`.
- `wald grow` is unchanged: the tag only matters in deployed HTML.

## Communication

Opt-out behaviour is something people should not discover by surprise: the
changeset text states it plainly (with the `generator: false` snippet), and the
README config section documents the option.

## Testing

Unit tests for `injectGeneratorMeta` (insert, existing tag in several forms,
no `<head>`, `<head lang>` attributes, escaping), config default test, and a
build integration test: tag present by default, absent with
`generator: false`, not duplicated when the layout already has one.
