import { describe, it, expect } from 'vitest'
import { maybeWrap, hoistScripts } from './shell.js'

describe('maybeWrap', () => {
  it('wraps content that has no doctype', () => {
    const result = maybeWrap('<h1>Hello</h1>')
    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('<h1>Hello</h1>')
  })

  it('passes through content that starts with <!DOCTYPE', () => {
    const full = '<!DOCTYPE html><html><body>Hi</body></html>'
    expect(maybeWrap(full)).toBe(full)
  })

  it('passes through content that starts with <html', () => {
    const full = '<html><body>Hi</body></html>'
    expect(maybeWrap(full)).toBe(full)
  })

  it('handles leading whitespace before <!DOCTYPE', () => {
    const full = '\n<!DOCTYPE html><html><body>Hi</body></html>'
    expect(maybeWrap(full)).toBe(full)
  })
})

describe('hoistScripts', () => {
  it('returns html unchanged when no scripts present', () => {
    const html = '<html><body><h1>Hello</h1></body></html>'
    expect(hoistScripts(html)).toBe(html)
  })

  it('moves inline script to before </body>', () => {
    const html = '<html><body><h1>Hi</h1><script>alert(1)</script></body></html>'
    const result = hoistScripts(html)
    expect(result).toBe('<html><body><h1>Hi</h1><script>alert(1)</script>\n</body></html>')
  })

  it('deduplicates identical scripts', () => {
    const s = '<script>alert(1)</script>'
    const html = `<html><body>${s}${s}</body></html>`
    const result = hoistScripts(html)
    expect((result.match(/<script>/g) ?? []).length).toBe(1)
  })

  it('preserves two distinct scripts', () => {
    const html = '<html><body><script>a()</script><script>b()</script></body></html>'
    const result = hoistScripts(html)
    expect(result).toContain('a()')
    expect(result).toContain('b()')
    expect((result.match(/<script>/g) ?? []).length).toBe(2)
  })

  describe('data-wald-no-hoist', () => {
    it('still hoists a script without the attribute', () => {
      const html = '<html><body><h1>Hi</h1><script>alert(1)</script></body></html>'
      const result = hoistScripts(html)
      expect(result).toBe('<html><body><h1>Hi</h1><script>alert(1)</script>\n</body></html>')
    })

    it('leaves a marked script exactly where it is', () => {
      const html =
        '<html><head><script data-wald-no-hoist>early()</script><link rel="stylesheet" href="/a.css"></head><body><h1>Hi</h1></body></html>'
      expect(hoistScripts(html)).toBe(html)
    })

    it('does not duplicate a marked script into the hoisted block', () => {
      const html =
        '<html><head><script data-wald-no-hoist>early()</script></head><body><script>late()</script></body></html>'
      const result = hoistScripts(html)
      expect((result.match(/early\(\)/g) ?? []).length).toBe(1)
      expect(result.indexOf('early()')).toBeLessThan(result.indexOf('<body>'))
    })

    it('handles a mix: marked stays, unmarked hoist and dedupe', () => {
      const late = '<script>late()</script>'
      const html = `<html><head><script data-wald-no-hoist>early()</script></head><body>${late}<p>x</p>${late}</body></html>`
      const result = hoistScripts(html)
      // marked script untouched in head
      expect(result.indexOf('early()')).toBeLessThan(result.indexOf('<body>'))
      // unmarked script hoisted after the paragraph, deduplicated
      expect((result.match(/late\(\)/g) ?? []).length).toBe(1)
      expect(result.indexOf('<p>x</p>')).toBeLessThan(result.indexOf('late()'))
    })

    it('works with the attribute set to a value', () => {
      const html =
        '<html><head><script data-wald-no-hoist="true">early()</script></head><body><h1>Hi</h1></body></html>'
      expect(hoistScripts(html)).toBe(html)
    })

    it('works regardless of other attributes and ordering', () => {
      const before =
        '<html><head><script data-wald-no-hoist type="text/javascript">a()</script><script type="module" data-wald-no-hoist>b()</script></head><body><h1>Hi</h1></body></html>'
      expect(hoistScripts(before)).toBe(before)
    })

    it('does not treat a similarly-named attribute as an exemption', () => {
      const html =
        '<html><body><script data-wald-no-hoist-x="1">a()</script></body></html>'
      const result = hoistScripts(html)
      expect(result).toBe('<html><body><script data-wald-no-hoist-x="1">a()</script>\n</body></html>')
    })
  })
})
