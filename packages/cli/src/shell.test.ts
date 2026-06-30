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
})
