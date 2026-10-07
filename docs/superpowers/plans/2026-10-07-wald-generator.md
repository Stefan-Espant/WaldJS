# Wald.generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose `Wald.generator` (`"WaldJS v<cli version>"`) in every `.wald` frontmatter/template and emit `<meta name="generator">` from the starter layout and waldjs.eu.

**Architecture:** The compiler injects a frozen module-scope `Wald` constant (value configurable, default `"WaldJS"`); the CLI supplies its own package version via `src/version.ts` to both the Vite plugin and the checker.

**Tech Stack:** TypeScript, Vitest, `@waldjs/compiler`, `@waldjs/cli`, changesets.

**Spec:** [2026-10-07-wald-generator-design.md](../specs/2026-10-07-wald-generator-design.md)

---

## Before you start

`git checkout -b feat/wald-generator main`. Build only the touched packages (`pnpm turbo run build --filter=@waldjs/cli...`), not the whole graph.

### Task 1: Compiler option + injected constant

- [ ] Test: default output contains `const Wald = Object.freeze({ generator: "WaldJS" })` with `lineMap` `null`; a custom `{ generator: 'WaldJS v9.9.9' }` is emitted JSON-escaped; update the exact-output test.
- [ ] Add `TransformOptions` to `transformWithMap`/`transform`, thread it through `compile`/`compileWithMap`, export the type.

### Task 2: CLI version source

- [ ] Test: `WALD_GENERATOR === \`WaldJS v${pkg.version}\``.
- [ ] Add `src/version.ts` (`createRequire` → `../package.json`), use it in `vite-plugin.ts`, `checker.ts` and `cli.ts` (`meta.version`).

### Task 3: Starter, marketing, docs, changeset

- [ ] `plant.ts` layout template + plant test for the meta line.
- [ ] Marketing `Layout.wald` meta + smoke test; README layout example + one-line explanation.
- [ ] Changeset: `@waldjs/compiler` minor, `@waldjs/cli` minor.
- [ ] Live check: `pnpm build` in `marketing/` and grep `dist/index.html` for the tag; `wald check` error count unchanged (53 pre-existing).
