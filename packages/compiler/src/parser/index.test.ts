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

describe('parse — styles', () => {
  it('lifts a <style> block out of the template into doc.styles', () => {
    const doc = parse('<style>.a { color: red }</style><h1>Hi</h1>')
    expect(doc.styles).toBe('.a { color: red }')
    expect(doc.template).toEqual([{ type: 'element', tag: 'h1', attrs: [], children: [{ type: 'text', value: 'Hi' }] }])
  })

  it('sets styles to null when there is no <style> block', () => {
    const doc = parse('<h1>Hi</h1>')
    expect(doc.styles).toBeNull()
  })

  it('throws when a file has more than one <style> block', () => {
    expect(() => parse('<style>.a{color:red}</style><style>.b{color:blue}</style>')).toThrow(
      'A .wald file can only have one <style> block',
    )
  })

  it('lifts a <style> block nested inside an element', () => {
    const doc = parse('<div><style>.a{color:red}</style><p>Hi</p></div>')
    expect(doc.styles).toBe('.a{color:red}')
    expect(doc.template).toEqual([{
      type: 'element',
      tag: 'div',
      attrs: [],
      children: [{ type: 'element', tag: 'p', attrs: [], children: [{ type: 'text', value: 'Hi' }] }],
    }])
  })
})
