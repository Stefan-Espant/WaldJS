# `wald check` — Design Spec

**Date:** 2026-07-02
**Status:** Approved

## Goal

A `wald check` CLI command that surfaces TypeScript type errors in `.wald` files and project `.ts` files. This closes the gap left by the `$props` inference feature: the compiler emits typed output, but esbuild strips types without checking them and `tsc` cannot read `.wald` files.

## Commands

```
wald check          # type-check the whole project (.wald + .ts), exit 1 on errors
wald build --check  # run the same check before building; abort the build on errors
```

`check` is a new citty subcommand registered in `packages/cli/src/cli.ts`, following the same pattern as `build` and `grow`.

## Architecture

Three units:

### 1. Compiler line map

`packages/compiler/src/transform/index.ts` gets a second export `transformWithMap(ast)` returning `{ code: string, lineMap: (number | null)[] }`:

- `lineMap[i]` is the 1-based original `.wald` source line for the 1-based output line `i + 1`, or `null` for generated lines (the runtime import, the `createTree` signature, the `$props` alias, the `return renderTemplate` line, closing brace, blank separators).
- Frontmatter lines are tracked through hoisting: hoisted blocks (`import`, `type Props`, `export`) and body lines each carry their original line number. The original line number of a frontmatter line = its index within the frontmatter code + the frontmatter's starting line in the `.wald` file (line 2, after the opening `---`).
- The existing `transform(ast)` remains unchanged and delegates to `transformWithMap` internally, discarding the map.

`packages/compiler/src/compile.ts` gets `compileWithMap(source, id)` returning `{ code, lineMap }`. The existing `compile()` remains unchanged.

### 2. Checker module

New file `packages/cli/src/checker.ts`, exporting:

```typescript
export interface CheckDiagnostic {
  file: string        // original .wald or .ts path
  line: number        // 1-based, remapped for .wald files
  column: number      // 1-based
  message: string
}

export async function checkProject(root: string): Promise<CheckDiagnostic[]>
```

Behavior:

- Finds all `.wald` files under `<root>/src/` (pages and components) and all `.ts` files under `<root>/src/`, excluding `node_modules` and `dist`.
- Compiles each `.wald` file in-memory with `compileWithMap`.
- Builds a `ts.Program` with a custom `CompilerHost`:
  - `.ts` files are served from the real filesystem.
  - Each `page.wald` is served as a virtual `page.wald.ts` containing the compiled output.
  - Module resolution: an import of `./Card.wald` resolves to the virtual `Card.wald.ts`.
  - `wald:content` resolves to a virtual type shim (`declare module 'wald:content' { ... }` matching the getCollection/getEntry API).
  - `@waldjs/runtime` resolves normally through node_modules.
- Collects syntactic and semantic diagnostics for all root files.
- For diagnostics in `.wald`-derived virtual files, positions are remapped through the line map. Diagnostics on generated lines (`lineMap` entry `null`) are reported at line 1 of the `.wald` file.
- Diagnostics in `.ts` files pass through unmodified.

### 3. Check command

New file `packages/cli/src/commands/check.ts`:

- Runs `checkProject(process.cwd())`.
- Renders each diagnostic in the same caret style as the existing WaldError DX:

```
[waldjs] src/pages/index.wald:3:9 — Property 'subtitle' does not exist on type 'Props'

  2 | type Props = { title: string }
  3 | const { subtitle } = $props
    |         ^
```

- Exit code 1 if there are any diagnostics, 0 otherwise.
- `wald build --check` runs the checker first and aborts before the Vite build when diagnostics exist.

## tsconfig

- If `<root>/tsconfig.json` exists, its `compilerOptions` are used (via `ts.readConfigFile` + `ts.parseJsonConfigFileContent`).
- Otherwise defaults apply: `strict: true`, `module: ESNext`, `target: ESNext`, `moduleResolution: bundler`, `skipLibCheck: true`.
- `typescript` moves from devDependency to dependency of `@waldjs/cli`.

## Testing

- Compiler: unit tests for `transformWithMap` — hoisted lines map to original positions, body lines account for the injected alias, generated lines map to `null`, multi-line `type Props` maps each line.
- Checker: fixture-based tests — a `.wald` file with a deliberate type error yields a diagnostic with the correct original file/line; a clean project yields an empty array; a `.ts` file error passes through; `.wald`-to-`.wald` imports resolve.
- CLI: `check` command exits 1 with rendered output on errors, 0 when clean; `build --check` aborts before building when errors exist.

## Out of scope

- IDE/editor integration (language server plugin) — later phase, can build on the same virtual-file foundation
- Watch mode (`wald check --watch`)
- Type-checking template expressions (`{title}` in the HTML section) — only frontmatter code is checked
- Checking `.tsx`/`.js` files
