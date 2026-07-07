import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { collectCanopyScriptContents, scanCanopyEntries } from './canopy-scan.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wald-canopy-scan-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('scanCanopyEntries', () => {
  it('finds a canopy component used in a page and resolves its file path', () => {
    const srcDir = join(tmpDir, 'src')
    const pagesDir = join(srcDir, 'pages')
    const componentsDir = join(srcDir, 'components')
    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(componentsDir, { recursive: true })

    const counterFile = join(componentsDir, 'Counter.wald')
    writeFileSync(counterFile, ['---', '---', '<button>0</button>', '<script>export default function() {}</script>'].join('\n'))
    writeFileSync(
      join(pagesDir, 'index.wald'),
      ["---", "import Counter from '../components/Counter.wald'", '---', '<Counter canopy:load initial={3} />'].join('\n')
    )

    const { entries, warnings } = scanCanopyEntries(srcDir)
    expect(entries.get('counter')).toBe(counterFile)
    expect(warnings).toEqual([])
  })

  it('warns and skips components used with canopy:* but no <script> block', () => {
    const srcDir = join(tmpDir, 'src')
    const pagesDir = join(srcDir, 'pages')
    const componentsDir = join(srcDir, 'components')
    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(componentsDir, { recursive: true })

    writeFileSync(join(componentsDir, 'Static.wald'), ['---', '---', '<p>hello</p>'].join('\n'))
    writeFileSync(
      join(pagesDir, 'index.wald'),
      ["---", "import Static from '../components/Static.wald'", '---', '<Static canopy:load />'].join('\n')
    )

    const { entries, warnings } = scanCanopyEntries(srcDir)
    expect(entries.size).toBe(0)
    expect(warnings).toEqual(['Static has no <script> block — canopy:load has no effect'])
  })

  it('returns no entries when no canopy directives are used', () => {
    const srcDir = join(tmpDir, 'src')
    const pagesDir = join(srcDir, 'pages')
    mkdirSync(pagesDir, { recursive: true })
    writeFileSync(join(pagesDir, 'index.wald'), '<p>hello</p>')

    const { entries, warnings } = scanCanopyEntries(srcDir)
    expect(entries.size).toBe(0)
    expect(warnings).toEqual([])
  })

  it('finds canopy usage nested inside a layout-wrapped page', () => {
    const srcDir = join(tmpDir, 'src')
    const pagesDir = join(srcDir, 'pages')
    const componentsDir = join(srcDir, 'components')
    const layoutsDir = join(srcDir, 'layouts')
    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(componentsDir, { recursive: true })
    mkdirSync(layoutsDir, { recursive: true })

    const counterFile = join(componentsDir, 'Counter.wald')
    writeFileSync(counterFile, ['---', '---', '<button>0</button>', '<script>export default function() {}</script>'].join('\n'))
    writeFileSync(join(layoutsDir, 'Layout.wald'), ['---', '---', '<html><body>{pond}</body></html>'].join('\n'))
    writeFileSync(
      join(pagesDir, 'index.wald'),
      [
        '---',
        "import Layout from '../layouts/Layout.wald'",
        "import Counter from '../components/Counter.wald'",
        '---',
        '<Layout>',
        '  <Counter canopy:visible />',
        '</Layout>',
      ].join('\n')
    )

    const { entries } = scanCanopyEntries(srcDir)
    expect(entries.get('counter')).toBe(counterFile)
  })
})

describe('collectCanopyScriptContents', () => {
  it('returns the raw <script>...</script> text for each canopy entry', () => {
    const srcDir = join(tmpDir, 'src')
    const componentsDir = join(srcDir, 'components')
    mkdirSync(componentsDir, { recursive: true })

    const counterFile = join(componentsDir, 'Counter.wald')
    const script = '<script>export default function() { console.log("counter") }</script>'
    writeFileSync(counterFile, ['---', '---', '<button>0</button>', script].join('\n'))

    const contents = collectCanopyScriptContents(new Map([['counter', counterFile]]))
    expect(contents.has(script)).toBe(true)
  })
})
