import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { renderDiagnostic, runCheck } from './check.js'

function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'wald-check-cmd-'))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('renderDiagnostic', () => {
  it('renders file:line:column, source context and caret', () => {
    const source = 'type Props = { title: string }\nconst { subtitle } = $props'
    const out = renderDiagnostic(
      { file: 'src/pages/index.wald', line: 2, column: 9, message: "Property 'subtitle' does not exist" },
      source,
    )
    expect(out).toContain('[waldjs] src/pages/index.wald:2:9')
    expect(out).toContain("Property 'subtitle' does not exist")
    expect(out).toContain('2 | const { subtitle } = $props')
    const caretLine = out.split('\n').find(l => l.includes('^'))!
    expect(caretLine.indexOf('^')).toBeGreaterThan(0)
  })
})

describe('runCheck', () => {
  it('returns true and reports success for a clean project', async () => {
    const root = makeProject({
      'src/pages/index.wald': `---
const title = 'hi'
---
<h1>{title}</h1>`,
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const ok = await runCheck(root)
    expect(ok).toBe(true)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('No type errors'))
    rmSync(root, { recursive: true, force: true })
  })

  it('returns false and prints diagnostics for a broken project', async () => {
    const root = makeProject({
      'src/pages/index.wald': `---
type Props = { title: string }
const { subtitle } = $props
---
<h1>{subtitle}</h1>`,
    })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ok = await runCheck(root)
    expect(ok).toBe(false)
    expect(err).toHaveBeenCalledWith(expect.stringContaining('index.wald:3:'))
    rmSync(root, { recursive: true, force: true })
  })
})
