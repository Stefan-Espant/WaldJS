import { describe, it, expect } from 'vitest'
import { createTree, renderTemplate, SafeHtml } from './index.js'

describe('renderTemplate', () => {
  it('interpolates a string value', () => {
    const title = 'Hello Wald'
    const result = renderTemplate`<h1>${title}</h1>`
    expect(result).toBe('<h1>Hello Wald</h1>')
  })

  it('escapes & in expressions', () => {
    const value = 'AT&T'
    const result = renderTemplate`<p>${value}</p>`
    expect(result).toBe('<p>AT&amp;T</p>')
  })

  it('escapes < and > in expressions', () => {
    const value = '<script>alert(1)</script>'
    const result = renderTemplate`<div>${value}</div>`
    expect(result).toBe('<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>')
  })

  it('escapes " in expressions', () => {
    const value = 'say "hello"'
    const result = renderTemplate`<p>${value}</p>`
    expect(result).toBe('<p>say &quot;hello&quot;</p>')
  })

  it('renders null as empty string', () => {
    const value = null
    const result = renderTemplate`<p>${value}</p>`
    expect(result).toBe('<p></p>')
  })

  it('renders undefined as empty string', () => {
    const value = undefined
    const result = renderTemplate`<p>${value}</p>`
    expect(result).toBe('<p></p>')
  })
})

describe('createTree', () => {
  it('returns an object with a render function', () => {
    const tree = createTree(async () => 'html')
    expect(typeof tree.render).toBe('function')
  })

  it('render() calls the provided function and returns the result', async () => {
    const tree = createTree(async () => '<h1>Hello</h1>')
    const result = await tree.render()
    expect(result).toBe('<h1>Hello</h1>')
  })

  it('render() passes props to the template function', async () => {
    const tree = createTree(async (_result, props) => {
      return renderTemplate`<h1>${props['name']}</h1>`
    })
    const html = await tree.render({ name: 'Wald' })
    expect(html).toBe('<h1>Wald</h1>')
  })

  it('accepts a typed TProps generic and passes typed props to the function', async () => {
    type Props = { greeting: string; count: number }
    const tree = createTree<Props>(async (_result, props) => {
      return renderTemplate`${props.greeting} ${props.count}`
    })
    const html = await tree.render({ greeting: 'hello', count: 42 })
    expect(html).toBe('hello 42')
  })

  it('defaults to Record<string, unknown> when no generic is provided', async () => {
    const tree = createTree(async (_result, props) => {
      return renderTemplate`${props['name']}`
    })
    const html = await tree.render({ name: 'Wald' })
    expect(html).toBe('Wald')
  })
})

describe('SafeHtml', () => {
  it('renderTemplate inserts SafeHtml without escaping', () => {
    const result = renderTemplate`<div>${new SafeHtml('<b>bold</b>')}</div>`
    expect(result).toBe('<div><b>bold</b></div>')
  })

  it('renderTemplate still escapes plain strings alongside SafeHtml', () => {
    const result = renderTemplate`${new SafeHtml('<b>safe</b>')} ${'<bad>'}`
    expect(result).toBe('<b>safe</b> &lt;bad&gt;')
  })
})
