import { describe, it, expect } from 'vitest'
import { extractFrontmatter } from './frontmatter.js'

describe('extractFrontmatter', () => {
  it('extracts frontmatter code between --- delimiters', () => {
    const source = `---
const title = "Hello"
---
<h1>{title}</h1>`

    const result = extractFrontmatter(source)
    expect(result.code).toBe('const title = "Hello"')
    expect(result.rest).toBe('<h1>{title}</h1>')
  })

  it('returns empty code when no frontmatter present', () => {
    const source = '<h1>Hello</h1>'
    const result = extractFrontmatter(source)
    expect(result.code).toBe('')
    expect(result.rest).toBe('<h1>Hello</h1>')
  })

  it('handles multi-line frontmatter', () => {
    const source = `---
const title = "Hello"
const description = "World"
---
<p>{description}</p>`

    const result = extractFrontmatter(source)
    expect(result.code).toBe('const title = "Hello"\nconst description = "World"')
    expect(result.rest).toBe('<p>{description}</p>')
  })

  it('throws when closing --- is missing', () => {
    const source = `---
const title = "Hello"
<h1>{title}</h1>`

    expect(() => extractFrontmatter(source)).toThrow('Unclosed frontmatter block')
  })

  it('includes a line property on the thrown error for unclosed frontmatter', () => {
    const source = `---\nconst title = "Hello"\n<h1>{title}</h1>`
    let caught: unknown
    try {
      extractFrontmatter(source)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect(caught).toHaveProperty('line')
    expect(typeof (caught as { line: unknown }).line).toBe('number')
  })

  it('handles frontmatter with TypeScript', () => {
    const source = `---
const items: string[] = ['a', 'b']
---
<ul></ul>`

    const result = extractFrontmatter(source)
    expect(result.code).toBe("const items: string[] = ['a', 'b']")
  })
})
