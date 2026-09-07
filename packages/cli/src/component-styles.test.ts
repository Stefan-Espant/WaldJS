import { describe, expect, it } from 'vitest'
import { injectComponentStyles, needsComponentStyles } from './component-styles.js'

describe('needsComponentStyles', () => {
  it('returns true when the html contains a data-wald-<hash> scope attribute', () => {
    expect(needsComponentStyles('<div class="card" data-wald-ab12cd34>Hi</div>')).toBe(true)
  })

  it('returns false for html with no scope attribute', () => {
    expect(needsComponentStyles('<div class="card">Hi</div>')).toBe(false)
  })
})

describe('injectComponentStyles', () => {
  it('inserts a stylesheet link before </head> when the page uses a styled component', () => {
    const html = '<html><head><title>x</title></head><body><div data-wald-ab12cd34>Hi</div></body></html>'
    const result = injectComponentStyles(html)
    expect(result).toContain('<link rel="stylesheet" href="/assets/wald-components.css">')
    expect(result.indexOf('<link')).toBeGreaterThan(result.indexOf('<title>'))
    expect(result.indexOf('<link')).toBeLessThan(result.indexOf('</head>'))
  })

  it('leaves html without any styled component completely unchanged', () => {
    const html = '<html><head></head><body><div>Hi</div></body></html>'
    expect(injectComponentStyles(html)).toBe(html)
  })
})
