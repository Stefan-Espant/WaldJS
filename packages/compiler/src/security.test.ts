import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import * as runtime from '@waldjs/runtime'
import { compile } from './compile.js'

async function render(source: string, props: Record<string, unknown>): Promise<string> {
  const code = ts.transpileModule(compile(source, 'security.wald'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports: { default?: runtime.Tree } = {}
  new Function('require', 'exports', code)(() => runtime, exports)
  return exports.default!.render(props)
}

describe('canopy props HTML escaping', () => {
  it.each(['load', 'idle', 'visible'])('escapes serialized props with the %s strategy', async (strategy) => {
    const payload = `' onmouseover='alert(1)'><img src=x onerror=alert(1)>&quot;`
    const html = await render(`---
const Widget = { render: async () => '<b>Widget</b>' }
---
<Widget canopy:${strategy} value={$$props.value} />`, { value: payload })
    expect(html).not.toContain('<img')
    expect(html).not.toContain("' onmouseover=")
    expect(html).toContain('&#39;')
    expect(html).toContain('&amp;quot;')
    expect(html).toContain('<b>Widget</b></wald-canopy>')
    const encoded = html.match(/data-props='([^']*)'/)?.[1]
    expect(encoded).toBeDefined()
    const decoded = encoded!.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    expect(JSON.parse(decoded)).toEqual({ value: payload })
  })
})
