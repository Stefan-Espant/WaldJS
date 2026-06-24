import { describe, it, expect } from 'vitest'
import { compile } from '@waldjs/compiler'

describe('Phase 0 smoke test', () => {
  it('compiles a .wald file to a JS module string', () => {
    const source = `---
const title = "Hello Wald"
---
<h1>{title}</h1>`

    const output = compile(source, 'index.wald')

    expect(output).toContain("import { createTree, renderTemplate } from '@waldjs/runtime'")
    expect(output).toContain('export default createTree')
  })

  it('renders a compiled module end-to-end via data: import', async () => {
    const source = `---
const title = "Hello Wald"
---
<h1>{title}</h1>`

    const jsModule = compile(source, 'index.wald')

    const runtimePath = new URL('../../../packages/runtime/dist/index.js', import.meta.url).href
    const patchedModule = jsModule.replace("'@waldjs/runtime'", JSON.stringify(runtimePath))

    // Import the compiled module dynamically using a data: URL
    const mod = await import(`data:text/javascript,${encodeURIComponent(patchedModule)}`) as { default: { render: () => Promise<string> } }
    const html = await mod.default.render()

    expect(html).toContain('<h1>')
    expect(html).toContain('Hello Wald')
    expect(html).toContain('</h1>')
  })

  it('escapes HTML entities in expressions', async () => {
    const source = `---
const value = "<script>alert('xss')</script>"
---
<p>{value}</p>`

    const jsModule = compile(source, 'page.wald')

    const runtimePath = new URL('../../../packages/runtime/dist/index.js', import.meta.url).href
    const patchedModule = jsModule.replace("'@waldjs/runtime'", JSON.stringify(runtimePath))

    const mod = await import(`data:text/javascript,${encodeURIComponent(patchedModule)}`) as { default: { render: () => Promise<string> } }
    const html = await mod.default.render()

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
