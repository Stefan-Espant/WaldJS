import { describe, it, expect } from 'vitest'
import { transform } from './index.js'
import type { WaldDocument } from '../ast/types.js'

describe('transform', () => {
  it('generates a valid JS module string', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: 'const title = "Hello Wald"' },
      template: [{
        type: 'element',
        tag: 'h1',
        attrs: [],
        children: [{ type: 'expression', code: 'title' }],
      }],
    }

    const output = transform(ast)

    expect(output).toContain("import { createTree, renderTemplate } from '@waldjs/runtime'")
    expect(output).toContain('export default createTree')
    expect(output).toContain('const title = "Hello Wald"')
    expect(output).toContain('renderTemplate`<h1>${title}</h1>`')
  })

  it('emits text nodes as-is in the template literal', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{ type: 'text', value: 'Hello world' }],
    }

    const output = transform(ast)
    expect(output).toContain('renderTemplate`Hello world`')
  })

  it('escapes backticks in text nodes', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{ type: 'text', value: 'Hello `world`' }],
    }

    const output = transform(ast)
    expect(output).toContain('Hello \\`world\\`')
  })

  it('handles element with string attribute', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{
        type: 'element',
        tag: 'h1',
        attrs: [{ type: 'attribute', name: 'class', value: 'title' }],
        children: [],
      }],
    }

    const output = transform(ast)
    expect(output).toContain('<h1 class="title"></h1>')
  })

  it('handles element with expression attribute', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{
        type: 'element',
        tag: 'div',
        attrs: [{ type: 'attribute', name: 'class', value: { type: 'expression', code: 'styles' } }],
        children: [],
      }],
    }

    const output = transform(ast)
    expect(output).toContain('class="${styles}"')
  })

  it('skips ComponentNode in Phase 0', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{ type: 'component', name: 'Button', attrs: [], children: [] }],
    }

    const output = transform(ast)
    expect(output).toContain('renderTemplate``')
  })
})
