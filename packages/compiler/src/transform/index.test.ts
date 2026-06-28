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

    expect(output).toContain("import { createTree, renderTemplate, SafeHtml } from '@waldjs/runtime'")
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

  it('renders a ComponentNode via SafeHtml', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{ type: 'component', name: 'Button', attrs: [], children: [] }],
    }

    const output = transform(ast)
    expect(output).toContain('SafeHtml')
    expect(output).toContain('await Button.render(')
  })

  it('hoists export function to module level before export default', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: {
        type: 'frontmatter',
        code: 'export async function getStaticPaths() {\n  return [{ params: { slug: "hello" } }]\n}\nconst x = 1',
      },
      template: [],
    }
    const output = transform(ast)
    const exportFnPos = output.indexOf('export async function getStaticPaths')
    const exportDefaultPos = output.indexOf('export default createTree')
    expect(exportFnPos).toBeGreaterThanOrEqual(0)
    expect(exportFnPos).toBeLessThan(exportDefaultPos)
  })

  it('keeps non-export statements inside the createTree callback', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: {
        type: 'frontmatter',
        code: 'export async function getStaticPaths() {\n  return []\n}\nconst x = 1',
      },
      template: [],
    }
    const output = transform(ast)
    const exportDefaultPos = output.indexOf('export default createTree')
    const constXPos = output.indexOf('const x = 1')
    expect(constXPos).toBeGreaterThan(exportDefaultPos)
  })

  it('hoists import statements to module level before export default', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: {
        type: 'frontmatter',
        code: "import { getCollection } from 'wald:content'\nconst posts = await getCollection('blog')",
      },
      template: [],
    }
    const output = transform(ast)
    const importPos = output.indexOf("import { getCollection } from 'wald:content'")
    const exportDefaultPos = output.indexOf('export default createTree')
    expect(importPos).toBeGreaterThanOrEqual(0)
    expect(importPos).toBeLessThan(exportDefaultPos)
    // the await call stays inside the callback
    const postsPos = output.indexOf("const posts = await getCollection('blog')")
    expect(postsPos).toBeGreaterThan(exportDefaultPos)
  })
})

import { compile } from '../index.js'

describe('component rendering', () => {
  it('renders a self-closing component with string props', () => {
    const source = `---\nimport Card from './Card.wald'\n---\n<Card title="Hoi" />`
    const result = compile(source, 'test.wald')
    expect(result).toContain('SafeHtml')
    expect(result).toContain('await Card.render(')
    expect(result).toContain('title: "Hoi"')
  })

  it('renders a component with expression props', () => {
    const source = `---\nimport Card from './Card.wald'\nconst t = 'test'\n---\n<Card title={t} />`
    const result = compile(source, 'test.wald')
    expect(result).toContain('title: (t)')
  })

  it('renders a layout component with children as pond', () => {
    const source = `---\nimport Layout from './Layout.wald'\n---\n<Layout title="Home"><h1>Content</h1></Layout>`
    const result = compile(source, 'test.wald')
    expect(result).toContain('pond:')
    expect(result).toContain('await Layout.render(')
    expect(result).toContain('<h1>Content</h1>')
  })
})
