import { describe, it, expect } from 'vitest'
import { describeError, renderErrorPage } from './error-page.js'

describe('renderErrorPage', () => {
  it('includes the error message', () => {
    const html = renderErrorPage(new Error('Something broke'))
    expect(html).toContain('Something broke')
  })

  it('includes the stack trace', () => {
    const error = new Error('boom')
    error.stack = 'Error: boom\n    at renderPage (/project/src/pages/index.wald:3:1)'
    const html = renderErrorPage(error)
    expect(html).toContain('at renderPage (/project/src/pages/index.wald:3:1)')
  })

  it('HTML-escapes the message so it cannot inject markup', () => {
    const html = renderErrorPage(new Error('<script>alert(1)</script>'))
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('shows the file location when the error has a loc', () => {
    const error = Object.assign(new Error('Unexpected token'), {
      loc: { file: '/project/src/pages/index.wald', line: 5, column: 3 },
    })
    const html = renderErrorPage(error)
    expect(html).toContain('/project/src/pages/index.wald')
    expect(html).toContain('5')
    expect(html).toContain('3')
  })

  it('shows the code frame when the error has one', () => {
    const error = Object.assign(new Error('Unexpected token'), {
      frame: '1 | ---\n2 | ---\n3 | <h1>{unclosed</h1>\n    ^',
    })
    const html = renderErrorPage(error)
    expect(html).toContain('unclosed')
  })

  it('produces a full HTML document with a head', () => {
    const html = renderErrorPage(new Error('boom'))
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</head>')
  })
})

// Vite hands plugin errors (this.error({ message, loc })) to wald grow as plain
// objects without a stack, which used to be logged as "[object Object]".
describe('describeError', () => {
  it('uses the stack of a real Error', () => {
    const e = new Error('boom')
    expect(describeError(e)).toBe(e.stack)
  })

  it('uses message, location and frame of a plain error object', () => {
    expect(describeError({ message: '[waldjs] Expected "as"', loc: { file: '/p/index.wald', line: 3, column: 5 }, frame: '> 3 | import {' }))
      .toBe('[waldjs] Expected "as"\n  at /p/index.wald:3:5\n> 3 | import {')
  })

  it('never prints [object Object]', () => {
    expect(describeError({ foo: 1 })).not.toContain('[object Object]')
    expect(describeError('plain string')).toBe('plain string')
  })
})
