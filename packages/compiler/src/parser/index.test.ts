import { describe, it, expect } from 'vitest'
import { parse } from './index.js'

describe('parse', () => {
  it('parses a .wald file with frontmatter and template', () => {
    const source = `---
const title = "Hello Wald"
---
<h1>{title}</h1>`

    const doc = parse(source)

    expect(doc.type).toBe('document')
    expect(doc.frontmatter.type).toBe('frontmatter')
    expect(doc.frontmatter.code).toBe('const title = "Hello Wald"')
    expect(doc.frontmatter.line).toBe(2)
    expect(doc.template).toEqual([{
      type: 'element',
      tag: 'h1',
      attrs: [],
      children: [{ type: 'expression', code: 'title' }],
    }])
  })

  it('parses a .wald file without frontmatter', () => {
    const source = '<p>Hello</p>'
    const doc = parse(source)

    expect(doc.frontmatter.code).toBe('')
    expect(doc.template).toEqual([{
      type: 'element',
      tag: 'p',
      attrs: [],
      children: [{ type: 'text', value: 'Hello' }],
    }])
  })

  it('parses multiple root elements', () => {
    const source = '<h1>Title</h1><p>Body</p>'
    const doc = parse(source)

    expect(doc.template).toHaveLength(2)
    expect(doc.template[0]).toMatchObject({ type: 'element', tag: 'h1' })
    expect(doc.template[1]).toMatchObject({ type: 'element', tag: 'p' })
  })
})
