import { describe, it, expect } from 'vitest'
import { scanTemplate } from './scanner.js'
import type { ScriptNode } from '../ast/types.js'
import { WaldError } from '../errors.js'

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

describe('scanTemplate — void elements', () => {
  it('parseert bare void elements zonder kinderen te slikken', () => {
    const nodes = scanTemplate('<head><meta charset="utf-8"><title>x</title></head>')
    const head = nodes[0] as { children: { type: string; tag?: string }[] }
    expect(head.children.map(c => (c as { tag?: string }).tag ?? c.type)).toEqual(['meta', 'title'])
  })

  it('behandelt componenten met void-namen niet als void', () => {
    const nodes = scanTemplate('<div><Link href="/about">About</Link><p>after</p></div>')
    const div = nodes[0] as { children: { type: string; name?: string; tag?: string }[] }
    expect(div.children.length).toBe(2)
    const link = div.children[0] as { type: string; name: string; children: unknown[] }
    expect(link.type).toBe('component')
    expect(link.name).toBe('Link')
    expect(link.children.length).toBe(1)
  })
})

describe('scanTemplate — script', () => {
  it('returns a ScriptNode for a <script> element', () => {
    const nodes = scanTemplate('<script>console.log("hi")</script>')
    expect(nodes).toEqual([{ type: 'script', content: '<script>console.log("hi")</script>' } satisfies ScriptNode])
  })

  it('treats { as raw text inside script, not an expression', () => {
    const nodes = scanTemplate('<script>const x = { a: 1 }</script>')
    expect(nodes).toEqual([{ type: 'script', content: '<script>const x = { a: 1 }</script>' }])
  })

  it('treats < as raw text inside script, not a tag', () => {
    const nodes = scanTemplate('<script>const ok = 1 < 2</script>')
    expect(nodes).toEqual([{ type: 'script', content: '<script>const ok = 1 < 2</script>' }])
  })

  it('handles script with type attribute', () => {
    const nodes = scanTemplate('<script type="module">export const x = 1</script>')
    expect(nodes).toEqual([{ type: 'script', content: '<script type="module">export const x = 1</script>' }])
  })
})

describe('scanTemplate — doctype en comments', () => {
  it('geeft <!DOCTYPE html> door als letterlijke tekst', () => {
    const nodes = scanTemplate('<!DOCTYPE html>\n<p>hi</p>')
    expect(nodes[0]).toEqual({ type: 'text', value: '<!DOCTYPE html>' })
  })

  it('geeft een HTML-comment door als letterlijke tekst', () => {
    const nodes = scanTemplate('<!-- logo klein --><p>hi</p>')
    expect(nodes[0]).toEqual({ type: 'text', value: '<!-- logo klein -->' })
  })

  it('parseert accolades binnen comments niet als expressies', () => {
    const nodes = scanTemplate('<!-- {geen expressie} -->')
    expect(nodes[0]).toEqual({ type: 'text', value: '<!-- {geen expressie} -->' })
  })

  it('comment met > erin eindigt pas bij -->', () => {
    const nodes = scanTemplate('<!-- a > b --><p>x</p>')
    expect(nodes[0]).toEqual({ type: 'text', value: '<!-- a > b -->' })
  })

  it('ongesloten comment loopt tot einde bron zonder crash', () => {
    const nodes = scanTemplate('<!-- nooit dicht')
    expect(nodes[0]).toEqual({ type: 'text', value: '<!-- nooit dicht' })
  })
})

describe('scanTemplate — errors', () => {
  it('throws WaldError for unclosed expression {', () => {
    expect(() => scanTemplate('{title')).toThrow(WaldError)
  })

  it('unclosed expression error points to the opening {', () => {
    let caught: WaldError | undefined
    try { scanTemplate('{title') } catch (e) { caught = e as WaldError }
    expect(caught?.message).toContain("Unclosed expression")
    expect(caught?.message).toContain("'}'")
    expect(caught?.line).toBe(1)
    expect(caught?.column).toBe(1)
  })

  it('unclosed expression on line 2 reports correct line', () => {
    let caught: WaldError | undefined
    try { scanTemplate('<p>ok</p>\n<h1>{oops') } catch (e) { caught = e as WaldError }
    expect(caught?.line).toBe(2)
    expect(caught?.column).toBe(5)
  })

  it('throws WaldError for unclosed string attribute', () => {
    expect(() => scanTemplate('<div class="oops')).toThrow(WaldError)
  })

  it('unclosed string attribute error points to the opening quote', () => {
    let caught: WaldError | undefined
    try { scanTemplate('<div class="oops') } catch (e) { caught = e as WaldError }
    expect(caught?.message).toContain("Unclosed string attribute")
    expect(caught?.message).toContain("'\"'")
    expect(caught?.line).toBe(1)
    expect(caught?.column).toBe(12)
  })

  it('throws WaldError for unclosed element tag', () => {
    expect(() => scanTemplate('<div')).toThrow(WaldError)
  })

  it('unclosed tag error includes the tag name and points to <', () => {
    let caught: WaldError | undefined
    try { scanTemplate('<div') } catch (e) { caught = e as WaldError }
    expect(caught?.message).toContain("<div>")
    expect(caught?.message).toContain("'>'")
    expect(caught?.line).toBe(1)
    expect(caught?.column).toBe(1)
  })

  it('unclosed tag on line 3 reports correct position', () => {
    let caught: WaldError | undefined
    try { scanTemplate('<p>ok</p>\n<span>ok</span>\n<section') } catch (e) { caught = e as WaldError }
    expect(caught?.line).toBe(3)
    expect(caught?.column).toBe(1)
  })
})
