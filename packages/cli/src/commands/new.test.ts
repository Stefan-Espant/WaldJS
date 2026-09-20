import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { componentTemplate, pageTemplate, componentPath, pagePath, writeGenerated } from './new.js'

describe('componentTemplate', () => {
  it('scaffolds a minimal component tagged with its own name', () => {
    const content = componentTemplate('Foo')
    expect(content).toContain('Foo')
    expect(content).toContain('---')
  })

  it('hints at declaring typed props', () => {
    const content = componentTemplate('Foo')
    expect(content).toContain('type Props')
  })
})

describe('pageTemplate', () => {
  it('scaffolds a static page with a title derived from the route', () => {
    const content = pageTemplate('about')
    expect(content).toContain("const title = 'About'")
    expect(content).toContain('{title}')
  })

  it('title-cases multi-word static routes', () => {
    const content = pageTemplate('contact-us')
    expect(content).toContain("const title = 'Contact Us'")
  })

  it('scaffolds a dynamic route with a typed Props and getStaticPaths stub', () => {
    const content = pageTemplate('blog/[slug]')
    expect(content).toContain('type Props = { slug: string }')
    expect(content).toContain('export async function getStaticPaths()')
    expect(content).toContain('$$props.slug')
  })

  it('handles multiple dynamic segments in one route', () => {
    const content = pageTemplate('shop/[category]/[id]')
    expect(content).toContain('type Props = { category: string; id: string }')
  })
})

describe('componentPath / pagePath', () => {
  it('resolves a component name to src/components/<Name>.wald', () => {
    expect(componentPath('/project', 'Foo')).toBe(join('/project', 'src', 'components', 'Foo.wald'))
  })

  it('resolves a route to src/pages/<route>.wald', () => {
    expect(pagePath('/project', 'blog/[slug]')).toBe(join('/project', 'src', 'pages', 'blog', '[slug].wald'))
  })
})

describe('writeGenerated', () => {
  let dir: string

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('creates parent directories and writes the file', () => {
    dir = mkdtempSync(join(tmpdir(), 'wald-new-'))
    const target = join(dir, 'src', 'components', 'Foo.wald')
    writeGenerated(target, '---\n---\n<div>Foo</div>\n')
    expect(existsSync(target)).toBe(true)
    expect(readFileSync(target, 'utf8')).toContain('Foo')
  })

  it('throws a clear error instead of overwriting an existing file', () => {
    dir = mkdtempSync(join(tmpdir(), 'wald-new-'))
    const target = join(dir, 'src', 'components', 'Foo.wald')
    writeGenerated(target, 'first')
    expect(() => writeGenerated(target, 'second')).toThrow(/already exists/i)
    expect(readFileSync(target, 'utf8')).toBe('first')
  })
})
