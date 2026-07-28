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
    expect(content).toContain('<Layout')
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

  it('creates content/blog/hello-world.md with frontmatter', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'content', 'blog', 'hello-world.md'), 'utf8')
    expect(content).toContain('title:')
    expect(content).toContain('date:')
  })

  it('creates src/layouts/Layout.wald with pond and full HTML shell', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'layouts', 'Layout.wald'), 'utf8')
    expect(content).toContain('pond')
    expect(content).toContain('<!DOCTYPE html>')
  })

  it('creates src/components/Card.wald with $$props', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'components', 'Card.wald'), 'utf8')
    expect(content).toContain('$$props')
  })

  it('creates src/components/Counter.wald with a <script> block', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'components', 'Counter.wald'), 'utf8')
    expect(content).toContain('<script>')
    expect(content).toContain('addEventListener')
    expect(content).toContain('</script>')
  })

  it('creates src/assets/css/global.css with the brand color tokens', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'assets', 'css', 'global.css'), 'utf8')
    expect(content).toContain('#FF3347')
    expect(content).toContain('#023B2D')
    expect(content).toContain('.btn')
    expect(content).toContain('.card')
  })

  it('creates src/components/TreeMark.wald with an inline SVG', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'components', 'TreeMark.wald'), 'utf8')
    expect(content).toContain('<svg')
    expect(content).toContain('#FF3347')
  })

  it('Layout.wald includes a navbar, footer, and the global stylesheet', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'layouts', 'Layout.wald'), 'utf8')
    expect(content).toContain('/assets/css/global.css')
    expect(content).toContain('fonts.googleapis.com')
    expect(content).toContain('TreeMark')
    expect(content).toContain('class="navbar"')
    expect(content).toContain('class="site-footer"')
    expect(content).toContain('pond')
    expect(content).toContain('<!DOCTYPE html>')
  })

  it('Card.wald accepts an icon prop', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'components', 'Card.wald'), 'utf8')
    expect(content).toContain('icon')
    expect(content).toContain('card-icon')
  })

  it('index.wald has a hero, three feature cards, and the counter demo', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'pages', 'index.wald'), 'utf8')
    expect(content).toContain('class="hero"')
    expect(content).toContain('class="features"')
    expect(content).toContain('class="counter-demo"')
    expect((content.match(/<Card/g) ?? []).length).toBe(3)
    expect(content).toContain('<Counter')
  })

  it('blog/index.wald has a page header and a styled post list', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'pages', 'blog', 'index.wald'), 'utf8')
    expect(content).toContain('class="page-header"')
    expect(content).toContain('class="post-list"')
    expect(content).toContain('class="post"')
    expect(content).toContain('.map(')
  })

  it('blog/[slug].wald wraps content in a post-body article', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'pages', 'blog', '[slug].wald'), 'utf8')
    expect(content).toContain('class="post-body"')
  })
})
