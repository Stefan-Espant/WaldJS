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
