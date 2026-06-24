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
