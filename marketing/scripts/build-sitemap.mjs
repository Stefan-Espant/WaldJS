#!/usr/bin/env node
// Generates dist/sitemap.xml from src/pages/**/*.wald, the same way
// wald build routes pages — see packages/cli/src/router/index.ts's
// fileToRoute() for the canonical version of this logic. Re-implemented
// here (not imported) because @waldjs/cli doesn't export its router module
// from its public API (only config/adapters/image are exported) — importing
// an internal path would be a fragile, unsupported dependency. Dynamic
// [param]-style routes are detected the same way the real router does and
// excluded from the sitemap (no single known URL to list for them);
// marketing has none of these today, but the exclusion is exercised by test.
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2] ?? process.cwd()
const baseUrl = (process.argv[3] ?? 'https://waldjs.steefan.nl').replace(/\/$/, '')
const pagesDir = join(root, 'src/pages')
const distDir = join(root, 'dist')

function walkDir(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkDir(full))
    } else if (entry.name.endsWith('.wald')) {
      files.push(full)
    }
  }
  return files
}

function fileToRoute(file) {
  const rel = relative(pagesDir, file).replace(/\\/g, '/')
  const withoutExt = rel.slice(0, -'.wald'.length)
  const segments = withoutExt.split('/')
  if (segments[segments.length - 1] === 'index') segments.pop()

  // Mirror the real router's [param] detection (packages/cli/src/router/index.ts's
  // fileToRoute) so a [slug] segment is recognized as dynamic even though we
  // don't rewrite it to :slug here — we just need to know to exclude it below.
  const isDynamic = segments.some((seg) => /^\[(\w+)\]$/.test(seg))

  return { route: '/' + segments.join('/'), isDynamic }
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const routes = walkDir(pagesDir)
  .map(fileToRoute)
  .filter(({ isDynamic }) => !isDynamic) // skip dynamic [param] routes — no known URLs to list
  .map(({ route }) => route)
  .sort()

const urls = routes
  .map((route) => `  <url><loc>${escapeXml(baseUrl + (route === '/' ? '/' : route))}</loc></url>`)
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

mkdirSync(distDir, { recursive: true })
writeFileSync(join(distDir, 'sitemap.xml'), xml)
console.log(`sitemap: ${routes.length} route${routes.length === 1 ? '' : 's'} -> dist/sitemap.xml`)
