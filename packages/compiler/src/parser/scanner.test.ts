import { describe, it, expect } from 'vitest'
import { scanTemplate } from './scanner.js'

describe('scanTemplate — text', () => {
  it('returns a TextNode for plain text', () => {
    const nodes = scanTemplate('Hello world')
    expect(nodes).toEqual([{ type: 'text', value: 'Hello world' }])
  })

  it('returns empty array for empty string', () => {
    expect(scanTemplate('')).toEqual([])
  })
})

describe('scanTemplate — expressions', () => {
  it('returns an ExpressionNode for {expr}', () => {
    const nodes = scanTemplate('{title}')
    expect(nodes).toEqual([{ type: 'expression', code: 'title' }])
  })

  it('handles expression with member access', () => {
    const nodes = scanTemplate('{user.name}')
    expect(nodes).toEqual([{ type: 'expression', code: 'user.name' }])
  })

  it('handles expression with method call', () => {
    const nodes = scanTemplate('{items.join(", ")}')
    expect(nodes).toEqual([{ type: 'expression', code: 'items.join(", ")' }])
  })

  it('handles nested braces in expression', () => {
    const nodes = scanTemplate('{a ? { x: 1 } : null}')
    expect(nodes).toEqual([{ type: 'expression', code: 'a ? { x: 1 } : null' }])
  })

  it('mixes text and expressions', () => {
    const nodes = scanTemplate('Hello {name}!')
    expect(nodes).toEqual([
      { type: 'text', value: 'Hello ' },
      { type: 'expression', code: 'name' },
      { type: 'text', value: '!' },
    ])
  })
})

describe('scanTemplate — elements', () => {
  it('returns an ElementNode for <h1>text</h1>', () => {
    const nodes = scanTemplate('<h1>Hello</h1>')
    expect(nodes).toEqual([{
      type: 'element',
      tag: 'h1',
      attrs: [],
      children: [{ type: 'text', value: 'Hello' }],
    }])
  })

  it('handles element with expression child', () => {
    const nodes = scanTemplate('<h1>{title}</h1>')
    expect(nodes).toEqual([{
      type: 'element',
      tag: 'h1',
      attrs: [],
      children: [{ type: 'expression', code: 'title' }],
    }])
  })

  it('handles nested elements', () => {
    const nodes = scanTemplate('<div><p>text</p></div>')
    expect(nodes).toEqual([{
      type: 'element',
      tag: 'div',
      attrs: [],
      children: [{
        type: 'element',
        tag: 'p',
        attrs: [],
        children: [{ type: 'text', value: 'text' }],
      }],
    }])
  })

  it('handles void elements', () => {
    const nodes = scanTemplate('<br />')
    expect(nodes).toEqual([{
      type: 'element',
      tag: 'br',
      attrs: [],
      children: [],
    }])
  })

  it('handles string attribute', () => {
    const nodes = scanTemplate('<h1 class="title">text</h1>')
    expect(nodes).toEqual([{
      type: 'element',
      tag: 'h1',
      attrs: [{ type: 'attribute', name: 'class', value: 'title' }],
      children: [{ type: 'text', value: 'text' }],
    }])
  })

  it('handles expression attribute', () => {
    const nodes = scanTemplate('<div class={styles}>text</div>')
    expect(nodes).toEqual([{
      type: 'element',
      tag: 'div',
      attrs: [{ type: 'attribute', name: 'class', value: { type: 'expression', code: 'styles' } }],
      children: [{ type: 'text', value: 'text' }],
    }])
  })

  it('detects ComponentNode by uppercase tag', () => {
    const nodes = scanTemplate('<Button />')
    expect(nodes).toEqual([{
      type: 'component',
      name: 'Button',
      attrs: [],
      children: [],
    }])
  })
})
