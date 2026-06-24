import { describe, it, expect } from 'vitest'
import { parse, transform, compile } from './index.js'

describe('public API', () => {
  it('exports parse', () => {
    const doc = parse('<h1>Hello</h1>')
    expect(doc.type).toBe('document')
  })

  it('exports transform', () => {
    const doc = parse('<h1>Hello</h1>')
    const output = transform(doc)
    expect(output).toContain('createTree')
  })

  it('exports compile', () => {
    const output = compile('<h1>Hello</h1>', 'page.wald')
    expect(output).toContain('createTree')
  })
})
