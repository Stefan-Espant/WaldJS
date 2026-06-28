import { describe, it, expect } from 'vitest'
import { maybeWrap } from './shell.js'

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
