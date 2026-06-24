import { describe, it, expect } from 'vitest'
import { compile } from './compile.js'

describe('compile', () => {
  it('returns a JS module string from a .wald source', () => {
    const source = `---
const title = "Hello Wald"
---
<h1>{title}</h1>`

    const output = compile(source, '/src/index.wald')

    expect(output).toContain("import { createTree, renderTemplate } from '@waldjs/runtime'")
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
