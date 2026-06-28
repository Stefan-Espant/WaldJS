import { describe, it, expect } from 'vitest'
import { wrapHtml } from './shell.js'

describe('wrapHtml', () => {
  it('wraps content in a full HTML document', () => {
    const html = wrapHtml('<h1>Hello</h1>')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<h1>Hello</h1>')
    expect(html).toContain('</html>')
  })
})
