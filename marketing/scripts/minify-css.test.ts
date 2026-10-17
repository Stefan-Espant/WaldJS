import { describe, it, expect } from 'vitest'
import { minifyCss } from './minify-css.js'

// #86: the old minifier trimmed whitespace before every ':', which turned the
// descendant combinator in `.a :is(b)` into `.a:is(b)` — a different selector.
describe('minifyCss', () => {
  it('keeps the descendant combinator before a pseudo-class', () => {
    expect(minifyCss('.a :is(b, c) { color: red; }')).toBe('.a :is(b,c){color:red}')
  })

  it('keeps the descendant combinator before a pseudo-element', () => {
    expect(minifyCss('.a ::before { content: ""; }')).toBe('.a ::before{content:""}')
  })

  it('keeps compound pseudo-classes compound', () => {
    expect(minifyCss('.a:hover , .b:focus-visible { x: y }')).toBe('.a:hover,.b:focus-visible{x:y}')
  })

  it('trims whitespace around the colon in declarations', () => {
    expect(minifyCss('p { color : red ; margin :0 }')).toBe('p{color:red;margin:0}')
  })

  it('handles selectors inside at-rules', () => {
    expect(minifyCss('@media (max-width: 40rem) {\n  .nav :focus-visible { outline : none; }\n}'))
      .toBe('@media (max-width:40rem){.nav :focus-visible{outline:none}}')
  })

  it('leaves strings untouched, including ; { : inside them', () => {
    const css = `.x { background: url("data:image/svg+xml;utf8,<svg a='1 , 2'>{ b : c }</svg>") no-repeat; }`
    expect(minifyCss(css)).toBe(`.x{background:url("data:image/svg+xml;utf8,<svg a='1 , 2'>{ b : c }</svg>") no-repeat}`)
  })

  it('strips comments', () => {
    expect(minifyCss('/* hi */ a { /* there */ b: c }')).toBe('a{b:c}')
  })
})
