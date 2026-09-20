# TypeScript `$props` Inference — Design Spec

**Date:** 2026-07-01
**Status:** Approved

## Goal

Users declare `type Props = { ... }` in `.wald` frontmatter and get TypeScript type-checking for `$props` usage — no VS Code language server plugin required.

## Scope

Type-checking only. No IDE autocomplete, no `.d.ts` generation, no caller-side prop checking. Errors surface via `tsc --noEmit` or `vite build`. Fully backwards compatible: `.wald` files without `type Props` compile identically to today.

## Syntax

```wald
---
type Props = { title: string; count?: number }
const { title, count = 0 } = $props
---
<h1>{title}</h1>
<p>{count}</p>
```

`type Props` must be a top-level TypeScript type alias. Interfaces (`interface Props`) and other names (`type MyProps`) are not supported in this version.

## Compiler Changes

### Detection

`extractExports()` in `packages/compiler/src/transform/index.ts` already hoists `import` and `export` lines. It is extended to also hoist lines that match `type Props\s*=` (the `type Props` declaration).

Detection is regex-based — no TypeScript compiler API dependency. Multi-line `type Props` is supported by collecting lines until braces are balanced (same pattern as existing `export` block handling).

### Generated Output (with Props)

Input:
```wald
---
type Props = { title: string }
const { title } = $props
---
<h1>{title}</h1>
```

Output:
```typescript
import { createTree, renderTemplate, SafeHtml } from '@waldjs/runtime'

type Props = { title: string }

export default createTree<Props>(async ($$result, $$props: Props) => {
  const $props = $$props
  const { title } = $props

  return renderTemplate`<h1>${title}</h1>`
})
```

Changes from current output:
- `type Props = ...` appears in the hoisted section
- `createTree(` → `createTree<Props>(`
- `($$result, $$props)` → `($$result, $$props: Props)`
- `const $props = $$props` injected as first line of body

### Generated Output (without Props)

Unchanged from current output. No `$props` alias injected.

## Runtime Changes

`packages/runtime/src/index.ts` — `createTree` and `Tree` become generic:

```typescript
export type Tree<TProps extends Record<string, unknown> = Record<string, unknown>> = {
  render: (props?: TProps) => Promise<string>
}

export function createTree<TProps extends Record<string, unknown> = Record<string, unknown>>(
  fn: ($result: BuildContext, $props: TProps) => Promise<string>
): Tree<TProps> {
  return {
    render: (props = {} as TProps) => fn({}, props),
  }
}
```

Default `TProps = Record<string, unknown>` preserves backwards compatibility. Existing `.wald` files without Props compile to `createTree(...)` which infers `TProps = Record<string, unknown>`.

## `$props` Convention

The generated code always uses `$$props` (double dollar) as the function parameter name to avoid collisions. The `const $props = $$props` alias is injected when Props is detected, so users write single-dollar `$props` in their frontmatter — consistent with how WaldJS examples already read.

## Files Touched

| File | Change |
|---|---|
| `packages/compiler/src/transform/index.ts` | Hoist `type Props`, inject generic + alias |
| `packages/runtime/src/index.ts` | Make `createTree` and `Tree` generic |
| `packages/compiler/src/transform/index.test.ts` | Tests for Props hoisting and generated output |
| `packages/runtime/src/index.test.ts` | Tests for generic `createTree` |

## Testing

- `type Props` with simple fields → correct hoisted declaration + `$$props: Props` + alias
- `type Props` spanning multiple lines (union, optional fields) → correctly collected
- No `type Props` → output unchanged from current
- `createTree<Props>` round-trip: TypeScript can infer prop type from generated module
- Runtime: `tree.render({ title: 'hello' })` satisfies `Tree<{ title: string }>`

## Out of Scope

- `interface Props` — use `type` alias only
- Props checking on callers (requires language server plugin)
- `.d.ts` generation for `.wald` modules
- IDE autocomplete
