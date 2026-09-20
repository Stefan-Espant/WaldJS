import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { optimizeImage, renderImageTag, renderImage } from './image.js'

async function makeTestImage(dir: string, name: string, width: number, height: number): Promise<string> {
  const path = join(dir, name)
  await sharp({ create: { width, height, channels: 3, background: { r: 10, g: 120, b: 60 } } })
    .png()
    .toFile(path)
  return path
}

describe('optimizeImage', () => {
  let srcDir: string
  let outDir: string

  afterEach(() => {
    if (srcDir) rmSync(srcDir, { recursive: true, force: true })
  })

  it('generates a resized webp file per requested width', async () => {
    srcDir = mkdtempSync(join(tmpdir(), 'wald-image-src-'))
    outDir = join(srcDir, 'out')
    const src = await makeTestImage(srcDir, 'photo.png', 1600, 900)

    const result = await optimizeImage(src, outDir, '/assets/optimized', [400, 800])

    expect(existsSync(outDir)).toBe(true)
    const files = readdirSync(outDir)
    expect(files.filter(f => f.endsWith('.webp'))).toHaveLength(2)
  })

  it('returns natural dimensions and a valid srcset', async () => {
    srcDir = mkdtempSync(join(tmpdir(), 'wald-image-src-'))
    outDir = join(srcDir, 'out')
    const src = await makeTestImage(srcDir, 'photo.png', 1600, 900)

    const result = await optimizeImage(src, outDir, '/assets/optimized', [400, 800])

    expect(result.width).toBe(1600)
    expect(result.height).toBe(900)
    expect(result.srcset).toContain('400w')
    expect(result.srcset).toContain('800w')
    expect(result.src).toMatch(/^\/assets\/optimized\/.*\.webp$/)
  })

  it('skips widths larger than the source image', async () => {
    srcDir = mkdtempSync(join(tmpdir(), 'wald-image-src-'))
    outDir = join(srcDir, 'out')
    const src = await makeTestImage(srcDir, 'small.png', 300, 200)

    const result = await optimizeImage(src, outDir, '/assets/optimized', [400, 800])

    expect(result.srcset).not.toContain('400w')
    expect(result.srcset).not.toContain('800w')
    expect(result.srcset).toContain('300w')
  })

  it('caches results for the same source, outDir and widths', async () => {
    srcDir = mkdtempSync(join(tmpdir(), 'wald-image-src-'))
    outDir = join(srcDir, 'out')
    const src = await makeTestImage(srcDir, 'photo.png', 800, 600)

    await optimizeImage(src, outDir, '/assets/optimized', [400])
    const filesAfterFirst = readdirSync(outDir).length
    await optimizeImage(src, outDir, '/assets/optimized', [400])
    const filesAfterSecond = readdirSync(outDir).length

    expect(filesAfterSecond).toBe(filesAfterFirst)
  })

  it('passes SVGs through unprocessed instead of failing the build', async () => {
    srcDir = mkdtempSync(join(tmpdir(), 'wald-image-src-'))
    outDir = join(srcDir, 'out')
    const svgPath = join(srcDir, 'icon.svg')
    writeFileSync(svgPath, '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>')

    const result = await optimizeImage(svgPath, outDir, '/assets/optimized', [400, 800])

    expect(result.src).toBe('/assets/optimized/icon.svg')
    expect(result.srcset).toBe('')
    expect(existsSync(join(outDir, 'icon.svg'))).toBe(true)
  })
})

describe('renderImageTag', () => {
  it('renders an img tag with srcset, sizes and dimensions', () => {
    const html = renderImageTag(
      { src: '/assets/optimized/photo-400.webp', width: 1600, height: 900, srcset: '/a-400.webp 400w, /a-800.webp 800w' },
      'A green field',
      '50vw'
    )
    expect(html).toContain('src="/assets/optimized/photo-400.webp"')
    expect(html).toContain('alt="A green field"')
    expect(html).toContain('width="1600"')
    expect(html).toContain('height="900"')
    expect(html).toContain('srcset="/a-400.webp 400w, /a-800.webp 800w"')
    expect(html).toContain('sizes="50vw"')
  })

  it('HTML-escapes the alt text', () => {
    const html = renderImageTag({ src: '/a.webp', width: 0, height: 0, srcset: '' }, '"><script>alert(1)</script>')
    expect(html).not.toContain('<script>')
  })

  it('omits srcset/sizes when there is none', () => {
    const html = renderImageTag({ src: '/a.svg', width: 0, height: 0, srcset: '' }, 'icon')
    expect(html).not.toContain('srcset')
    expect(html).not.toContain('sizes')
  })
})

describe('renderImage', () => {
  let assetsDir: string

  afterEach(() => {
    if (assetsDir) rmSync(assetsDir, { recursive: true, force: true })
  })

  it('serves the original asset untouched when no outDir is configured (dev mode)', async () => {
    assetsDir = mkdtempSync(join(tmpdir(), 'wald-image-assets-'))
    await makeTestImage(assetsDir, 'photo.png', 800, 600)

    const html = await renderImage(
      { src: '/assets/photo.png', alt: 'A photo' },
      { assetsDir, publicPath: '/assets/optimized' }
    )

    expect(html).toBe('<img src="/assets/photo.png" alt="A photo">')
  })

  it('optimizes the asset when outDir is configured (build mode)', async () => {
    assetsDir = mkdtempSync(join(tmpdir(), 'wald-image-assets-'))
    await makeTestImage(assetsDir, 'photo.png', 1600, 900)
    const outDir = join(assetsDir, 'dist-out')

    const html = await renderImage(
      { src: '/assets/photo.png', alt: 'A photo', widths: [400] },
      { assetsDir, outDir, publicPath: '/assets/optimized' }
    )

    expect(html).toContain('srcset=')
    expect(html).toContain('.webp')
    expect(existsSync(outDir)).toBe(true)
  })
})
