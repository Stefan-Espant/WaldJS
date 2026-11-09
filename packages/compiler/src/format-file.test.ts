import { describe, expect, it } from 'vitest'
import { format, formatFile } from './format.js'

const source = `---
const config={title:"Hello",items:[1,2,3]};
type Props={name:string};
---
<main><section><h1>{ config.title }</h1></section><style>.card{color:red;padding:0  1rem}@media(min-width:600px){.card{display:grid}}</style><script>const items=[1,2,3];function greet(name){return "Hi "+name;}console.log(items.map(greet));</script></main>`

describe('formatFile', () => {
  it('formats the HTML, CSS and JS/TS sections of a Wald component', async () => {
    const result = await formatFile(source, 'page.wald')
    expect(result).toContain("const config = { title: 'Hello', items: [1, 2, 3] }")
    expect(result).toContain('type Props = { name: string }')
    expect(result).toContain('  <section>\n    <h1>{config.title}</h1>\n  </section>')
    expect(result).toContain('  <style>\n    .card {\n      color: red;')
    expect(result).toContain('@media (min-width: 600px)')
    expect(result).toContain('  <script>\n    const items = [1, 2, 3]')
    expect(result).toContain('function greet(name) {')
    expect(await formatFile(result, 'page.wald')).toBe(result)
  })

  it('preserves multiline strings and template literal values while indenting scripts', async () => {
    const code = 'const message=`first\n  second\nthird`;globalThis.__formatterValue=message;'
    const result = await formatFile(`<main><section><script>${code}</script></section></main>`, 'page.wald')
    const script = result.match(/<script>([\s\S]*?)<\/script>/)![1]
    const read = (text: string) => new Function(text.replace('globalThis.__formatterValue = message', 'return message').replace('globalThis.__formatterValue=message', 'return message'))()
    expect(read(script)).toBe(read(code))
  })

  it('leaves whitespace-sensitive HTML and unknown script languages untouched', async () => {
    const source = '<main><pre>  exact\n text</pre><textarea>  keep\n this</textarea><script type="text/x-template">  {{value}}\n</script></main>'
    const result = await formatFile(source, 'page.wald')
    expect(result).toContain('<pre>  exact\n text</pre>')
    expect(result).toContain('<textarea>  keep\n this</textarea>')
    expect(result).toContain('<script type="text/x-template">  {{value}}\n</script>')
  })

  it('does not insert visible whitespace around scripts inside inline HTML', async () => {
    const result = await formatFile('<span>A<script>const x=1;</script>B</span>', 'page.wald')
    expect(result.replace(/<script>[\s\S]*?<\/script>/, '').trim()).toBe('<span>AB</span>')
    expect(await formatFile(result, 'page.wald')).toBe(result)
  })

  it('formats JSON data scripts and TypeScript scripts', async () => {
    const result = await formatFile('<script type="application/ld+json">{"name":"Wald","items":[1,2]}</script><script lang="ts">const count:number=1;</script>', 'page.wald')
    expect(result).toContain('"name": "Wald"')
    expect(result).toContain('const count: number = 1')
    expect(await formatFile(result, 'page.wald')).toBe(result)
  })

  it('accepts TypeScript in canopy scripts without a lang attribute', async () => {
    const result = await formatFile('<button>Go</button><script>export default function(root:HTMLElement){const count:number=1;root.textContent=String(count);}</script>', 'Counter.wald')
    expect(result).toContain('export default function (root: HTMLElement) {')
    expect(result).toContain('  const count: number = 1')
    expect(await formatFile(result, 'Counter.wald')).toBe(result)
  })

  it.each([
    ['page.html', '<main><section><p>Hello</p></section></main>', '\n  <section>'],
    ['site.css', '.card{color:red;padding:0  1rem}', '  color: red;'],
    ['site.js', 'const user={name:"Wald"};', "const user = { name: 'Wald' }"],
    ['site.mjs', 'export const sum=(a,b)=>a+b;', 'export const sum = (a, b) => a + b'],
    ['site.ts', 'type Props={name:string};', 'type Props = { name: string }'],
    ['Button.tsx', 'export const Button=()=> <button>Hi</button>;', 'export const Button = () => <button>Hi</button>'],
  ])('formats standalone %s files and is idempotent', async (filename, source, expected) => {
    const result = await formatFile(source, filename)
    expect(result).toContain(expected)
    expect(result.endsWith('\n')).toBe(true)
    expect(await formatFile(result, filename)).toBe(result)
  })

  it('supports custom indentation and tabs in embedded code', async () => {
    const source = '<main><style>.card{color:red}</style></main>'
    expect(await formatFile(source, 'page.wald', { indentWidth: 4 })).toContain('\n    <style>\n        .card {\n            color: red;')
    expect(await formatFile(source, 'page.wald', { useTabs: true })).toContain('\n\t<style>\n\t\t.card {\n\t\t\tcolor: red;')
  })

  it('rejects invalid embedded JavaScript and CSS and unsupported files', async () => {
    await expect(formatFile('<script>const = ;</script>', 'page.wald')).rejects.toThrow()
    await expect(formatFile('<style>.card{color:</style>', 'page.wald')).rejects.toThrow()
    await expect(formatFile('text', 'file.txt')).rejects.toThrow(/Unsupported formatter file/)
  })

  it('keeps the original synchronous formatter API available', () => {
    const result = format('<p>{ value }</p>')
    expect(typeof result).toBe('string')
    expect(result).toBe('<p>{value}</p>\n')
  })
})
