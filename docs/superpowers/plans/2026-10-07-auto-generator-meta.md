# Automatic Generator Meta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `wald build` adds `<meta name="generator" content="WaldJS v<version>">` to every page that lacks one, opt-out via `generator: false`.

**Architecture:** Pure `injectGeneratorMeta()` helper in `@waldjs/cli`, applied in `buildPages` next to the other HTML post-processing (`injectComponentStyles`, `injectPrefetchRuntime`).

**Tech Stack:** TypeScript, Vitest, `@waldjs/cli`, changesets.

**Spec:** [2026-10-07-auto-generator-meta-design.md](../specs/2026-10-07-auto-generator-meta-design.md)

---

## Before you start

`git checkout -b feat/auto-generator-meta main`. Builds on #93 (`WALD_GENERATOR` in `src/version.ts`).

### Task 1: Helper

- [ ] Tests in `src/generator-meta.test.ts`; implement `src/generator-meta.ts`.

### Task 2: Config + build wiring

- [ ] `generator?: boolean` (default `true`) in `config.ts` + test.
- [ ] Apply in both render loops of `commands/build.ts`; build tests for default / opt-out / no duplicate.

### Task 3: Docs + release

- [ ] README config section; changeset (`@waldjs/cli` minor) that spells out the opt-out.
- [ ] Live check: marketing `pnpm build` still has exactly one generator tag per page.
