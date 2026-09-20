import { describe, expect, it } from 'vitest'
import { injectPrefetchRuntime, needsPrefetchRuntime } from './prefetch-runtime.js'

describe('needsPrefetchRuntime', () => {
  it('returns true when the html contains a wald:prefetch attribute', () => {
    expect(needsPrefetchRuntime('<a href="/about" wald:prefetch="hover">About</a>')).toBe(true)
  })

  it('returns false for html with no wald:prefetch usage', () => {
    expect(needsPrefetchRuntime('<a href="/about">About</a>')).toBe(false)
  })
})

describe('injectPrefetchRuntime', () => {
  it('injects a script tag before </body> when the page uses wald:prefetch', () => {
    const html = '<html><body><a href="/about" wald:prefetch="hover">About</a></body></html>'
    const result = injectPrefetchRuntime(html)
    expect(result).toContain('<script>')
    expect(result.indexOf('<script>')).toBeGreaterThan(result.indexOf('</a>'))
    expect(result.indexOf('<script>')).toBeLessThan(result.indexOf('</body>'))
  })

  it('leaves html without wald:prefetch usage completely unchanged', () => {
    const html = '<html><body><a href="/about">About</a></body></html>'
    expect(injectPrefetchRuntime(html)).toBe(html)
  })

  it('embeds the real prefetch runtime logic, not a placeholder', () => {
    const html = '<a href="/x" wald:prefetch="visible">x</a>'
    const result = injectPrefetchRuntime(html)
    expect(result).toContain('IntersectionObserver')
    expect(result).toContain("wald:prefetch")
  })
})
