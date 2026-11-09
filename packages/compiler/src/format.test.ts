import { describe, expect, it } from 'vitest'
import { format } from './format.js'

describe('format', () => {
  it('formats frontmatter and nested template blocks', () => {
    const source = `\n---\n\nconst title = 'Hello'   \n\n---\n<div><section><h1>{ title }</h1><p>Welcome</p></section></div>`

    expect(format(source)).toBe(`---
const title = 'Hello'
---
<div>
  <section>
    <h1>{title}</h1>
    <p>Welcome</p>
  </section>
</div>
`)
  })

  it('keeps inline content together so formatting does not insert visible spaces', () => {
    expect(format('<p>Hello <strong>beautiful</strong> world.</p>')).toBe(
      '<p>Hello <strong>beautiful</strong> world.</p>\n',
    )
    expect(format('<span>one</span><span>two</span>')).toBe(
      '<span>one</span><span>two</span>\n',
    )
    expect(format('<span>one</span> <span>two</span>')).toBe(
      '<span>one</span> <span>two</span>\n',
    )
    expect(format('<p>Hello<!-- emphasis boundary -->world</p>')).toBe(
      '<p>Hello<!-- emphasis boundary -->world</p>\n',
    )
  })

  it('normalizes tag whitespace without changing attribute kinds or values', () => {
    expect(format(`<Widget  empty=""  enabled value = { foo({ x: 1 }) } canopy:load />`)).toBe(
      `<Widget empty="" enabled value={ foo({ x: 1 }) } canopy:load />\n`,
    )
  })

  it('preserves raw element contents', () => {
    const source = '<div><script>\nconst message = `  keep me  `\n</script><pre>  exact\n text</pre></div>'
    expect(format(source)).toBe(
      '<div>\n  <script>\nconst message = `  keep me  `\n</script>\n  <pre>  exact\n text</pre>\n</div>\n',
    )
  })

  it('preserves comments and formats components as blocks', () => {
    expect(format('<main><!-- hello --><Card><p>Text</p></Card></main>')).toBe(
      '<main>\n  <!-- hello -->\n  <Card>\n    <p>Text</p>\n  </Card>\n</main>\n',
    )
  })

  it('supports tabs and custom indentation widths', () => {
    expect(format('<div><section><p>x</p></section></div>', { useTabs: true })).toContain('\n\t<section>')
    expect(format('<div><section><p>x</p></section></div>', { indentWidth: 4 })).toContain('\n    <section>')
  })

  it('is idempotent', () => {
    const source = `---\nconst x = 1\n---\n<div>\n <section><p>Hello <b>{ x }</b></p></section>\n</div>`
    const once = format(source)
    expect(format(once)).toBe(once)
  })
})

describe('HTML line wrapping', () => {
  it('wraps long tags one attribute per line', () => {
    const source = '<Layout title="WaldJS — a fast content-first static site generator" description="A readable description of the website" canonicalPath="/"><Hero /></Layout>'
    const result = format(source)
    expect(result).toContain('<Layout\n  title="WaldJS — a fast content-first static site generator"\n  description="A readable description of the website"\n  canonicalPath="/"\n>')
    expect(format(result)).toBe(result)
  })

  it('splits long inline groups only where a space already exists', () => {
    const source = '<div class="cta"><a class="btn" href="#quickstart">Get started with WaldJS today</a> <a class="btn ghost" href="https://github.com/Stefan-Espant/WaldJS/" target="_blank" rel="noopener">View the project on GitHub</a></div>'
    const result = format(source)
    expect(result).toContain('<div class="cta">\n')
    expect(result).toContain('</a>\n  <a\n')
    expect(result).toContain('  <a class="btn" href="#quickstart">Get started with WaldJS today</a>\n')
    expect(format(result)).toBe(result)
  })

  it('preserves adjacency between inline elements and mixed text', () => {
    const source = '<p>before<span class="first-item-long-name">one</span><span class="second-item-long-name">two</span>after</p>'
    const result = format(source)
    expect(result).toContain('</span><span')
    expect(result).toContain('before<span')
    expect(result).toContain('</span>after')
    expect(format(result)).toBe(result)
  })

  it('keeps whitespace inside quoted attributes and expression values unchanged', () => {
    const source = '<Widget description="a very long title with  double spaces and > signs" value={select({ value: "  unchanged  ", other: 1 })} enabled empty="" />'
    const result = format(source)
    expect(result).toContain('description="a very long title with  double spaces and > signs"')
    expect(result).toContain('value={select({ value: "  unchanged  ", other: 1 })}')
    expect(result).toContain('  enabled\n  empty=""\n/>')
    expect(format(result)).toBe(result)
  })

  it('supports a configurable print width and indentation', () => {
    const source = '<main><Card title="Hello world" description="A short description" /></main>'
    const result = format(source, { printWidth: 45, indentWidth: 4 })
    expect(result).toContain('    <Card\n        title="Hello world"\n        description="A short description"\n    />')
    expect(format(result, { printWidth: 45, indentWidth: 4 })).toBe(result)
  })
})


it('wraps long link captions at existing word spaces while keeping edge spaces', () => {
  const source = '<p>before<a href="/example"> A long caption with several readable words </a>after</p>'
  const result = format(source, { printWidth: 45 })
  expect(result).toContain('before<a href="/example"> A long caption')
  expect(result).toContain('with\n    several readable words </a>after')
  expect(format(result, { printWidth: 45 })).toBe(result)
})
