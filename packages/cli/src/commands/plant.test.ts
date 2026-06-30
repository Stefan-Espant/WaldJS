import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { scaffold } from './plant.js'

describe('scaffold', () => {
  it('creates the project directory', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    expect(existsSync(dir)).toBe(true)
  })

  it('creates src/pages/index.wald with starter content', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'pages', 'index.wald'), 'utf8')
    expect(content).toContain('const title')
    expect(content).toContain('<h1>')
  })

  it('creates package.json with wald scripts', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    expect(pkg.scripts.dev).toBe('wald grow')
    expect(pkg.scripts.build).toBe('wald build')
    expect(pkg.scripts.preview).toBe('wald preview')
  })

  it('creates .gitignore with node_modules, dist, .env, and .DS_Store', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, '.gitignore'), 'utf8')
    expect(content).toContain('node_modules')
    expect(content).toContain('dist')
    expect(content).toContain('.env')
    expect(content).toContain('.DS_Store')
  })
})
