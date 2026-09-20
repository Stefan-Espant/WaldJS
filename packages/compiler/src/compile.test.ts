import { describe, it, expect } from 'vitest'
import { compile, compileWithMap } from './compile.js'
import { WaldError } from './errors.js'

describe('compile', () => {
  it('returns a JS module string from a .wald source', () => {
    const source = `---
const title = "Hello Wald"
---
<h1>{title}</h1>`

    const output = compile(source, '/src/index.wald')

    expect(output).toContain("import { createTree, renderTemplate, SafeHtml } from '@waldjs/runtime'")
    expect(output).toContain('export default createTree')
    expect(output).toContain('const title = "Hello Wald"')
    expect(output).toContain('<h1>${title}</h1>')
  })

  it('compiles template-only .wald files', () => {
    const source = '<p>Hello world</p>'
    const output = compile(source, '/src/page.wald')

    expect(output).toContain('export default createTree')
    expect(output).toContain('renderTemplate`<p>Hello world</p>`')
  })
})

describe('compile — error propagation', () => {
  it('throws WaldError with file set when scanner fails', () => {
    let caught: WaldError | undefined
    try {
      compile('---\n---\n{unclosed', '/src/page.wald')
    } catch (e) {
      caught = e as WaldError
    }
    expect(caught).toBeInstanceOf(WaldError)
    expect(caught?.file).toBe('/src/page.wald')
  })

  it('preserves line and column from scanner', () => {
    let caught: WaldError | undefined
    try {
      compile('---\n---\n{unclosed', '/src/page.wald')
    } catch (e) {
      caught = e as WaldError
    }
    expect(caught?.line).toBeGreaterThan(0)
    expect(caught?.column).toBeGreaterThan(0)
  })
})

describe('compile — volledig HTML-document', () => {
  it('compileert een document met doctype zonder mangling', () => {
    const source = `---
---
<!DOCTYPE html>
<html lang="nl">
<head><title>Wald</title></head>
<body><h1>hi</h1></body>
</html>`
    const output = compile(source, '/src/page.wald')
    expect(output).toContain('<!DOCTYPE html>')
    expect(output).not.toContain('< DOCTYPE')
    expect(output).not.toContain('</>')
  })
})

describe('compile — type Props inference', () => {
  it('compiles a .wald file with type Props to typed createTree output', () => {
    const source = `---
type Props = { title: string }
const { title } = $props
---
<h1>{title}</h1>`

    const output = compile(source, '/src/page.wald')

    expect(output).toContain('type Props = { title: string }')
    expect(output).toContain('createTree<Props>')
    expect(output).toContain('$$props: Props')
    expect(output).toContain('const $props = $$props')
    expect(output).toContain('const { title } = $props')
    expect(output.indexOf('const $props = $$props'))
      .toBeLessThan(output.indexOf('const { title } = $props'))
  })

  it('compiles a .wald file with multi-line type Props', () => {
    const source = `---
type Props = {
  title: string
  count?: number
}
---
<h1>{title}</h1>`

    const output = compile(source, '/src/page.wald')

    expect(output).toContain('type Props = {')
    expect(output).toContain('createTree<Props>')
    expect(output).toContain('$$props: Props')
  })

  it('does not change output for .wald files without type Props', () => {
    const source = `---
const title = "Hello"
---
<h1>{title}</h1>`

    const output = compile(source, '/src/page.wald')

    expect(output).toContain('createTree(async ($$result, $$props)')
    expect(output).not.toContain('createTree<Props>')
    expect(output).not.toContain('const $props = $$props')
  })
})

describe('compileWithMap', () => {
  it('returns code identical to compile plus a line map', () => {
    const source = `---
type Props = { title: string }
const { title } = $props
---
<h1>{title}</h1>`
    const result = compileWithMap(source, '/src/page.wald')
    expect(result.code).toBe(compile(source, '/src/page.wald'))
    expect(result.lineMap.length).toBe(result.code.split('\n').length)
  })

  it('maps a body line back to its .wald source line', () => {
    const source = `---
type Props = { title: string }
const { title } = $props
---
<h1>{title}</h1>`
    const { code, lineMap } = compileWithMap(source, '/src/page.wald')
    const lines = code.split('\n')
    const idx = lines.findIndex(l => l.includes('const { title } = $props'))
    expect(lineMap[idx]).toBe(3)
  })

  it('sets file on WaldError like compile does', () => {
    let caught: unknown
    try {
      compileWithMap('---\n---\n{unclosed', '/src/page.wald')
    } catch (e) {
      caught = e
    }
    expect((caught as { file?: string }).file).toBe('/src/page.wald')
  })
})
