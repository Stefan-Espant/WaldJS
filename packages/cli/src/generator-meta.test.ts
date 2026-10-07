import { describe, it, expect } from 'vitest'
import { hasGeneratorMeta, injectGeneratorMeta } from './generator-meta.js'

const GEN = 'WaldJS v1.2.3'

describe('hasGeneratorMeta', () => {
  it.each([
    '<meta name="generator" content="Hugo">',
    "<meta name='generator' content='x'>",
    '<meta content="x" name="generator" />',
    '<META NAME=GENERATOR CONTENT=x>',
  ])('detects %s', (tag) => {
    expect(hasGeneratorMeta(`<head>${tag}</head>`)).toBe(true)
  })

  it('ignores other meta tags', () => {
    expect(hasGeneratorMeta('<head><meta name="generator-ish" content="x"><meta name="description" content="generator"></head>')).toBe(false)
  })
})

describe('injectGeneratorMeta', () => {
  it('inserts the tag right after the opening <head> tag', () => {
    expect(injectGeneratorMeta('<html><head><title>x</title></head></html>', GEN))
      .toBe('<html><head>\n<meta name="generator" content="WaldJS v1.2.3"><title>x</title></head></html>')
  })

  it('handles a <head> with attributes', () => {
    expect(injectGeneratorMeta('<head data-x="1"><title>x</title></head>', GEN))
      .toBe('<head data-x="1">\n<meta name="generator" content="WaldJS v1.2.3"><title>x</title></head>')
  })

  it('does not match <header>', () => {
    const html = '<body><header>x</header></body>'
    expect(injectGeneratorMeta(html, GEN)).toBe(html)
  })

  it('leaves pages that already declare a generator untouched', () => {
    const html = '<head><meta name="generator" content="WaldJS v0.11.0"></head>'
    expect(injectGeneratorMeta(html, GEN)).toBe(html)
  })

  it('escapes the generator value', () => {
    expect(injectGeneratorMeta('<head></head>', 'a"<b>')).toContain('content="a&quot;&lt;b&gt;"')
  })
})
