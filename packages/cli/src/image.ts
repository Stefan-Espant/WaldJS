import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

export type OptimizedImage = {
  src: string
  width: number
  height: number
  srcset: string
}

export type ImageContext = {
  assetsDir: string
  // Undefined means dev mode: serve the original asset as-is, no processing.
  outDir?: string
  publicPath: string
}

export type ImageProps = {
  src: string
  alt?: string
  widths?: number[]
  sizes?: string
}

const DEFAULT_WIDTHS = [400, 800]

// Formats sharp can't usefully re-encode (vector/animated) are copied through
// unprocessed rather than failing the build.
const PASSTHROUGH_EXTENSIONS = new Set(['.svg', '.gif'])

const cache = new Map<string, Promise<OptimizedImage>>()

export async function optimizeImage(
  absoluteSrcPath: string,
  outDir: string,
  publicPath: string,
  widths: number[] = DEFAULT_WIDTHS,
): Promise<OptimizedImage> {
  const cacheKey = `${absoluteSrcPath}\0${outDir}\0${publicPath}\0${widths.join(',')}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const promise = optimizeImageUncached(absoluteSrcPath, outDir, publicPath, widths)
  cache.set(cacheKey, promise)
  return promise
}

async function optimizeImageUncached(
  absoluteSrcPath: string,
  outDir: string,
  publicPath: string,
  widths: number[],
): Promise<OptimizedImage> {
  mkdirSync(outDir, { recursive: true })
  const ext = extname(absoluteSrcPath).toLowerCase()

  if (PASSTHROUGH_EXTENSIONS.has(ext)) {
    const fileName = basename(absoluteSrcPath)
    writeFileSync(join(outDir, fileName), readFileSync(absoluteSrcPath))
    return { src: `${publicPath}/${fileName}`, width: 0, height: 0, srcset: '' }
  }

  const base = basename(absoluteSrcPath, ext)
  const hash = createHash('sha1').update(absoluteSrcPath).digest('hex').slice(0, 8)
  const metadata = await sharp(absoluteSrcPath).metadata()
  const naturalWidth = metadata.width ?? 0
  const naturalHeight = metadata.height ?? 0

  const usableWidths = [...new Set(widths.filter((w) => w <= naturalWidth))]
  if (usableWidths.length === 0 && naturalWidth > 0) usableWidths.push(naturalWidth)

  const srcsetParts: string[] = []
  let primarySrc = ''
  for (const width of usableWidths.sort((a, b) => a - b)) {
    const fileName = `${base}-${hash}-${width}.webp`
    await sharp(absoluteSrcPath).resize(width).webp().toFile(join(outDir, fileName))
    const url = `${publicPath}/${fileName}`
    srcsetParts.push(`${url} ${width}w`)
    primarySrc = url
  }

  return {
    src: primarySrc,
    width: naturalWidth,
    height: naturalHeight,
    srcset: srcsetParts.join(', '),
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

export function renderImageTag(image: OptimizedImage, alt: string, sizes = '100vw'): string {
  const dims = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : ''
  const srcsetAttr = image.srcset ? ` srcset="${image.srcset}" sizes="${escapeAttr(sizes)}"` : ''
  return `<img src="${image.src}" alt="${escapeAttr(alt)}"${dims}${srcsetAttr}>`
}

// Bridges the `wald:image` virtual module (see vite-plugin.ts) to the logic
// above. In dev mode (no outDir configured) it skips processing entirely —
// wald grow's existing /assets/* static serving already handles the file.
export async function renderImage(props: ImageProps, context: ImageContext): Promise<string> {
  const { src, alt = '', widths, sizes } = props

  if (!context.outDir) {
    return `<img src="${src}" alt="${escapeAttr(alt)}">`
  }

  const relative = src.replace(/^\/assets\//, '')
  const absoluteSrc = join(context.assetsDir, relative)
  const image = await optimizeImage(absoluteSrc, context.outDir, context.publicPath, widths)
  return renderImageTag(image, alt, sizes)
}
