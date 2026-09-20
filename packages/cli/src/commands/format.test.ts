import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findWaldFiles, formatCommand, runFormat } from './format.js'

const roots: string[] = []

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'wald-format-'))
  roots.push(root)
  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, contents)
  }
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
  process.exitCode = undefined
})

describe('findWaldFiles', () => {
  it('finds .wald files recursively and ignores generated directories', () => {
    const root = fixture({
      'src/pages/index.wald': '<main></main>',
      'src/site.ts': 'export {}',
      'dist/generated.wald': '<p>skip</p>',
      'node_modules/pkg/file.wald': '<p>skip</p>',
    })
    expect(findWaldFiles([root])).toEqual([join(root, 'src/pages/index.wald')])
  })
})

describe('runFormat', () => {
  it('formats files in place', () => {
    const root = fixture({ 'page.wald': '<main><section><p>Hello</p></section></main>' })
    const result = runFormat([root])

    expect(result.changed).toEqual([join(root, 'page.wald')])
    expect(readFileSync(join(root, 'page.wald'), 'utf8')).toContain('\n  <section>')
  })

  it('reports changes without writing in check mode', () => {
    const original = '<main><section></section></main>'
    const root = fixture({ 'page.wald': original })
    const result = runFormat([root], true)

    expect(result.changed).toHaveLength(1)
    expect(readFileSync(join(root, 'page.wald'), 'utf8')).toBe(original)
  })

  it('accepts multiple files and removes duplicates', () => {
    const root = fixture({ 'a.wald': '<p>a</p>', 'b.wald': '<p>b</p>' })
    expect(findWaldFiles([root, join(root, 'a.wald')])).toHaveLength(2)
  })
})

describe('formatCommand', () => {
  it('sets a failing exit code when --check finds an unformatted file', () => {
    const root = fixture({ 'page.wald': '<main><p>x</p></main>' })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    ;(formatCommand.run as Function)({ args: { _: [root], path: root, check: true } })

    expect(process.exitCode).toBe(1)
  })
})
