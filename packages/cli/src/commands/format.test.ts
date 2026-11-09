import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { findWaldFiles, findFormatFiles, formatCommand, runFormat } from './format.js'

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
  it('formats files in place', async () => {
    const root = fixture({ 'page.wald': '<main><section><p>Hello</p></section></main>' })
    const result = await runFormat([root])

    expect(result.changed).toEqual([join(root, 'page.wald')])
    expect(readFileSync(join(root, 'page.wald'), 'utf8')).toContain('\n  <section>')
  })

  it('reports changes without writing in check mode', async () => {
    const original = '<main><section></section></main>'
    const root = fixture({ 'page.wald': original })
    const result = await runFormat([root], true)

    expect(result.changed).toHaveLength(1)
    expect(readFileSync(join(root, 'page.wald'), 'utf8')).toBe(original)
  })

  it('accepts multiple files and removes duplicates', () => {
    const root = fixture({ 'a.wald': '<p>a</p>', 'b.wald': '<p>b</p>' })
    expect(findWaldFiles([root, join(root, 'a.wald')])).toHaveLength(2)
  })
})

describe('formatCommand', () => {
  it('sets a failing exit code when --check finds an unformatted file', async () => {
    const root = fixture({ 'page.wald': '<main><p>x</p></main>' })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    ;await (formatCommand.run as Function)({ args: { _: [root], path: root, check: true } })

    expect(process.exitCode).toBe(1)
  })
})


describe('language-aware formatting', () => {
  it('finds supported web files and skips generated output and other content', () => {
    const root = fixture({
      'src/index.html': '<main></main>', 'src/site.css': '.card{}',
      'src/site.js': 'const x=1;', 'src/types.ts': 'type X={a:string};',
      'src/Card.wald': '<p>Hi</p>', 'content/post.md': '# Text',
      'dist/site.js': 'skip', '.vercel/output/static/site.js': 'skip',
      '.oester/output/client/site.css': 'skip', 'coverage/report.js': 'skip',
    })
    expect(findFormatFiles([root]).map(path => path.slice(root.length + 1))).toEqual([
      'src/Card.wald', 'src/index.html', 'src/site.css', 'src/site.js', 'src/types.ts',
    ])
  })

  it('formats every supported language and passes a second check without changes', async () => {
    const root = fixture({
      'page.wald': '<div><style>.card{color:red}</style><script>const value={a:1};</script></div>',
      'page.html': '<main><section><p>Hi</p></section></main>',
      'site.css': '.card{color:red}', 'site.js': 'const value={a:1};',
    })
    expect((await runFormat([root])).changed).toHaveLength(4)
    expect((await runFormat([root], true)).changed).toEqual([])
    expect(readFileSync(join(root, 'site.css'), 'utf8')).toContain('  color: red;')
    expect(readFileSync(join(root, 'page.wald'), 'utf8')).toContain('    const value = { a: 1 }')
  })

  it('reports invalid code with its filename and leaves that file untouched', async () => {
    const source = 'const = ;'
    const root = fixture({ 'broken.js': source })
    await expect(runFormat([root])).rejects.toThrow(/broken\.js/)
    expect(readFileSync(join(root, 'broken.js'), 'utf8')).toBe(source)
  })

  it('supports actual CLI paths, multiple files and --check exit codes', () => {
    const root = fixture({ 'site.css': '.card{color:red}', 'site.js': 'const value={a:1};' })
    const cli = fileURLToPath(new URL('../../bin/wald.js', import.meta.url))
    const check = spawnSync(process.execPath, [cli, 'format', '--check', root], { encoding: 'utf8' })
    expect(check.status).toBe(1)
    expect(check.stderr).toContain('need formatting')
    expect(readFileSync(join(root, 'site.js'), 'utf8')).toBe('const value={a:1};')
    execFileSync(process.execPath, [cli, 'format', join(root, 'site.css'), join(root, 'site.js')], { stdio: 'pipe' })
    const clean = spawnSync(process.execPath, [cli, 'format', '--check', root], { encoding: 'utf8' })
    expect(clean.status).toBe(0)
    expect(clean.stdout).toContain('2 files formatted')
  }, 20000)
})
