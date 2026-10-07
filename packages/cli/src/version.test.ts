import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { WALD_GENERATOR, WALD_VERSION } from './version.js'

describe('version', () => {
  it('matches the CLI package.json version', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
    expect(WALD_VERSION).toBe(pkg.version)
    expect(WALD_GENERATOR).toBe(`WaldJS v${pkg.version}`)
  })
})
