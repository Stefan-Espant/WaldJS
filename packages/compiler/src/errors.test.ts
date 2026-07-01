import { describe, it, expect } from 'vitest'
import { WaldError, offsetToLineCol } from './errors.js'

describe('WaldError', () => {
  it('is an instance of Error', () => {
    const err = new WaldError('oops', 3, 7)
    expect(err).toBeInstanceOf(Error)
  })

  it('has name WaldError', () => {
    const err = new WaldError('oops', 3, 7)
    expect(err.name).toBe('WaldError')
  })

  it('exposes line and column', () => {
    const err = new WaldError('oops', 3, 7)
    expect(err.line).toBe(3)
    expect(err.column).toBe(7)
  })

  it('file is undefined by default', () => {
    const err = new WaldError('oops', 1, 1)
    expect(err.file).toBeUndefined()
  })

  it('file can be set after construction', () => {
    const err = new WaldError('oops', 1, 1)
    err.file = '/src/page.wald'
    expect(err.file).toBe('/src/page.wald')
  })
})

describe('offsetToLineCol', () => {
  it('returns line 1 column 1 for offset 0', () => {
    expect(offsetToLineCol('hello', 0)).toEqual({ line: 1, column: 1 })
  })

  it('returns line 1 column 4 for offset 3 on first line', () => {
    expect(offsetToLineCol('hello', 3)).toEqual({ line: 1, column: 4 })
  })

  it('returns line 2 column 1 for character after first newline', () => {
    expect(offsetToLineCol('line1\nline2', 6)).toEqual({ line: 2, column: 1 })
  })

  it('returns line 2 column 4 for offset into second line', () => {
    expect(offsetToLineCol('abc\ndef', 7)).toEqual({ line: 2, column: 4 })
  })

  it('handles offset at end of source', () => {
    const src = 'ab\ncd'
    expect(offsetToLineCol(src, src.length)).toEqual({ line: 2, column: 3 })
  })
})
