import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>()
  return {
    ...actual,
    build: vi.fn(async (cfg: any) => {
      const { writeFileSync: fsWrite, mkdirSync: fsMkdir } = await import('node:fs')
      const { join: pJoin } = await import('node:path')

      const outDir: string = cfg.build.outDir
      const inputs: Record<string, string> = cfg.build.rollupOptions.input
      fsMkdir(pJoin(outDir, 'assets'), { recursive: true })

      const bundle: Record<string, any> = {}
      for (const key of Object.keys(inputs)) {
        const fileName = `assets/${key}-testhash.js`
        fsWrite(pJoin(outDir, fileName), 'export default function() {}')
        bundle[fileName] = { type: 'chunk', isEntry: true, name: key, fileName }
      }

      for (const plugin of cfg.plugins ?? []) {
        if (typeof plugin?.generateBundle === 'function') {
          await plugin.generateBundle({}, bundle)
        }
      }
    }),
  }
})

import { buildCanopyClient, captureCanopyAssets } from './canopy-build.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wald-canopy-build-'))
})

describe('captureCanopyAssets', () => {
  it('maps entry chunk names to base-prefixed file URLs', () => {
    const assetMap = new Map<string, string>()
    const plugin = captureCanopyAssets(assetMap, '/')
    plugin.generateBundle?.({}, {
      'assets/counter-abc.js': { type: 'chunk', isEntry: true, name: 'counter', fileName: 'assets/counter-abc.js' },
      'assets/shared-xyz.js': { type: 'chunk', isEntry: false, name: 'shared', fileName: 'assets/shared-xyz.js' },
    } as any)

    expect(assetMap.get('counter')).toBe('/assets/counter-abc.js')
    expect(assetMap.has('shared')).toBe(false)
  })

  it('strips a trailing slash from base before joining', () => {
    const assetMap = new Map<string, string>()
    const plugin = captureCanopyAssets(assetMap, '/my-site/')
    plugin.generateBundle?.({}, {
      'assets/counter-abc.js': { type: 'chunk', isEntry: true, name: 'counter', fileName: 'assets/counter-abc.js' },
    } as any)

    expect(assetMap.get('counter')).toBe('/my-site/assets/counter-abc.js')
  })
})

describe('buildCanopyClient', () => {
  it('returns an empty map and skips the build when there are no entries', async () => {
    const { build } = await import('vite')
    const distDir = join(tmpDir, 'dist')

    const assetMap = await buildCanopyClient(new Map(), distDir, '/', {})

    expect(assetMap.size).toBe(0)
    expect(build).not.toHaveBeenCalled()
  })

  it('builds the canopy runtime plus each entry and returns their asset URLs', async () => {
    const distDir = join(tmpDir, 'dist')
    const componentsDir = join(tmpDir, 'src', 'components')
    mkdirSync(componentsDir, { recursive: true })
    const counterFile = join(componentsDir, 'Counter.wald')
    writeFileSync(counterFile, ['---', '---', '<button>0</button>', '<script>export default function() {}</script>'].join('\n'))

    const entries = new Map([['counter', counterFile]])
    const assetMap = await buildCanopyClient(entries, distDir, '/', {})

    expect(assetMap.get('wald-canopy')).toBe('/assets/wald-canopy-testhash.js')
    expect(assetMap.get('counter')).toBe('/assets/counter-testhash.js')
  })
})
