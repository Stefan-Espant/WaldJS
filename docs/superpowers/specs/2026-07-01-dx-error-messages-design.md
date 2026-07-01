# DX Error Messages — Design

**Date:** 2026-07-01
**Scope:** Begrijpelijke compiler errors met bestandsnaam, regelnummer en kolom voor `.wald` scanner-fouten.

---

## Context

De WaldJS scanner gooit momenteel geen fouten bij ongeldige template-syntax. Een niet-afgesloten `{`, een ontbrekende `"` in een attribuut, of een tag die nooit sluit resulteert in stille garbled output of een onleesbare Vite stack trace. Gebruikers weten niet waar de fout zit.

De Vite plugin (`packages/cli/src/vite-plugin.ts`) heeft al een `try/catch` die controleert op een `line` eigenschap en deze doorgeeft aan `this.error({ message, loc })`. Vite toont dan automatisch bestandsnaam, regelnummer en een caret-highlight. Het enige dat ontbreekt: de compiler gooit nooit fouten mét positie-info.

---

## Vastgestelde keuzes

| Keuze | Beslissing |
|---|---|
| Scope | Alleen scanner-fouten (Phase 1) |
| Positie-tracking | Offset-to-line/col bij throw (niet live bijhouden) |
| Error class | Nieuw `WaldError` in `@waldjs/compiler` |
| Formatter | Vite's ingebouwde caret-renderer (geen eigen formatter) |
| Transform-fouten | Buiten scope — apart plan |
| Runtime-fouten | Buiten scope |

---

## Fouten in scope

| Situatie | Bericht |
|---|---|
| `{expr` zonder sluitende `}` | `Unclosed expression: expected '}'` |
| `class="foo` zonder sluitende `"` | `Unclosed string attribute: expected '"'` |
| `<div` zonder sluitende `>` of `/>` | `Unclosed tag '<div>': expected '>' or '/>'` |

---

## Architectuur

### `packages/compiler/src/errors.ts` (nieuw)

```typescript
export class WaldError extends Error {
  readonly line: number    // 1-based
  readonly column: number  // 1-based
  file?: string

  constructor(message: string, line: number, column: number) {
    super(message)
    this.name = 'WaldError'
    this.line = line
    this.column = column
  }
}

export function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  const lines = source.slice(0, offset).split('\n')
  return {
    line: lines.length,         // 1-based
    column: lines.at(-1)!.length + 1,  // 1-based
  }
}
```

### `packages/compiler/src/parser/scanner.ts` (aanpassing)

De `Scanner` class krijgt toegang tot de volledige `source` string (heeft die al). Bij de drie foutcondities:

1. `scanExpression()` — als de `while`-loop eindigt met `depth > 0`: throw
2. `scanAttribute()` — als de string-attribuut `while`-loop eindigt zonder sluitende `"`: throw
3. `scanElement()` — als na het scannen van de tag-identifier de positie niet bij `>` of `/>` uitkomt (end-of-source bereikt): throw

In alle drie gevallen: `throw new WaldError(message, line, column)` via `offsetToLineCol(this.source, this.pos)`.

### `packages/compiler/src/compile.ts` (aanpassing)

```typescript
export function compile(source: string, id: string): string {
  try {
    const ast = parse(source)
    return transform(ast)
  } catch (e) {
    if (e instanceof WaldError) {
      e.file = id
      throw e
    }
    throw e
  }
}
```

### `packages/cli/src/vite-plugin.ts` (aanpassing)

Breidt de `loc` extractie uit met `column`:

```typescript
const loc = typeof e === 'object' && e !== null && 'line' in e
  ? {
      line: (e as { line: number }).line,
      column: 'column' in e ? (e as { column: number }).column - 1 : 0, // Vite is 0-based
    }
  : undefined
this.error({ message, loc })
```

---

## Resultaat voor de gebruiker

```
✘ [ERROR] [waldjs] Unclosed expression: expected '}'

    src/pages/index.wald:7:12:
      7 │ <h1>{title</h1>
        │            ^
```

Vite tekent de caret automatisch op basis van `loc.line` en `loc.column`.

---

## Testing

### `@waldjs/compiler`

- `WaldError` heeft correcte `line`, `column`, `name`
- `offsetToLineCol` geeft juiste waarden voor multi-line source
- Scanner: unclosed `{` → `WaldError` met correcte positie
- Scanner: unclosed `"` in attribuut → `WaldError` met correcte positie
- Scanner: unclosed tag → `WaldError` met correcte positie
- Valide input: geen fouten

### `@waldjs/cli`

- `compile()` hergooit `WaldError` met `file` ingevuld
- Vite plugin: `WaldError` → `this.error` met correcte `loc.line` en `loc.column` (0-based)
- Vite plugin: niet-`WaldError` → `this.error` zonder `loc` (bestaand gedrag)

---

## Geraakte bestanden

| Bestand | Actie |
|---|---|
| `packages/compiler/src/errors.ts` | Nieuw — `WaldError` class + `offsetToLineCol` helper |
| `packages/compiler/src/index.ts` | Exporteer `WaldError` |
| `packages/compiler/src/parser/scanner.ts` | Throw `WaldError` bij 3 foutcondities |
| `packages/compiler/src/compile.ts` | Vang en hergooi `WaldError` met `file` |
| `packages/cli/src/vite-plugin.ts` | Extraheer ook `column` uit error |

---

## Buiten scope

- Transform-fouten (ongeldige `canopy:xyz`, missende props)
- Runtime-fouten in de browser
- Frontmatter JS syntax-fouten (Vite/esbuild pakt die al op)
- Eigen terminal-formatter (Vite's renderer is voldoende)
- `wald grow` dev server HMR error overlay (wordt automatisch beter door dezelfde fix)
