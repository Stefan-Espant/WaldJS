import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
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

  it('scaffolds a project that builds successfully with the real wald CLI', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-e2e-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)

    const cliBin = join(__dirname, '..', '..', 'bin', 'wald.js')
    execFileSync(process.execPath, [cliBin, 'build'], { cwd: dir, stdio: 'pipe' })

    const html = readFileSync(join(dir, 'dist', 'index.html'), 'utf8')
    expect(html).toContain('/assets/css/global.css')
    expect(html).toContain('class="hero"')

    // Counter's data-count attribute must be interpolated to the real
    // initial value, not leak the literal template placeholder — the click
    // handler does parseInt(el.dataset.count, 10), which silently becomes
    // NaN if the attribute renders as the string "{initial}".
    expect(html).toContain('data-count="3"')
    expect(html).not.toContain('data-count="{initial}"')

    expect(existsSync(join(dir, 'dist', 'assets', 'css', 'global.css'))).toBe(true)
    expect(existsSync(join(dir, 'dist', 'blog', 'hello-world', 'index.html'))).toBe(true)

    // The blog list and post body are built from raw HTML strings in
    // frontmatter, so interpolating them with plain {expr} would HTML-escape
    // the markup and leak literal tags as visible text instead of rendering
    // it. Confirm the actual <a>/<p> tags render, not their escaped entities.
    const blogHtml = readFileSync(join(dir, 'dist', 'blog', 'index.html'), 'utf8')
    expect(blogHtml).toContain('<a class="post" href="/blog/hello-world">')
    expect(blogHtml).not.toContain('&lt;a class=&quot;post&quot;')

    const postHtml = readFileSync(join(dir, 'dist', 'blog', 'hello-world', 'index.html'), 'utf8')
    expect(postHtml).toContain('class="post-body"')
    expect(postHtml).toMatch(/<article class="post-body">[\s\S]*<p>/)
    expect(postHtml).not.toContain('&lt;p&gt;')
  }, 60_000)

  it('scaffolds a project whose canopy islands build and resolve @waldjs/canopy', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-canopy-e2e-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)

    // The scaffold's Counter usage has no canopy directive by default, so a
    // plain build never exercises the @waldjs/canopy resolution path — patch
    // it in so this test actually forces buildCanopyClient() to bundle a
    // client entry and hit that resolveId branch.
    const indexPath = join(dir, 'src', 'pages', 'index.wald')
    const original = readFileSync(indexPath, 'utf8')
    const withCanopy = original.replace('<Counter initial={3} />', '<Counter canopy:load initial={3} />')
    expect(withCanopy).not.toBe(original)
    writeFileSync(indexPath, withCanopy)

    const cliBin = join(__dirname, '..', '..', 'bin', 'wald.js')
    execFileSync(process.execPath, [cliBin, 'build'], { cwd: dir, stdio: 'pipe' })

    const html = readFileSync(join(dir, 'dist', 'index.html'), 'utf8')
    expect(html).toContain('<wald-canopy')
    expect(html).toContain('data-strategy="load"')
    expect(html).toContain('/assets/wald-canopy-')

    const assetFiles = readdirSync(join(dir, 'dist', 'assets'))
    expect(assetFiles.some(f => f.startsWith('wald-canopy-') && f.endsWith('.js'))).toBe(true)
    expect(assetFiles.some(f => f.startsWith('counter-') && f.endsWith('.js'))).toBe(true)
  }, 60_000)
})
