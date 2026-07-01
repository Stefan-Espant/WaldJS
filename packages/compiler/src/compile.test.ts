import { describe, it, expect } from 'vitest'
import { compile } from './compile.js'
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
