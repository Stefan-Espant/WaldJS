import { describe, it, expect } from 'vitest'
import { scopeCss, scopeHash } from './scope-css.js'

describe('scopeHash', () => {
  it('is deterministic for the same file id', () => {
    expect(scopeHash('/src/components/Card.wald')).toBe(scopeHash('/src/components/Card.wald'))
  })

  it('differs between two different file ids', () => {
    expect(scopeHash('/src/components/Card.wald')).not.toBe(scopeHash('/src/components/Nav.wald'))
  })

  it('is 8 lowercase hex characters', () => {
    expect(scopeHash('/src/components/Card.wald')).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('scopeCss', () => {
  it('scopes a simple class selector', () => {
    expect(scopeCss('.card { color: red }', 'ab12cd34')).toBe('.card[data-wald-ab12cd34]{ color: red }')
  })

  it('scopes each selector in a comma-separated list independently', () => {
    expect(scopeCss('.a, .b { color: red }', 'ab12cd34')).toBe(
      '.a[data-wald-ab12cd34], .b[data-wald-ab12cd34]{ color: red }',
    )
  })

  it('scopes only the last compound segment of a descendant selector', () => {
    expect(scopeCss('.card .title { color: red }', 'ab12cd34')).toBe(
      '.card .title[data-wald-ab12cd34]{ color: red }',
    )
  })

  it('scopes only the last compound segment of a combinator selector', () => {
    expect(scopeCss('.card > .title { color: red }', 'ab12cd34')).toBe(
      '.card > .title[data-wald-ab12cd34]{ color: red }',
    )
  })

  it('inserts the scope attribute before a trailing pseudo-class', () => {
    expect(scopeCss('.card:hover { color: red }', 'ab12cd34')).toBe(
      '.card[data-wald-ab12cd34]:hover{ color: red }',
    )
  })

  it('inserts the scope attribute before a trailing pseudo-element', () => {
    expect(scopeCss('.card::before { content: "x" }', 'ab12cd34')).toBe(
      '.card[data-wald-ab12cd34]::before{ content: "x" }',
    )
  })

  it('inserts the scope attribute before a chain of pseudo-classes', () => {
    expect(scopeCss('.card:not(.x):hover { color: red }', 'ab12cd34')).toBe(
      '.card[data-wald-ab12cd34]:not(.x):hover{ color: red }',
    )
  })

  it('recurses into an @media block, leaving the condition untouched', () => {
    expect(scopeCss('@media (min-width: 600px) { .card { color: red } }', 'ab12cd34')).toBe(
      '@media (min-width: 600px) { .card[data-wald-ab12cd34]{ color: red } }',
    )
  })

  it('recurses into an @supports block', () => {
    expect(scopeCss('@supports (display: grid) { .card { display: grid } }', 'ab12cd34')).toBe(
      '@supports (display: grid) { .card[data-wald-ab12cd34]{ display: grid } }',
    )
  })

  it('scopes multiple rules inside the same @media block', () => {
    expect(
      scopeCss('@media (min-width: 600px) { .a { color: red } .b { color: blue } }', 'ab12cd34'),
    ).toBe('@media (min-width: 600px) { .a[data-wald-ab12cd34]{ color: red } .b[data-wald-ab12cd34]{ color: blue } }')
  })

  it('passes @keyframes through unscoped', () => {
    const css = '@keyframes fade { 0% { opacity: 0 } 100% { opacity: 1 } }'
    expect(scopeCss(css, 'ab12cd34')).toBe(css)
  })

  it('passes @font-face through unscoped', () => {
    const css = '@font-face { font-family: "X"; src: url(x.woff) }'
    expect(scopeCss(css, 'ab12cd34')).toBe(css)
  })

  it('passes a semicolon-terminated at-rule like @import through unscoped', () => {
    expect(scopeCss('@import url(x.css);\n.a { color: red }', 'ab12cd34')).toBe(
      '@import url(x.css);\n.a[data-wald-ab12cd34]{ color: red }',
    )
  })

  it('preserves comments verbatim', () => {
    expect(scopeCss('/* comment */ .card { color: red } /* trailing */', 'ab12cd34')).toBe(
      '/* comment */ .card[data-wald-ab12cd34]{ color: red } /* trailing */',
    )
  })

  it('does not crash or fabricate content on unbalanced braces', () => {
    expect(scopeCss('.a { color: red', 'ab12cd34')).toBe('.a { color: red')
  })

  it('does not split inside :is()/:where()/:not() when scoping a selector list', () => {
    expect(scopeCss('.card :is(.title, .subtitle) { color: red }', 'ab12cd34')).toBe(
      '.card :is(.title, .subtitle)[data-wald-ab12cd34]{ color: red }',
    )
  })

  it('recurses into an @container block', () => {
    expect(scopeCss('@container (min-width: 300px) { .card { color: red } }', 'ab12cd34')).toBe(
      '@container (min-width: 300px) { .card[data-wald-ab12cd34]{ color: red } }',
    )
  })
})
