import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { collectComponentStyles } from './style-scan.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wald-style-scan-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('collectComponentStyles', () => {
  it('bundles scoped CSS from a component with a <style> block', () => {
    const srcDir = join(tmpDir, 'src')
    const componentsDir = join(srcDir, 'components')
    mkdirSync(componentsDir, { recursive: true })
    writeFileSync(
      join(componentsDir, 'Card.wald'),
      '---\n---\n<div class="card">Hi</div>\n<style>.card { color: red }</style>',
    )

    const css = collectComponentStyles(srcDir)
    expect(css).toMatch(/\.card\[data-wald-[0-9a-f]{8}\]\{ color: red \}/)
  })

  it('returns an empty string when no component has a <style> block', () => {
    const srcDir = join(tmpDir, 'src')
    const componentsDir = join(srcDir, 'components')
    mkdirSync(componentsDir, { recursive: true })
    writeFileSync(join(componentsDir, 'Plain.wald'), '---\n---\n<div>Hi</div>')

    expect(collectComponentStyles(srcDir)).toBe('')
  })

  it('bundles styles from multiple components, each scoped independently', () => {
    const srcDir = join(tmpDir, 'src')
    const componentsDir = join(srcDir, 'components')
    mkdirSync(componentsDir, { recursive: true })
    writeFileSync(
      join(componentsDir, 'Card.wald'),
      '---\n---\n<div class="card">Hi</div>\n<style>.card { color: red }</style>',
    )
    writeFileSync(
      join(componentsDir, 'Nav.wald'),
      '---\n---\n<nav>Hi</nav>\n<style>nav { color: blue }</style>',
    )

    const css = collectComponentStyles(srcDir)
    expect(css).toMatch(/\.card\[data-wald-[0-9a-f]{8}\]/)
    expect(css).toMatch(/nav\[data-wald-[0-9a-f]{8}\]/)
  })
})
